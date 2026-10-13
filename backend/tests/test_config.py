from coursemap.config import Settings, load_settings


def test_defaults_without_env(monkeypatch):
    for name in ["GEMINI_MODEL", "GOOGLE_GENAI_USE_VERTEXAI", "STORE", "MAX_VIDEOS", "VIDEO_FPS"]:
        monkeypatch.delenv(name, raising=False)
    s = load_settings()
    assert s.gemini_model == "gemini-2.5-flash"
    assert s.use_vertex is True
    assert s.store == "memory"
    assert s.max_videos == 20
    assert s.video_fps == 0.2


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "some-model")
    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "false")
    monkeypatch.setenv("MAX_VIDEOS", "3")
    monkeypatch.setenv("YOUTUBE_API_KEY", "yt")
    s = load_settings()
    assert (s.gemini_model, s.use_vertex, s.max_videos, s.youtube_api_key) == ("some-model", False, 3, "yt")


def test_settings_constructible_in_tests():
    assert Settings(youtube_api_key="k").video_concurrency == 4
