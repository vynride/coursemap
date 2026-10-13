import asyncio
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from coursemap.exam import DEFAULT_PATTERN, grade_answer
from coursemap.models import Grade, Job
from coursemap.pipeline import Deps, run_job
from coursemap.youtube import parse_playlist_ref

MAX_PDF_BYTES = 15 * 1024 * 1024


class GradeRequest(BaseModel):
    question_id: str
    answer: str = Field(max_length=5000)


def create_app(deps: Deps) -> FastAPI:
    app = FastAPI(title="CourseMap")
    running: set[asyncio.Task] = set()

    @app.get("/api/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    @app.post("/api/jobs")
    async def create_job(
        playlist_url: Annotated[str, Form()],
        exam_pattern: Annotated[str, Form()] = "",
        syllabus_text: Annotated[str, Form()] = "",
        syllabus_pdf: Annotated[UploadFile | None, File()] = None,
    ) -> dict[str, str]:
        try:
            ref = parse_playlist_ref(playlist_url)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        pdf = await syllabus_pdf.read() if syllabus_pdf is not None else None
        if pdf is not None and len(pdf) == 0:
            pdf = None
        if pdf is not None and not pdf.startswith(b"%PDF"):
            raise HTTPException(400, "The outline file must be a PDF.")
        if pdf is not None and len(pdf) > MAX_PDF_BYTES:
            raise HTTPException(400, "The outline PDF must be under 15 MB.")
        text = syllabus_text.strip() or None
        if pdf is None and text is None:
            raise HTTPException(400, "Upload an outline PDF or paste the topics you want to learn.")
        job = Job(id=uuid.uuid4().hex[:12], playlist_id=ref[1], exam_pattern=exam_pattern.strip() or DEFAULT_PATTERN)
        await deps.store.put_job(job)
        task = asyncio.create_task(run_job(job.id, ref, pdf, text, deps))
        running.add(task)
        task.add_done_callback(running.discard)
        return {"job_id": job.id}

    @app.get("/api/jobs/{job_id}")
    async def get_job(job_id: str) -> Job:
        job = await deps.store.get_job(job_id)
        if job is None:
            raise HTTPException(404, "Job not found.")
        return job

    @app.post("/api/jobs/{job_id}/grade")
    async def grade(job_id: str, request: GradeRequest) -> Grade:
        job = await deps.store.get_job(job_id)
        if job is None:
            raise HTTPException(404, "Job not found.")
        question = next((q for q in job.questions if q.id == request.question_id), None)
        if question is None:
            raise HTTPException(404, "Question not found.")
        return await grade_answer(deps.llm, question, request.answer)

    static = deps.settings.static_dir
    if static and Path(static).is_dir():
        app.mount("/", StaticFiles(directory=static, html=True), name="static")
    return app
