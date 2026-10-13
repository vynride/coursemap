"""Prove Gemini can watch a public YouTube lecture from this project.

Usage (from backend/): uv run --env-file .env python scripts/smoke_gemini.py <youtube_video_id>
"""

import asyncio
import os
import sys
import time

from google import genai
from google.genai import types


async def main(video_id: str) -> None:
    client = genai.Client()  # reads GOOGLE_GENAI_USE_VERTEXAI / GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION or GEMINI_API_KEY
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    fps = float(os.environ.get("VIDEO_FPS", "0.2"))
    video = types.Part(
        file_data=types.FileData(file_uri=f"https://www.youtube.com/watch?v={video_id}", mime_type="video/mp4"),
        video_metadata=types.VideoMetadata(fps=fps) if fps > 0 else None,
    )
    started = time.monotonic()
    response = await client.aio.models.generate_content(
        model=model,
        contents=[video, types.Part.from_text(text="List the topics taught in this lecture, each with the MM:SS timestamp where it starts.")],
        config=types.GenerateContentConfig(media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW),
    )
    print(response.text)
    print(f"\nmodel={model} seconds={time.monotonic() - started:.1f} usage={response.usage_metadata}")


asyncio.run(main(sys.argv[1]))
