"""Offline demo mode (DEMO=1): canned Docker course instead of Gemini and the YouTube API.

Runs the real pipeline, coverage, question and grading code with no Google credentials,
so the full flow can be shown without network access. Any playlist link works.
"""

import asyncio
import re
from typing import Any

import httpx
from google.genai import types

from coursemap.ai import HitOut, SyllabusOut, UnitOut, VideoOut
from coursemap.exam import GradeOut, QuestionOut, QuestionsOut

SYLLABUS = SyllabusOut(course="Docker", units=[
    UnitOut(title="Docker basics", topics=["Images and containers", "Installing Docker", "Container networking"]),
    UnitOut(title="Building images", topics=["Dockerfile instructions", "Layer caching", "Multi-stage builds"]),
    UnitOut(title="Running apps", topics=["Volumes", "Docker Compose", "Debugging containers", "Container security"]),
])

# (video id, title, duration ISO 8601, hits as (topic id, start, depth, key points))
VIDEOS = [
    ("dm01", "Docker in 100 seconds", "PT2M", [
        ("U1.T1", "0:20", "mentioned", ["An image is a template, a container runs it"])]),
    ("dm02", "Images vs containers, explained", "PT18M", [
        ("U1.T1", "1:05", "explained", ["An image is a read-only template", "A container is a running instance with a writable layer"])]),
    ("dm03", "Installing Docker on Linux, Mac and Windows", "PT12M", [
        ("U1.T2", "0:40", "explained", ["Docker Desktop bundles the engine on Mac and Windows", "Add your user to the docker group on Linux"])]),
    ("dm04", "Writing your first Dockerfile", "PT27M", [
        ("U2.T1", "2:10", "explained", ["FROM sets the base image", "RUN executes at build time, CMD at run time", "COPY brings files into the image"]),
        ("U2.T2", "19:30", "explained", ["Each instruction creates a layer", "Copy dependency files before source to reuse the cache"])]),
    ("dm05", "Docker CLI you will use every day", "PT21M", [
        ("U3.T3", "14:45", "mentioned", ["docker logs and docker exec -it for a shell"])]),
    ("dm06", "Multi-stage builds for small images", "PT16M", [
        ("U2.T3", "1:30", "explained", ["Build in one stage, copy artifacts into a slim final stage", "Cuts image size and attack surface"])]),
    ("dm07", "Docker volumes and bind mounts", "PT14M", [
        ("U3.T1", "0:55", "explained", ["Container data is lost when the container is removed", "Named volumes persist data managed by Docker"])]),
    ("dm08", "Docker Compose crash course", "PT32M", [
        ("U3.T2", "1:20", "explained", ["One YAML file describes all services", "docker compose up starts them on a shared network"])]),
]
SUGGESTIONS = {
    "networking": ("dmS1", "Docker networking explained: bridge, host and overlay", "Demo Channel"),
    "security": ("dmS2", "Docker security best practices", "Demo Channel"),
    "debugging": ("dmS3", "Debugging containers step by step", "Demo Channel"),
}

QUESTIONS = {
    "Docker basics": [
        QuestionOut(marks=2, text="What is the difference between a Docker image and a container?",
                    answer_points=["An image is a read-only template", "A container is a running instance of an image"], moment_index=0),
        QuestionOut(marks=5, text="Two containers on the same host need to talk to each other. How would you set that up and how do they find each other?",
                    answer_points=["Create a user-defined bridge network", "Attach both containers to it", "Containers resolve each other by name",
                                   "Default bridge has no name resolution", "Only publish ports that must be reached from outside"], moment_index=-1),
    ],
    "Building images": [
        QuestionOut(marks=2, text="What is the difference between RUN and CMD in a Dockerfile?",
                    answer_points=["RUN executes while building the image", "CMD sets the default command when the container starts"], moment_index=0),
        QuestionOut(marks=5, text="Every code change makes your image reinstall all dependencies. How would you reorder the Dockerfile to fix it?",
                    answer_points=["Copy the dependency manifest first", "Install dependencies in their own layer", "Copy the source code after",
                                   "Unchanged layers come from the cache", "Only layers after the change rebuild"], moment_index=1),
        QuestionOut(marks=5, text="Your Go service image is 900 MB. How would a multi-stage build shrink it?",
                    answer_points=["Compile in a builder stage with the full toolchain", "Start a second stage from a slim or distroless base",
                                   "COPY --from the builder only the binary", "Toolchain and sources stay out of the final image", "Smaller image, smaller attack surface"], moment_index=2),
    ],
    "Running apps": [
        QuestionOut(marks=2, text="Why does data written inside a container disappear, and how do you keep it?",
                    answer_points=["The writable layer is removed with the container", "Use a named volume or bind mount"], moment_index=0),
        QuestionOut(marks=5, text="Write down how you would run a web app and a Postgres database together with Docker Compose.",
                    answer_points=["Two services in compose.yaml", "Postgres uses a named volume for its data", "Web app reaches the database by service name",
                                   "Pass credentials through environment variables", "docker compose up -d starts both"], moment_index=1),
        QuestionOut(marks=5, text="A container exits right after starting. How do you find out why?",
                    answer_points=["docker ps -a shows the exit code", "docker logs shows the output", "Run it interactively with a shell to inspect",
                                   "Check the CMD or entrypoint", "Check missing environment variables or files"], moment_index=-1),
    ],
}

