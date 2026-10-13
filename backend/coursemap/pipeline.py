import asyncio
import hashlib
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TypeVar

import httpx
from pydantic import BaseModel

from coursemap.ai import LLM, analyze_video, read_syllabus
from coursemap.config import Settings
from coursemap.coverage import build_coverage
from coursemap.exam import make_questions
from coursemap.models import CoverageEntry, SkippedVideo, Suggestion, Syllabus, Video, VideoAnalysis
from coursemap.store import Store
from coursemap.youtube import VideoRef, YouTubeError, fetch_videos, search_videos

log = logging.getLogger(__name__)
M = TypeVar("M", bound=BaseModel)


@dataclass
class Deps:
    llm: LLM
    store: Store
    http: httpx.AsyncClient
    settings: Settings


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]


async def cached(store: Store, key: str, model: type[M], make: Callable[[], Awaitable[M]]) -> M:
    hit = await store.get_cache(key)
    if hit is not None:
        return model.model_validate(hit)
    value = await make()
    await store.put_cache(key, value.model_dump(mode="json"))
    return value


async def suggest_for_gaps(deps: Deps, syllabus: Syllabus, coverage: list[CoverageEntry]) -> list[Suggestion]:
    key = deps.settings.youtube_api_key
    if not key:
        return []
    gaps = [e for e in coverage if e.status == "gap"][: deps.settings.max_gap_searches]

    async def one(entry: CoverageEntry) -> list[Suggestion]:
        try:
            found = await search_videos(deps.http, key, f"{entry.topic_name} {syllabus.course} lecture")
        except YouTubeError:
            log.warning("search failed for %s", entry.topic_id)
            return []
        return [Suggestion(topic_id=entry.topic_id, **f) for f in found]

    results = await asyncio.gather(*(one(e) for e in gaps))
    return [s for r in results for s in r]


async def run_job(job_id: str, ref: VideoRef, pdf: bytes | None, text: str | None, deps: Deps) -> None:
    store, settings = deps.store, deps.settings
    job = await store.get_job(job_id)
    if job is None:
        return
    try:
        job.status = "reading_syllabus"
        await store.put_job(job)
        source = pdf if pdf else (text or "").encode()
        syllabus = await cached(
            store, f"syllabus:{settings.gemini_model}:{_digest(source)}", Syllabus,
            lambda: read_syllabus(deps.llm, pdf=pdf, text=text),
        )
        job.syllabus = syllabus
        job.status = "fetching_playlist"
        await store.put_job(job)

        videos, skipped = await fetch_videos(deps.http, settings.youtube_api_key, ref, settings.max_videos)
        if not videos:
            raise YouTubeError("No public videos found at that link.")
        job.videos, job.skipped_videos = videos, skipped
        job.status, job.progress_done, job.progress_total = "watching_videos", 0, len(videos)
        await store.put_job(job)

        syllabus_key = _digest(syllabus.model_dump_json().encode())
        limit = asyncio.Semaphore(settings.video_concurrency)

        async def watch(video: Video) -> None:
            async with limit:
                try:
                    analysis = await cached(
                        store, f"video:{settings.gemini_model}:{video.id}:{syllabus_key}", VideoAnalysis,
                        lambda: asyncio.wait_for(
                            analyze_video(deps.llm, syllabus, video, settings.video_fps), settings.video_timeout_s,
                        ),
                    )
                    job.analyses.append(analysis)
                except Exception as e:
                    log.exception("analysis failed for %s", video.id)
                    job.skipped_videos.append(SkippedVideo(
                        video_id=video.id, title=video.title, reason=f"Couldn't analyse: {type(e).__name__}",
                    ))
                job.progress_done += 1
                await store.put_job(job)

        await asyncio.gather(*(watch(v) for v in videos))
        if not job.analyses:
            raise RuntimeError("Couldn't analyse any video in this playlist. Try again in a minute.")
        position = {v.id: v.position for v in videos}
        job.analyses.sort(key=lambda a: position[a.video_id])
        job.coverage = build_coverage(syllabus, videos, job.analyses)
        job.status = "writing_questions"
        await store.put_job(job)

        per_unit, suggestions = await asyncio.gather(
            asyncio.gather(
                *(make_questions(deps.llm, syllabus.course, u, job.coverage, job.exam_pattern) for u in syllabus.units),
                return_exceptions=True,
            ),
            suggest_for_gaps(deps, syllabus, job.coverage),
        )
        for result in per_unit:
            if isinstance(result, BaseException):
                log.error("question writing failed: %r", result)
        job.questions = [q for r in per_unit if not isinstance(r, BaseException) for q in r]
        job.suggestions = suggestions
        job.status = "done"
        await store.put_job(job)
    except Exception as e:
        log.exception("job %s failed", job_id)
        job.status = "failed"
        job.error = (str(e) or type(e).__name__)[:300]
        await store.put_job(job)
