from conftest import make_syllabus
from coursemap.coverage import build_coverage
from coursemap.models import TopicHit, Video, VideoAnalysis

VIDEOS = [
    Video(id="vid1", title="L1 Processes", position=0, duration_s=600),
    Video(id="vid3", title="L3 Deadlocks", position=2, duration_s=1200),
]
ANALYSES = [
    VideoAnalysis(video_id="vid1", summary="", hits=[
        TopicHit(topic_id="U1.T1", start_s=90, depth="explained", key_points=["a"]),
        TopicHit(topic_id="U2.T1", start_s=500, depth="mentioned", key_points=["preview"]),
    ]),
    VideoAnalysis(video_id="vid3", summary="", hits=[
        TopicHit(topic_id="U2.T1", start_s=300, depth="explained", key_points=["need matrix"]),
        TopicHit(topic_id="U2.T2", start_s=900, depth="mentioned", key_points=["kill"]),
    ]),
]


def test_build_coverage_statuses_and_order():
    entries = build_coverage(make_syllabus(), VIDEOS, ANALYSES)
    assert [(e.topic_id, e.unit_id, e.status) for e in entries] == [
        ("U1.T1", "U1", "covered"),
        ("U1.T2", "U1", "gap"),
        ("U2.T1", "U2", "covered"),
        ("U2.T2", "U2", "partial"),
    ]
    bankers = entries[2]
    assert [(m.video_id, m.start_s, m.depth) for m in bankers.moments] == [
        ("vid3", 300, "explained"),
        ("vid1", 500, "mentioned"),
    ]
    assert bankers.moments[0].video_title == "L3 Deadlocks"
    assert bankers.moments[0].position == 2
    assert entries[1].moments == []


def test_build_coverage_ignores_analysis_for_unknown_video():
    stray = [VideoAnalysis(video_id="ghost", summary="", hits=[
        TopicHit(topic_id="U1.T2", start_s=1, depth="explained", key_points=[]),
    ])]
    entries = build_coverage(make_syllabus(), VIDEOS, stray)
    assert all(e.status == "gap" for e in entries)
