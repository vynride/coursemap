import pytest

from coursemap.timestamps import fmt_ts, parse_iso_duration, parse_timestamp


@pytest.mark.parametrize(
    "text,expected",
    [("0:00", 0), ("4:05", 245), ("12:34", 754), ("1:02:03", 3723), (" 07:09 ", 429), ("90", 90), ("75:30", 4530)],
)
def test_parse_timestamp_valid(text, expected):
    assert parse_timestamp(text) == expected


@pytest.mark.parametrize("text", ["", "abc", "4:5", "4:75", "1:2:3:4", "-1:00", "about 3 min"])
def test_parse_timestamp_invalid(text):
    assert parse_timestamp(text) is None


@pytest.mark.parametrize(
    "text,expected",
    [("PT4M13S", 253), ("PT1H2M3S", 3723), ("PT45S", 45), ("P0D", 0), ("P1DT1S", 86401), ("garbage", 0), ("", 0)],
)
def test_parse_iso_duration(text, expected):
    assert parse_iso_duration(text) == expected


@pytest.mark.parametrize("seconds,expected", [(0, "0:00"), (754, "12:34"), (3723, "1:02:03")])
def test_fmt_ts(seconds, expected):
    assert fmt_ts(seconds) == expected
