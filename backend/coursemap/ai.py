from typing import Literal, Protocol, TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel

from coursemap.config import Settings
from coursemap.models import Syllabus, Topic, TopicHit, Unit, Video, VideoAnalysis
from coursemap.timestamps import fmt_ts, parse_timestamp

T = TypeVar("T", bound=BaseModel)


class LLM(Protocol):
    async def generate(self, parts: list[types.Part], schema: type[T]) -> T: ...


class GeminiLLM:
    def __init__(self, settings: Settings) -> None:
        if settings.use_vertex:
            self._client = genai.Client(vertexai=True, project=settings.gcp_project, location=settings.gcp_location)
        else:
            self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_model

    async def generate(self, parts: list[types.Part], schema: type[T]) -> T:
        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.2,
                media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW,
            ),
        )
        if not response.text:
            raise RuntimeError("Gemini returned an empty response")
        return schema.model_validate_json(response.text)


def text_part(text: str) -> types.Part:
    return types.Part.from_text(text=text)


def pdf_part(data: bytes) -> types.Part:
    return types.Part.from_bytes(data=data, mime_type="application/pdf")


def youtube_part(video_id: str, fps: float) -> types.Part:
    return types.Part(
        file_data=types.FileData(file_uri=f"https://www.youtube.com/watch?v={video_id}", mime_type="video/mp4"),
        video_metadata=types.VideoMetadata(fps=fps) if fps > 0 else None,
    )


# ---- Syllabus ----

class UnitOut(BaseModel):
    title: str
    topics: list[str]


class SyllabusOut(BaseModel):
    course: str
    units: list[UnitOut]


class SyllabusError(ValueError):
    pass


SYLLABUS_PROMPT = """You are reading a university course syllabus.
Return the course name and every unit or module in order. For each unit, list its topics as short names,
worded as in the syllabus. Split comma-separated topic lists into separate topics.
Ignore textbooks, course outcomes, marks distribution, lab experiments and reference lists."""


def to_syllabus(out: SyllabusOut) -> Syllabus:
    units: list[Unit] = []
    for unit in out.units:
        names = [t.strip() for t in unit.topics if t.strip()]
        if not names:
            continue
        unit_id = f"U{len(units) + 1}"
        topics = [Topic(id=f"{unit_id}.T{i + 1}", name=name) for i, name in enumerate(names)]
        units.append(Unit(id=unit_id, title=unit.title.strip(), topics=topics))
    if not units:
        raise SyllabusError("Couldn't find any units or topics in that syllabus.")
    return Syllabus(course=out.course.strip() or "Course", units=units)


async def read_syllabus(llm: LLM, *, pdf: bytes | None, text: str | None) -> Syllabus:
    parts = [text_part(SYLLABUS_PROMPT)]
    if pdf:
        parts.append(pdf_part(pdf))
    if text:
        parts.append(text_part(f"Syllabus text:\n{text}"))
    return to_syllabus(await llm.generate(parts, SyllabusOut))


# ---- Video analysis ----

class HitOut(BaseModel):
    topic_id: str
    start: str
    depth: Literal["explained", "mentioned"]
    key_points: list[str]


class VideoOut(BaseModel):
    summary: str
    hits: list[HitOut]


def video_prompt(syllabus: Syllabus, video: Video) -> str:
    topics = "\n".join(f"{t.id}: {t.name}" for u in syllabus.units for t in u.topics)
    return f"""You are watching a university lecture video titled "{video.title}" ({fmt_ts(video.duration_s)} long).

Syllabus topics (id: name):
{topics}

For every syllabus topic this video actually teaches, return a hit with:
- topic_id: the id from the list above, exactly as written
- start: the timestamp (M:SS or H:MM:SS) where the lecturer starts on that topic
- depth: "explained" if the lecturer teaches it properly, "mentioned" if it only comes up in passing
- key_points: 2 to 4 short facts the lecturer states about it, in the lecturer's own terms
Leave out topics the video does not cover. Also give a two-sentence summary of the video."""


def _rank(hit: TopicHit) -> tuple[bool, int]:
    return (hit.depth != "explained", hit.start_s)


def clean_analysis(out: VideoOut, syllabus: Syllabus, video: Video) -> VideoAnalysis:
    """Drop unknown topics, validate timestamps, keep the best hit per topic."""
    known = syllabus.topics_by_id()
    order = {topic_id: i for i, topic_id in enumerate(known)}
    best: dict[str, TopicHit] = {}
    for raw in out.hits:
        topic_id = raw.topic_id.strip().upper()
        if topic_id not in known:
            continue
        start = parse_timestamp(raw.start)
        if start is None or start >= video.duration_s:
            start = 0
        hit = TopicHit(
            topic_id=topic_id,
            start_s=start,
            depth=raw.depth,
            key_points=[p.strip() for p in raw.key_points if p.strip()][:4],
        )
        if topic_id not in best or _rank(hit) < _rank(best[topic_id]):
            best[topic_id] = hit
    hits = sorted(best.values(), key=lambda h: (h.start_s, order[h.topic_id]))
    return VideoAnalysis(video_id=video.id, summary=out.summary.strip(), hits=hits)


async def analyze_video(llm: LLM, syllabus: Syllabus, video: Video, fps: float) -> VideoAnalysis:
    out = await llm.generate([youtube_part(video.id, fps), text_part(video_prompt(syllabus, video))], VideoOut)
    return clean_analysis(out, syllabus, video)
