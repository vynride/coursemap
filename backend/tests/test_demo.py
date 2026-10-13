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
    deps = Deps(llm=demo.DemoLLM(delay=0), store=MemoryStore(), http=demo.demo_http(),
                settings=Settings(youtube_api_key="demo", max_videos=50))
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(deps)), base_url="http://test")


async def wait_done(client, job_id):
    for _ in range(300):
        job = (await client.get(f"/api/jobs/{job_id}")).json()
        if job["status"] in ("done", "failed"):
            return job
        await asyncio.sleep(0.01)
    raise AssertionError("job did not finish")


def test_course_data_is_consistent():
    video_ids = {v["id"] for v in demo.COURSE["videos"]}
    assert set(demo.COURSE["analyses"]) <= video_ids
    for analysis in demo.COURSE["analyses"].values():
        for hit in analysis["hits"]:
            assert hit["topic_id"] in demo.TOPIC_NAMES
    unit_titles = {u["title"] for u in demo.COURSE["units"]}
    assert set(demo.COURSE["questions"]) == unit_titles
    assert set(demo.COURSE["suggestions"]) <= set(demo.TOPIC_NAMES.values())


async def test_demo_runs_the_full_flow(client):
    r = await client.post("/api/jobs", data={"playlist_url": "https://www.youtube.com/playlist?list=PLanything",
                                             "syllabus_text": "Docker"})
    job = await wait_done(client, r.json()["job_id"])
    assert job["status"] == "done", job["error"]
    assert job["syllabus"]["course"] == "Docker for developers"
    assert len(job["videos"]) == len(demo.COURSE["videos"])

    status = {c["topic_name"]: c["status"] for c in job["coverage"]}
    assert status["Volumes"] == "covered"
    assert status["Container logs and debugging"] == "partial"
    assert {name for name, s in status.items() if s == "gap"} == {
        "Layer caching", "Multi-stage builds", "Container networking", "Container security basics"}
    assert {s["topic_id"] for s in job["suggestions"]} == {"U2.T5", "U2.T6", "U3.T6", "U4.T4"}

    assert len(job["questions"]) == sum(len(q) for q in demo.COURSE["questions"].values())
    by_text = {q["text"]: q for q in job["questions"]}
    volumes = next(q for t, q in by_text.items() if t.startswith("You edit your code"))
    assert volumes["moment"]["video_id"] == "HU1U0H184R0"
    caching = next(q for t, q in by_text.items() if t.startswith("Every code change"))
    assert caching["moment"] is None

    taught = next(q for t, q in by_text.items() if t.startswith("What is the difference between a Docker image"))
    r = await client.post(f"/api/jobs/{job['id']}/grade",
                          json={"question_id": taught["id"], "answer": "An image is a read-only template."})
    grade = r.json()
    assert grade["score"] == 1 and grade["max_score"] == 2
    assert grade["missing_points"] == ["A container is a running instance created from an image"]
    assert grade["rewatch"]["video_id"] == "bSe3qawNQEY"
