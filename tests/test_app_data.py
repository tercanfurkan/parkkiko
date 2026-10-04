"""The two committed files the app reads must keep the promises docs/TODO.md makes about them.

These are contract tests, not unit tests: they run against the files in the repository, so they
fail if someone regenerates them with a change that would quietly break the frontend. The
frontend is written against the contract, not against the pipeline, and nothing else checks it.
"""
import json
from datetime import date
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
RULE_TYPES = {"paid", "free_limited", "banned_hours", "always_banned", "reserved", "unknown"}
STATUSES = {"official", "missing_hours", "uncertain"}
WINDOWS = {"mon_fri", "sat", "sun"}


@pytest.fixture(scope="module")
def areas():
    return json.loads((REPO / "web/public/data/parking_areas.geojson").read_text())["features"]


@pytest.fixture(scope="module")
def calendar():
    return json.loads((REPO / "web/public/data/holidays.json").read_text())


def test_every_area_has_what_the_app_always_reads(areas):
    for feature in areas:
        assert {"id", "rule_type", "status"} <= set(feature["properties"])


def test_absent_is_how_the_app_is_told_nothing(areas):
    """The contract says test for presence. A null or an empty string would read as a value
    and costs the same bytes as a real one."""
    for feature in areas:
        for key, value in feature["properties"].items():
            assert value is not None and value != "", f"{key} is empty rather than absent"


def test_only_the_documented_vocabularies_appear(areas):
    for feature in areas:
        props = feature["properties"]
        assert props["rule_type"] in RULE_TYPES
        assert props["status"] in STATUSES


def test_hours_arrive_as_an_object_the_app_can_use_directly(areas):
    """Not a JSON string. The parquet stores it as text; the app's file does not, so the
    frontend needs no parsing step."""
    for feature in areas:
        hours = feature["properties"].get("hours")
        if hours is None:
            continue
        assert isinstance(hours, dict), "hours must not need parsing in the browser"
        assert set(hours) <= WINDOWS
        for start, end in hours.values():
            assert 0 <= start <= 24 and 0 <= end <= 24


def test_season_arrives_as_an_object_too(areas):
    for feature in areas:
        season = feature["properties"].get("season")
        if season is None:
            continue
        assert isinstance(season, dict) and set(season) == {"start", "end"}


def test_an_uncertain_area_always_says_why(areas):
    """The app shows this sentence to a driver, so it cannot be missing."""
    for feature in areas:
        if feature["properties"]["status"] == "uncertain":
            assert feature["properties"].get("reason")


def test_geometry_is_what_a_map_can_draw(areas):
    for feature in areas:
        assert feature["geometry"]["type"] == "MultiPolygon"
        assert feature["geometry"]["coordinates"]


def test_the_calendar_still_covers_today(calendar):
    """It is generated for three years from the day it ran. Past that every date would fall
    through to its weekday, and Christmas would read as a Tuesday."""
    first, last = calendar["years"]
    assert first <= date.today().year <= last, "regenerate: python pipeline/export_holidays.py"


def test_calendar_entries_are_shaped_like_the_contract(calendar):
    for day, entry in calendar["days"].items():
        date.fromisoformat(day)
        assert entry["window"] in WINDOWS
        assert entry["name"]
        if "status" in entry:
            assert entry["status"] == "uncertain" and entry["reason"]


def test_the_days_we_are_unsure_about_are_still_flagged(calendar):
    """Christmas Eve is a holiday in the calendar and maybe not for parking. If this flag ever
    disappears, the app would tell drivers parking is free when it may be paid."""
    year = date.today().year
    eve = calendar["days"].get(f"{year}-12-24")
    assert eve and eve.get("status") == "uncertain"
