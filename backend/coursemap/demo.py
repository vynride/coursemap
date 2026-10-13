"""Offline demo mode (DEMO=1): a recorded course instead of Gemini and the YouTube API.

Runs the real pipeline, coverage, question and grading code with no Google credentials,
so the full flow can be shown without network access. Any playlist link works.

The course lives in demo_course.json: the outline, the playlist's videos, what each video
teaches (topic, start time, key points), videos that fill gaps, and the practice questions.
"""

import asyncio
import json
import math
import re
from pathlib import Path
from typing import Any

import httpx
from google.genai import types

from coursemap.ai import HitOut, SyllabusOut, UnitOut, VideoOut
from coursemap.exam import GradeOut, QuestionOut, QuestionsOut

COURSE: dict[str, Any] = json.loads((Path(__file__).with_name("demo_course.json")).read_text())

SYLLABUS = SyllabusOut(course=COURSE["course"], units=[UnitOut(title=u["title"], topics=u["topics"]) for u in COURSE["units"]])
# Topic ids follow the numbering read_syllabus gives the outline: U1.T1, U1.T2, ...
TOPIC_NAMES = {f"U{i + 1}.T{j + 1}": name for i, u in enumerate(COURSE["units"]) for j, name in enumerate(u["topics"])}

WORD = re.compile(r"[a-z0-9]{4,}")
STOP = {"with", "from", "that", "this", "your", "each", "such", "into", "then", "than", "they", "have", "when", "what", "which", "must", "does", "only"}


def _words(text: str) -> set[str]:
    return set(WORD.findall(text.lower())) - STOP


def _text(parts: list[types.Part]) -> str:
    return "\n".join(p.text for p in parts if p.text)


def _video_id(parts: list[types.Part]) -> str | None:
    for p in parts:
        if p.file_data and p.file_data.file_uri:
            return p.file_data.file_uri.rsplit("=", 1)[-1]
    return None


def _questions(prompt: str) -> QuestionsOut:
    unit = re.search(r'unit "([^"]+)"', prompt)
    # The prompt numbers the unit's moments as '[i] Topic name: "Video" at ...'; point each
    # question at the first moment for its topic, or -1 when the playlist doesn't teach it.
    first_moment: dict[str, int] = {}
    for index, name in re.findall(r"^\[(\d+)\] (.+?): \"", prompt, re.M):
        first_moment.setdefault(name, int(index))
    questions = []
    for q in COURSE["questions"].get(unit.group(1) if unit else "", []):
        topic = TOPIC_NAMES.get(q.get("topic_id") or "")
        questions.append(QuestionOut(marks=q["marks"], text=q["text"], answer_points=q["answer_points"],
                                     moment_index=first_moment.get(topic, -1) if topic else -1))
    return QuestionsOut(questions=questions)


def _grade(prompt: str) -> GradeOut:
    max_score = int(re.search(r"Question \((\d+) points?\)", prompt).group(1))  # type: ignore[union-attr]
    points = re.findall(r"^- (.+)$", prompt.split("Expected answer points:")[1].split("<<<")[0], re.M)
    answer = _words(prompt.split("<<<", 1)[1].split(">>>", 1)[0])
    # A point counts when the answer uses at least 40% of its meaningful words.
    hit = [p for p in points if len(_words(p) & answer) >= max(1, math.ceil(0.4 * len(_words(p))))]
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
            analysis = COURSE["analyses"].get(_video_id(parts) or "", {"summary": "", "hits": []})
            return VideoOut(summary=analysis["summary"], hits=[HitOut(**h) for h in analysis["hits"]])
        if schema is QuestionsOut:
            return _questions(_text(parts))
        if schema is GradeOut:
            await asyncio.sleep(self.delay / 2)
            return _grade(_text(parts))
        raise TypeError(f"Demo mode has no recorded answer for {schema.__name__}")


def _handler(request: httpx.Request) -> httpx.Response:
    endpoint = request.url.path.rsplit("/", 1)[-1]
    videos = COURSE["videos"]
    if endpoint == "playlistItems":
        return httpx.Response(200, json={"items": [
            {"snippet": {"title": v["title"], "resourceId": {"videoId": v["id"]}}} for v in videos]})
    if endpoint == "videos":
        ids = request.url.params["id"].split(",")
        return httpx.Response(200, json={"items": [
            {"id": v["id"], "snippet": {"title": v["title"]}, "contentDetails": {"duration": f"PT{v['duration_s']}S"},
             "status": {"privacyStatus": "public"}} for v in videos if v["id"] in ids]})
    if endpoint == "search":
        # The pipeline searches "<topic name> <course> tutorial".
        query = request.url.params.get("q", "")
        found = next((s for topic, s in COURSE["suggestions"].items() if query.startswith(f"{topic} ")), [])
        return httpx.Response(200, json={"items": [
            {"id": {"videoId": s["id"]}, "snippet": {"title": s["title"], "channelTitle": s["channel"]}} for s in found]})
    return httpx.Response(404)


def demo_http() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(_handler))
