from typing import Literal

from pydantic import BaseModel, Field

Depth = Literal["explained", "mentioned"]
CoverageStatus = Literal["covered", "partial", "gap"]
JobStatus = Literal[
    "queued", "reading_syllabus", "fetching_playlist", "watching_videos", "writing_questions", "done", "failed"
]


class Topic(BaseModel):
    id: str
    name: str


class Unit(BaseModel):
    id: str
    title: str
    topics: list[Topic]


class Syllabus(BaseModel):
    course: str
    units: list[Unit]

    def topics_by_id(self) -> dict[str, Topic]:
        return {t.id: t for u in self.units for t in u.topics}


class Video(BaseModel):
    id: str
    title: str
    position: int
    duration_s: int


class Replacement(BaseModel):
    video_id: str
    title: str
    channel: str


class SkippedVideo(BaseModel):
    video_id: str
    title: str
    reason: str
    position: int = -1                                   # where it sat in the playlist
    replacements: list[Replacement] = Field(default_factory=list)   # videos to watch instead


class TopicHit(BaseModel):
    topic_id: str
    start_s: int
    depth: Depth
    key_points: list[str]


class VideoAnalysis(BaseModel):
    video_id: str
    summary: str
    hits: list[TopicHit]


class Moment(BaseModel):
    video_id: str
    video_title: str
    position: int
    start_s: int
    depth: Depth
    key_points: list[str]


class CoverageEntry(BaseModel):
    topic_id: str
    unit_id: str
    topic_name: str
    status: CoverageStatus
    moments: list[Moment]


class Suggestion(BaseModel):
    topic_id: str
    video_id: str
    title: str
    channel: str


class Question(BaseModel):
    id: str
    unit_id: str
    marks: int
    text: str
    answer_points: list[str]
    moment: Moment | None


class Grade(BaseModel):
    score: int
    max_score: int
    feedback: str
    missing_points: list[str]
    rewatch: Moment | None


class Job(BaseModel):
    id: str
    playlist_id: str
    exam_pattern: str
    status: JobStatus = "queued"
    progress_done: int = 0
    progress_total: int = 0
    error: str | None = None
    syllabus: Syllabus | None = None
    videos: list[Video] = Field(default_factory=list)
    analyses: list[VideoAnalysis] = Field(default_factory=list)
    skipped_videos: list[SkippedVideo] = Field(default_factory=list)
    coverage: list[CoverageEntry] = Field(default_factory=list)
    suggestions: list[Suggestion] = Field(default_factory=list)
    questions: list[Question] = Field(default_factory=list)
