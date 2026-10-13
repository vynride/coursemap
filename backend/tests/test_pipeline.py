import httpx

from conftest import FakeLLM, make_syllabus, video_uri
from coursemap.ai import HitOut, SyllabusOut, UnitOut, VideoOut
from coursemap.config import Settings
from coursemap.exam import QuestionOut, QuestionsOut
from coursemap.models import Job, SkippedVideo
from coursemap.pipeline import Deps, find_replacements, run_job
from coursemap.store import MemoryStore

SYLLABUS_OUT = SyllabusOut(course="Operating Systems", units=[
    UnitOut(title="Processes", topics=["Process states", "Context switching"]),
    UnitOut(title="Deadlocks", topics=["Banker's algorithm", "Deadlock recovery"]),
])


def video_response(parts):
    if video_uri(parts).endswith("vid1"):
        return VideoOut(summary="Processes.", hits=[
            HitOut(topic_id="U1.T1", start="1:30", depth="explained", key_points=["new, ready, running"]),
        ])
    return VideoOut(summary="Deadlocks.", hits=[
        HitOut(topic_id="U2.T1", start="5:00", depth="explained", key_points=["need = max - allocation"]),
        HitOut(topic_id="U2.T2", start="15:00", depth="mentioned", key_points=["kill a process"]),
    ])


QUESTIONS_OUT = QuestionsOut(questions=[
    QuestionOut(marks=2, text="Short question.", answer_points=["a", "b"], moment_index=0),
    QuestionOut(marks=7, text="Long question.", answer_points=["c"], moment_index=-1),
])


def make_llm(overrides=None):
    responses = {SyllabusOut: SYLLABUS_OUT, VideoOut: video_response, QuestionsOut: QUESTIONS_OUT}
    responses.update(overrides or {})
    return FakeLLM(responses)


async def start(deps, ref=("playlist", "PLtest")):
    await deps.store.put_job(Job(id="j1", playlist_id=ref[1], exam_pattern="2 and 7 marks"))
    await run_job("j1", ref, b"%PDF-1.4 fake", None, deps)
    return await deps.store.get_job("j1")


async def test_full_run(youtube_http):
    deps = Deps(llm=make_llm(), store=MemoryStore(), http=youtube_http, settings=Settings(youtube_api_key="k"))
    job = await start(deps)
    assert job.status == "done", job.error
    assert job.syllabus.course == "Operating Systems"
    assert [v.id for v in job.videos] == ["vid1", "vid3"]
    assert (job.progress_done, job.progress_total) == (2, 2)
    assert [a.video_id for a in job.analyses] == ["vid1", "vid3"]
    assert {s.video_id for s in job.skipped_videos} == {"vid2", "vid4", "vid5"}
    assert {s.video_id: s.position for s in job.skipped_videos} == {"vid2": 1, "vid4": 3, "vid5": 4}
    assert all([r.video_id for r in s.replacements] == ["sugg1"] for s in job.skipped_videos)
    assert [(c.topic_id, c.status) for c in job.coverage] == [
        ("U1.T1", "covered"), ("U1.T2", "gap"), ("U2.T1", "covered"), ("U2.T2", "partial"),
    ]
    assert [(s.topic_id, s.video_id, s.title) for s in job.suggestions] == [
        ("U1.T2", "sugg1", "Context switching & PCB"),
    ]
    assert [q.id for q in job.questions] == ["U1.Q1", "U1.Q2", "U2.Q1", "U2.Q2"]
    assert job.questions[2].moment.video_id == "vid3"


async def test_one_failed_video_does_not_fail_job(youtube_http):
    def flaky(parts):
        if video_uri(parts).endswith("vid3"):
            raise RuntimeError("model blew up")
        return video_response(parts)

    deps = Deps(llm=make_llm({VideoOut: flaky}), store=MemoryStore(), http=youtube_http,
                settings=Settings(youtube_api_key="k"))
    job = await start(deps)
    assert job.status == "done"
    assert [a.video_id for a in job.analyses] == ["vid1"]
    failed = [s for s in job.skipped_videos if s.video_id == "vid3"]
    assert failed and failed[0].reason.startswith("Couldn't analyse")


async def test_all_videos_failing_fails_job(youtube_http):
    deps = Deps(llm=make_llm({VideoOut: RuntimeError("down")}), store=MemoryStore(), http=youtube_http,
                settings=Settings(youtube_api_key="k"))
    job = await start(deps)
    assert job.status == "failed"
    assert "Couldn't analyse any video" in job.error


async def test_bad_playlist_fails_job_with_message(youtube_http):
    deps = Deps(llm=make_llm(), store=MemoryStore(), http=youtube_http, settings=Settings(youtube_api_key="k"))
    job = await start(deps, ref=("playlist", "PLnope"))
    assert job.status == "failed"
    assert "not found" in job.error


async def test_second_run_uses_cache(youtube_http):
    store = MemoryStore()
    first = make_llm()
    await start(Deps(llm=first, store=store, http=youtube_http, settings=Settings(youtube_api_key="k")))
    second = make_llm()
    job = await start(Deps(llm=second, store=store, http=youtube_http, settings=Settings(youtube_api_key="k")))
    assert job.status == "done"
    called = [schema for schema, _ in second.calls]
    assert SyllabusOut not in called and VideoOut not in called
    assert called.count(QuestionsOut) == 2


async def test_replacements_skip_videos_already_in_the_playlist():
    def handler(request):
        return httpx.Response(200, json={"items": [
            {"id": {"videoId": "vid1"}, "snippet": {"title": "Already there", "channelTitle": "C"}},
            {"id": {"videoId": "new1"}, "snippet": {"title": "Fresh one", "channelTitle": "C"}},
        ]})

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    deps = Deps(llm=make_llm(), store=MemoryStore(), http=http, settings=Settings(youtube_api_key="k"))
    skipped = [SkippedVideo(video_id="gone", title="Private video", reason="private or deleted", position=1)]
    result = await find_replacements(deps, make_syllabus(), skipped, {"vid1"})
    assert [r.video_id for r in result[0].replacements] == ["new1"]
