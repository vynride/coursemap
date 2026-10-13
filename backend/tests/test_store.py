from coursemap.models import Job
from coursemap.store import MemoryStore


async def test_memory_store_round_trip_and_isolation():
    store = MemoryStore()
    job = Job(id="j1", playlist_id="PL", exam_pattern="p")
    await store.put_job(job)
    job.status = "failed"  # mutating our copy must not change the stored one
    loaded = await store.get_job("j1")
    assert loaded is not None and loaded.status == "queued"
    assert await store.get_job("missing") is None


async def test_memory_store_cache():
    store = MemoryStore()
    assert await store.get_cache("k") is None
    await store.put_cache("k", {"a": 1})
    assert await store.get_cache("k") == {"a": 1}
