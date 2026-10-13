import html
from urllib.parse import parse_qs, urlparse

import httpx

from coursemap.models import SkippedVideo, Video
from coursemap.timestamps import parse_iso_duration

API = "https://www.googleapis.com/youtube/v3"
VideoRef = tuple[str, str]


class YouTubeError(Exception):
    pass


def parse_playlist_ref(url: str) -> VideoRef:
    """Return ("playlist", id) or ("video", id) for a YouTube link."""
    parsed = urlparse(url.strip())
    host = parsed.netloc.lower().removeprefix("www.").removeprefix("m.")
    query = parse_qs(parsed.query)
    if host in ("youtube.com", "music.youtube.com", "youtu.be"):
        if "list" in query:
            return ("playlist", query["list"][0])
        if host == "youtu.be" and parsed.path.strip("/"):
            return ("video", parsed.path.strip("/"))
        if parsed.path == "/watch" and "v" in query:
            return ("video", query["v"][0])
    raise ValueError("Paste a YouTube playlist link (youtube.com/playlist?list=...) or a video link.")


async def _get(client: httpx.AsyncClient, endpoint: str, params: dict) -> dict:
    try:
        response = await client.get(f"{API}/{endpoint}", params=params)
    except httpx.HTTPError as e:
        raise YouTubeError(f"Couldn't reach YouTube: {e}") from e
    if response.status_code == 404:
        raise YouTubeError("Playlist not found. Check the link and that the playlist is public.")
    if response.status_code >= 400:
        raise YouTubeError(f"YouTube API error {response.status_code}")
    return response.json()


async def _playlist_items(client: httpx.AsyncClient, key: str, playlist_id: str, limit: int) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    token = None
    while len(items) < limit:
        params = {"part": "snippet", "playlistId": playlist_id, "maxResults": 50, "key": key}
        if token:
            params["pageToken"] = token
        data = await _get(client, "playlistItems", params)
        for item in data.get("items", []):
            snippet = item["snippet"]
            items.append((snippet["resourceId"]["videoId"], snippet.get("title", "")))
        token = data.get("nextPageToken")
        if not token:
            break
    return items[:limit]


async def fetch_videos(
    client: httpx.AsyncClient, key: str, ref: VideoRef, limit: int
) -> tuple[list[Video], list[SkippedVideo]]:
    kind, ident = ref
    listed = await _playlist_items(client, key, ident, limit) if kind == "playlist" else [(ident, "")]
    if not listed:
        raise YouTubeError("That playlist is empty.")
    data = await _get(
        client, "videos", {"part": "snippet,contentDetails,status", "id": ",".join(v for v, _ in listed), "key": key}
    )
    found = {item["id"]: item for item in data.get("items", [])}
    videos: list[Video] = []
    skipped: list[SkippedVideo] = []
    for position, (video_id, listed_title) in enumerate(listed):
        item = found.get(video_id)
        if item is None:
            skipped.append(SkippedVideo(video_id=video_id, title=listed_title, reason="private or deleted"))
            continue
        title = item["snippet"]["title"]
        if item.get("status", {}).get("privacyStatus") != "public":
            skipped.append(SkippedVideo(video_id=video_id, title=title, reason="not public"))
            continue
        duration = parse_iso_duration(item.get("contentDetails", {}).get("duration", ""))
        if duration == 0:
            skipped.append(SkippedVideo(video_id=video_id, title=title, reason="live or upcoming"))
            continue
        videos.append(Video(id=video_id, title=title, position=position, duration_s=duration))
    return videos, skipped


async def search_videos(client: httpx.AsyncClient, key: str, query: str, n: int = 2) -> list[dict[str, str]]:
    data = await _get(
        client,
        "search",
        {"part": "snippet", "q": query, "type": "video", "maxResults": n, "videoEmbeddable": "true", "key": key},
    )
    return [
        {
            "video_id": item["id"]["videoId"],
            "title": html.unescape(item["snippet"]["title"]),
            "channel": html.unescape(item["snippet"]["channelTitle"]),
        }
        for item in data.get("items", [])
        if item.get("id", {}).get("videoId")
    ]
