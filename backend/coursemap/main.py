import dataclasses
import logging

import httpx

from coursemap.ai import GeminiLLM
from coursemap.api import create_app
from coursemap.config import load_settings
from coursemap.pipeline import Deps
from coursemap.store import make_store

logging.basicConfig(level=logging.INFO)
settings = load_settings()
if settings.demo:
    from coursemap.demo import DemoLLM, demo_http

    # In-memory store so canned results never land in the real Firestore cache.
    settings = dataclasses.replace(settings, store="memory", youtube_api_key="demo", max_videos=50)
    logging.getLogger(__name__).warning("DEMO mode: canned Docker course, no Gemini or YouTube calls")
    deps = Deps(llm=DemoLLM(), store=make_store(settings), http=demo_http(), settings=settings)
else:
    deps = Deps(llm=GeminiLLM(settings), store=make_store(settings), http=httpx.AsyncClient(timeout=30), settings=settings)
app = create_app(deps)
