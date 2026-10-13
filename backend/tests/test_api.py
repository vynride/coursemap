import asyncio

import httpx
import pytest

from conftest import FakeLLM
from coursemap.ai import SyllabusOut, VideoOut
from coursemap.api import create_app
from coursemap.config import Settings
from coursemap.exam import GradeOut, QuestionsOut
from coursemap.pipeline import Deps
from coursemap.store import MemoryStore
from test_pipeline import QUESTIONS_OUT, SYLLABUS_OUT, video_response

PDF = ("syllabus.pdf", b"%PDF-1.4 fake", "application/pdf")


@pytest.fixture
def client(youtube_http):
    llm = FakeLLM({
        SyllabusOut: SYLLABUS_OUT, VideoOut: video_response, QuestionsOut: QUESTIONS_OUT,
        GradeOut: GradeOut(score=1, feedback="Half right.", missing_points=["b"]),
    })
    deps = Deps(llm=llm, store=MemoryStore(), http=youtube_http, settings=Settings(youtube_api_key="k"))
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(deps)), base_url="http://test")


async def wait_done(client, job_id):
    for _ in range(300):
        job = (await client.get(f"/api/jobs/{job_id}")).json()
        if job["status"] in ("done", "failed"):
            return job
        await asyncio.sleep(0.01)
    raise AssertionError("job did not finish")


async def test_health(client):
    assert (await client.get("/api/health")).json() == {"ok": True}


@pytest.mark.parametrize(
    "data,files,message",
    [
        ({"playlist_url": "https://vimeo.com/1", "syllabus_text": "x"}, None, "YouTube"),
        ({"playlist_url": "https://www.youtube.com/playlist?list=PLtest"}, None, "syllabus"),
        ({"playlist_url": "https://www.youtube.com/playlist?list=PLtest"},
         {"syllabus_pdf": ("s.pdf", b"hello", "application/pdf")}, "PDF"),
    ],
)
async def test_create_job_rejects_bad_input(client, data, files, message):
    r = await client.post("/api/jobs", data=data, files=files)
    assert r.status_code == 400
    assert message in r.json()["detail"]


async def test_job_lifecycle_and_grading(client):
    r = await client.post("/api/jobs", data={"playlist_url": "https://www.youtube.com/playlist?list=PLtest"},
                          files={"syllabus_pdf": PDF})
    assert r.status_code == 200
    job = await wait_done(client, r.json()["job_id"])
    assert job["status"] == "done", job["error"]
    assert job["exam_pattern"].startswith("Part A")
    question = job["questions"][0]

    r = await client.post(f"/api/jobs/{job['id']}/grade", json={"question_id": question["id"], "answer": "some answer"})
    assert r.status_code == 200
    assert r.json()["score"] == 1 and r.json()["max_score"] == 2

    r = await client.post(f"/api/jobs/{job['id']}/grade", json={"question_id": "nope", "answer": "x"})
    assert r.status_code == 404


async def test_unknown_job_is_404(client):
    assert (await client.get("/api/jobs/nope")).status_code == 404
