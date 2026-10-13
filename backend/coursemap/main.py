import logging

import httpx

from coursemap.ai import GeminiLLM
from coursemap.api import create_app
from coursemap.config import load_settings
from coursemap.pipeline import Deps
from coursemap.store import make_store

logging.basicConfig(level=logging.INFO)
settings = load_settings()
app = create_app(Deps(
    llm=GeminiLLM(settings),
    store=make_store(settings),
    http=httpx.AsyncClient(timeout=30),
    settings=settings,
))
