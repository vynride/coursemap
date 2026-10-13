import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    gemini_model: str = "gemini-2.5-flash"
    use_vertex: bool = True
    gcp_project: str | None = None
    gcp_location: str = "us-central1"
    gemini_api_key: str | None = None
    youtube_api_key: str = ""
    store: str = "memory"
    static_dir: str = ""
    max_videos: int = 12
    video_concurrency: int = 4
    video_fps: float = 0.2
    video_timeout_s: float = 300
    max_gap_searches: int = 6


def load_settings() -> Settings:
    env = os.environ
    return Settings(
        gemini_model=env.get("GEMINI_MODEL", Settings.gemini_model),
        use_vertex=env.get("GOOGLE_GENAI_USE_VERTEXAI", "true").lower() in ("1", "true", "yes"),
        gcp_project=env.get("GOOGLE_CLOUD_PROJECT") or None,
        gcp_location=env.get("GOOGLE_CLOUD_LOCATION", Settings.gcp_location),
        gemini_api_key=env.get("GEMINI_API_KEY") or None,
        youtube_api_key=env.get("YOUTUBE_API_KEY", ""),
        store=env.get("STORE", Settings.store),
        static_dir=env.get("STATIC_DIR", ""),
        max_videos=int(env.get("MAX_VIDEOS", Settings.max_videos)),
        video_concurrency=int(env.get("VIDEO_CONCURRENCY", Settings.video_concurrency)),
        video_fps=float(env.get("VIDEO_FPS", Settings.video_fps)),
        video_timeout_s=float(env.get("VIDEO_TIMEOUT_S", Settings.video_timeout_s)),
        max_gap_searches=int(env.get("MAX_GAP_SEARCHES", Settings.max_gap_searches)),
    )
