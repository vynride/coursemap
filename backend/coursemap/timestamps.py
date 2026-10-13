import re

_CLOCK = re.compile(r"^(?:(\d+):)?(\d{1,2}):(\d{2})$")
_ISO = re.compile(r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")


def parse_timestamp(text: str) -> int | None:
    """Parse "M:SS", "MM:SS", "H:MM:SS" or plain seconds. Returns None if unparseable."""
    text = text.strip()
    if text.isdigit():
        return int(text)
    match = _CLOCK.match(text)
    if not match:
        return None
    hours, minutes, seconds = match.groups()
    if int(seconds) >= 60:
        return None
    return int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds)


def parse_iso_duration(text: str) -> int:
    """Parse a YouTube ISO 8601 duration like PT1H2M3S. Returns 0 for live streams or bad input."""
    match = _ISO.match(text)
    if not match:
        return 0
    days, hours, minutes, seconds = (int(x or 0) for x in match.groups())
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def fmt_ts(seconds: int) -> str:
    hours, rest = divmod(int(seconds), 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}" if hours else f"{minutes}:{secs:02d}"
