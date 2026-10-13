import httpx
import pytest

from coursemap.models import Syllabus, Topic, Unit


class FakeLLM:
    """Stands in for Gemini. `responses` maps an output schema class to either a
    model instance, a function(parts) -> model instance, or an exception to raise."""

    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    async def generate(self, parts, schema):
        self.calls.append((schema, parts))
        response = self.responses[schema]
        if isinstance(response, Exception):
            raise response
        return response(parts) if callable(response) else response


def video_uri(parts) -> str | None:
    return next((p.file_data.file_uri for p in parts if getattr(p, "file_data", None)), None)


def make_syllabus() -> Syllabus:
    return Syllabus(
        course="Operating Systems",
        units=[
            Unit(id="U1", title="Processes", topics=[
                Topic(id="U1.T1", name="Process states"),
                Topic(id="U1.T2", name="Context switching"),
            ]),
            Unit(id="U2", title="Deadlocks", topics=[
                Topic(id="U2.T1", name="Banker's algorithm"),
                Topic(id="U2.T2", name="Deadlock recovery"),
            ]),
        ],
    )


def _item(video_id, title):
    return {"snippet": {"title": title, "resourceId": {"videoId": video_id}}}


def _video(video_id, title, duration, privacy="public"):
    return {"id": video_id, "snippet": {"title": title}, "contentDetails": {"duration": duration},
            "status": {"privacyStatus": privacy}}


def youtube_handler(request: httpx.Request) -> httpx.Response:
    endpoint = request.url.path.rsplit("/", 1)[-1]
    if endpoint == "playlistItems":
        if request.url.params["playlistId"] != "PLtest":
            return httpx.Response(404, json={"error": {"code": 404}})
        return httpx.Response(200, json={"items": [
            _item("vid1", "L1 Processes"),
            _item("vid2", "Private video"),
            _item("vid3", "L3 Deadlocks"),
            _item("vid4", "L4 Live revision"),
            _item("vid5", "L5 Unlisted extra"),
        ]})
    if endpoint == "videos":
        catalog = {
            "vid1": _video("vid1", "L1 Processes", "PT10M"),
            "vid3": _video("vid3", "L3 Deadlocks", "PT20M"),
            "vid4": _video("vid4", "L4 Live revision", "P0D"),
            "vid5": _video("vid5", "L5 Unlisted extra", "PT5M", privacy="unlisted"),
            "single": _video("single", "One-off lecture", "PT8M"),
        }
        ids = request.url.params["id"].split(",")
        return httpx.Response(200, json={"items": [catalog[i] for i in ids if i in catalog]})
    if endpoint == "search":
        return httpx.Response(200, json={"items": [
            {"id": {"videoId": "sugg1"}, "snippet": {"title": "Context switching &amp; PCB", "channelTitle": "Some Channel"}},
        ]})
    return httpx.Response(404)


@pytest.fixture
def youtube_http():
    return httpx.AsyncClient(transport=httpx.MockTransport(youtube_handler))
