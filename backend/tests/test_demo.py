import asyncio

import httpx
import pytest

from coursemap import demo
from coursemap.api import create_app
from coursemap.config import Settings
from coursemap.pipeline import Deps
from coursemap.store import MemoryStore


@pytest.fixture
def client():
    deps = Deps(llm=demo.DemoLLM(delay=0), store=MemoryStore(), http=demo.demo_http(), settings=Settings(youtube_api_key="demo"))
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(deps)), base_url="http://test")


async def wait_done(client, job_id):
    for _ in range(300):
        job = (await client.get(f"/api/jobs/{job_id}")).json()
        if job["status"] in ("done", "failed"):
            return job
        await asyncio.sleep(0.01)
    raise AssertionError("job did not finish")


async def test_demo_runs_the_full_flow(client):
    r = await client.post("/api/jobs", data={"playlist_url": "https://www.youtube.com/playlist?list=PLanything",
                                             "syllabus_text": "Docker"})
    job = await wait_done(client, r.json()["job_id"])
    assert job["status"] == "done", job["error"]
    assert job["syllabus"]["course"] == "Docker"
    assert len(job["videos"]) == len(demo.VIDEOS)

    status = {c["topic_name"]: c["status"] for c in job["coverage"]}
    assert status["Dockerfile instructions"] == "covered"
    assert status["Debugging containers"] == "partial"
    assert status["Container networking"] == "gap"
    assert status["Container security"] == "gap"
    assert {s["video_id"] for s in job["suggestions"]} == {"dmS1", "dmS2"}

    assert len(job["questions"]) == sum(len(q) for q in demo.QUESTIONS.values())
    taught = next(q for q in job["questions"] if "RUN and CMD" in q["text"])
    assert taught["moment"]["video_id"] == "dm04"

    r = await client.post(f"/api/jobs/{job['id']}/grade",
                          json={"question_id": taught["id"], "answer": "RUN happens while building the image."})
    grade = r.json()
    assert grade["score"] == 1 and grade["max_score"] == 2
    assert grade["missing_points"] == ["CMD sets the default command when the container starts"]
    assert grade["rewatch"]["video_id"] == "dm04"