WORD = re.compile(r"[a-z0-9]{4,}")


def _text(parts: list[types.Part]) -> str:
    return "\n".join(p.text for p in parts if p.text)


def _video_id(parts: list[types.Part]) -> str | None:
    for p in parts:
        if p.file_data and p.file_data.file_uri:
            return p.file_data.file_uri.rsplit("=", 1)[-1]
    return None


def _grade(prompt: str) -> GradeOut:
    max_score = int(re.search(r"Question \((\d+) points?\)", prompt).group(1))  # type: ignore[union-attr]
    points = re.findall(r"^- (.+)$", prompt.split("Expected answer points:")[1].split("<<<")[0], re.M)
    answer = set(WORD.findall(prompt.split("<<<", 1)[1].split(">>>", 1)[0].lower()))
    hit = [p for p in points if set(WORD.findall(p.lower())) & answer]
    missing = [p for p in points if p not in hit]
    score = round(max_score * len(hit) / len(points)) if points else 0
    feedback = ("Good answer, it covers the main points." if not missing
                else f"You covered {len(hit)} of {len(points)} expected points. Rewatch the linked moment for the rest.")
    return GradeOut(score=score, feedback=feedback, missing_points=missing)


class DemoLLM:
    def __init__(self, delay: float = 1.0) -> None:
        self.delay = delay  # seconds per step, so the progress screen is visible

    async def generate(self, parts: list[types.Part], schema: type) -> Any:
        if schema is SyllabusOut:
            await asyncio.sleep(self.delay)
            return SYLLABUS
        if schema is VideoOut:
            await asyncio.sleep(2 * self.delay)
            video = next((v for v in VIDEOS if v[0] == _video_id(parts)), None)
            hits = [HitOut(topic_id=t, start=s, depth=d, key_points=k) for t, s, d, k in (video[3] if video else [])]  # type: ignore[arg-type]
            return VideoOut(summary=f"Demo summary of {video[1] if video else 'this video'}.", hits=hits)
        if schema is QuestionsOut:
            prompt = _text(parts)
            unit = re.search(r'unit "([^"]+)"', prompt)
            return QuestionsOut(questions=QUESTIONS.get(unit.group(1) if unit else "", []))
        if schema is GradeOut:
            await asyncio.sleep(self.delay / 2)
            return _grade(_text(parts))
        raise TypeError(f"Demo mode has no canned answer for {schema.__name__}")


def _handler(request: httpx.Request) -> httpx.Response:
    endpoint = request.url.path.rsplit("/", 1)[-1]
    if endpoint == "playlistItems":
        return httpx.Response(200, json={"items": [
            {"snippet": {"title": title, "resourceId": {"videoId": vid}}} for vid, title, _, _ in VIDEOS]})
    if endpoint == "videos":
        ids = request.url.params["id"].split(",")
        return httpx.Response(200, json={"items": [
            {"id": vid, "snippet": {"title": title}, "contentDetails": {"duration": dur}, "status": {"privacyStatus": "public"}}
            for vid, title, dur, _ in VIDEOS if vid in ids]})
    if endpoint == "search":
        query = request.url.params.get("q", "").lower()
        found = [s for word, s in SUGGESTIONS.items() if word in query]
        return httpx.Response(200, json={"items": [
            {"id": {"videoId": vid}, "snippet": {"title": title, "channelTitle": channel}} for vid, title, channel in found]})
    return httpx.Response(404)


def demo_http() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(_handler))
