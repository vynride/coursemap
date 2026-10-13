import pytest

from coursemap.models import Video
from coursemap.youtube import YouTubeError, fetch_videos, parse_playlist_ref, search_videos


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://www.youtube.com/playlist?list=PLabc123", ("playlist", "PLabc123")),
        ("https://youtube.com/watch?v=abcdefghijk&list=PLabc123&index=2", ("playlist", "PLabc123")),
        ("https://youtu.be/abcdefghijk?list=PLabc123", ("playlist", "PLabc123")),
        ("https://youtu.be/abcdefghijk", ("video", "abcdefghijk")),
        ("https://m.youtube.com/watch?v=abcdefghijk", ("video", "abcdefghijk")),
        ("  https://www.youtube.com/watch?v=abcdefghijk  ", ("video", "abcdefghijk")),
    ],
)
def test_parse_playlist_ref(url, expected):
    assert parse_playlist_ref(url) == expected


@pytest.mark.parametrize("url", ["https://vimeo.com/123", "not a url", "https://www.youtube.com/", ""])
def test_parse_playlist_ref_rejects(url):
    with pytest.raises(ValueError):
        parse_playlist_ref(url)


async def test_fetch_videos_skips_unusable(youtube_http):
    videos, skipped = await fetch_videos(youtube_http, "k", ("playlist", "PLtest"), limit=12)
    assert videos == [
        Video(id="vid1", title="L1 Processes", position=0, duration_s=600),
        Video(id="vid3", title="L3 Deadlocks", position=2, duration_s=1200),
    ]
    assert [(s.video_id, s.reason) for s in skipped] == [
        ("vid2", "private or deleted"),
        ("vid4", "live or upcoming"),
        ("vid5", "not public"),
    ]


async def test_fetch_videos_respects_limit(youtube_http):
    videos, skipped = await fetch_videos(youtube_http, "k", ("playlist", "PLtest"), limit=1)
    assert [v.id for v in videos] == ["vid1"]
    assert skipped == []


async def test_fetch_single_video(youtube_http):
    videos, _ = await fetch_videos(youtube_http, "k", ("video", "single"), limit=12)
    assert videos == [Video(id="single", title="One-off lecture", position=0, duration_s=480)]


async def test_fetch_missing_playlist_raises(youtube_http):
    with pytest.raises(YouTubeError, match="not found"):
        await fetch_videos(youtube_http, "k", ("playlist", "PLnope"), limit=12)


async def test_search_unescapes_titles(youtube_http):
    found = await search_videos(youtube_http, "k", "context switching")
    assert found == [{"video_id": "sugg1", "title": "Context switching & PCB", "channel": "Some Channel"}]
