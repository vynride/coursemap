import copy
import hashlib
from typing import Any, Protocol

from coursemap.config import Settings
from coursemap.models import Job


class Store(Protocol):
    async def get_job(self, job_id: str) -> Job | None: ...
    async def put_job(self, job: Job) -> None: ...
    async def get_cache(self, key: str) -> dict[str, Any] | None: ...
    async def put_cache(self, key: str, value: dict[str, Any]) -> None: ...


class MemoryStore:
    def __init__(self) -> None:
        self._jobs: dict[str, dict] = {}
        self._cache: dict[str, dict] = {}

    async def get_job(self, job_id: str) -> Job | None:
        data = self._jobs.get(job_id)
        return Job.model_validate(data) if data is not None else None

    async def put_job(self, job: Job) -> None:
        self._jobs[job.id] = job.model_dump(mode="json")

    async def get_cache(self, key: str) -> dict[str, Any] | None:
        value = self._cache.get(key)
        return copy.deepcopy(value) if value is not None else None

    async def put_cache(self, key: str, value: dict[str, Any]) -> None:
        self._cache[key] = copy.deepcopy(value)


def _doc_id(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


class FirestoreStore:
    def __init__(self, project: str | None) -> None:
        from google.cloud import firestore

        self._db = firestore.AsyncClient(project=project)

    async def get_job(self, job_id: str) -> Job | None:
        snap = await self._db.collection("jobs").document(job_id).get()
        return Job.model_validate(snap.to_dict()) if snap.exists else None

    async def put_job(self, job: Job) -> None:
        await self._db.collection("jobs").document(job.id).set(job.model_dump(mode="json"))

    async def get_cache(self, key: str) -> dict[str, Any] | None:
        snap = await self._db.collection("cache").document(_doc_id(key)).get()
        return snap.to_dict()["value"] if snap.exists else None

    async def put_cache(self, key: str, value: dict[str, Any]) -> None:
        await self._db.collection("cache").document(_doc_id(key)).set({"key": key, "value": value})


def make_store(settings: Settings) -> Store:
    return FirestoreStore(settings.gcp_project) if settings.store == "firestore" else MemoryStore()
