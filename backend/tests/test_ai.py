import pytest

from conftest import FakeLLM, make_syllabus, video_uri
from coursemap.ai import (
    HitOut, SyllabusError, SyllabusOut, UnitOut, VideoOut, analyze_video, clean_analysis, read_syllabus, to_syllabus,
)
from coursemap.models import TopicHit, Video

SYLLABUS_OUT = SyllabusOut(course="Operating Systems", units=[
    UnitOut(title="Processes", topics=["Process states", " Context switching "]),
    UnitOut(title="Lab list", topics=["", "  "]),
    UnitOut(title="Deadlocks", topics=["Banker's algorithm", "Deadlock recovery"]),
])

VIDEO = Video(id="vid3", title="L3 Deadlocks", position=2, duration_s=1200)


def test_to_syllabus_assigns_ids_and_drops_empty_units():
    assert to_syllabus(SYLLABUS_OUT) == make_syllabus()


def test_to_syllabus_with_no_topics_raises():
    with pytest.raises(SyllabusError):
        to_syllabus(SyllabusOut(course="X", units=[UnitOut(title="Empty", topics=[])]))


async def test_read_syllabus_sends_pdf_and_text():
    llm = FakeLLM({SyllabusOut: SYLLABUS_OUT})
    syllabus = await read_syllabus(llm, pdf=b"%PDF-1.4 fake", text="extra notes")
    assert syllabus.units[1].topics[0].id == "U2.T1"
    (_, parts), = llm.calls
    assert any(p.inline_data and p.inline_data.mime_type == "application/pdf" for p in parts)
    assert any(p.text and "extra notes" in p.text for p in parts)


def test_clean_analysis_validates_hits():
    out = VideoOut(summary=" Deadlocks lecture. ", hits=[
        HitOut(topic_id="u2.t1", start="5:00", depth="mentioned", key_points=["first pass"]),
        HitOut(topic_id="U2.T1", start="7:30", depth="explained", key_points=["Need = Max - Allocation", " "]),
        HitOut(topic_id="U2.T2", start="about 3 min", depth="mentioned", key_points=["kill a process"]),
        HitOut(topic_id="U1.T1", start="25:00", depth="explained", key_points=["beyond the video"]),
        HitOut(topic_id="U9.T9", start="1:00", depth="explained", key_points=["not in syllabus"]),
    ])
    analysis = clean_analysis(out, make_syllabus(), VIDEO)
    assert analysis.video_id == "vid3"
    assert analysis.summary == "Deadlocks lecture."
    assert analysis.hits == [
        TopicHit(topic_id="U1.T1", start_s=0, depth="explained", key_points=["beyond the video"]),
        TopicHit(topic_id="U2.T2", start_s=0, depth="mentioned", key_points=["kill a process"]),
        TopicHit(topic_id="U2.T1", start_s=450, depth="explained", key_points=["Need = Max - Allocation"]),
    ]


async def test_analyze_video_sends_youtube_url_and_topic_list():
    llm = FakeLLM({VideoOut: VideoOut(summary="s", hits=[])})
    await analyze_video(llm, make_syllabus(), VIDEO, fps=0.2)
    (_, parts), = llm.calls
    assert video_uri(parts) == "https://www.youtube.com/watch?v=vid3"
    prompt = next(p.text for p in parts if p.text)
    assert "U2.T1: Banker's algorithm" in prompt
    assert "20:00" in prompt
