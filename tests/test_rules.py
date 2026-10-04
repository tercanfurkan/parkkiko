"""The parsers must fail closed.

Every case below that expects an issue is one the parsers once answered confidently and
wrongly. Those are the regressions worth guarding: a silently truncated rule reads as a correct
one, so nothing fails except the driver getting a fine.
"""
from datetime import date

import pytest

import rules

# ----------------------------------------------------------------- hours


@pytest.mark.parametrize("raw, expected", [
    ("9-21", {"mon_fri": [9, 21]}),
    ("9-21, (9-18)", {"mon_fri": [9, 21], "sat": [9, 18]}),
    ("9-21, (9-21), 9-21", {"mon_fri": [9, 21], "sat": [9, 21], "sun": [9, 21]}),
    ("7-18 (7-15)", {"mon_fri": [7, 18], "sat": [7, 15]}),   # no comma before the bracket
    ("9.21, (9-18)", {"mon_fri": [9, 21], "sat": [9, 18]}),  # '.' typed for '-'
    ("7 - 17", {"mon_fri": [7, 17]}),                        # spaces around the dash
    ("9-21\n", {"mon_fri": [9, 21]}),
    ("22-05, (22-05), 22-05", {"mon_fri": [22, 5], "sat": [22, 5], "sun": [22, 5]}),
])
def test_hours_the_register_really_contains(raw, expected):
    value, issue = rules.parse_hours(raw)
    assert (value, issue) == (expected, None)


@pytest.mark.parametrize("raw, code", [
    ("7-18 7-15", rules.AMBIGUOUS),          # two ranges, nothing says which day is which
    ("7-15, Maksullinen (9-18)", rules.UNREADABLE),   # a word we do not understand
    ("25-30", rules.UNREADABLE),             # not hours of a day
    ("every other Tuesday", rules.UNREADABLE),
])
def test_hours_we_refuse_to_guess(raw, code):
    value, (issue, _) = rules.parse_hours(raw)
    assert value is None and issue == code


def test_hours_absent_is_missing_not_unreadable():
    """The register often states nothing, which the app reports differently from a bad value."""
    value, (code, _) = rules.parse_hours(None)
    assert value is None and code == rules.MISSING


# -------------------------------------------------------------- duration


@pytest.mark.parametrize("raw, minutes", [
    ("4 h", 240), ("4h", 240), ("4 H", 240), ("4", 240), ("4 ", 240),
    ("60 min", 60), ("30min", 30), ("12 h", 720),
    ("30 min, (30 мин)", 30),                # the register repeats itself in Russian
    ("ei aikarajaa", 0), ("ei aikarajoitusta", 0),   # explicitly no limit
])
def test_durations_the_register_really_contains(raw, minutes):
    assert rules.parse_duration(raw) == (minutes, None)


@pytest.mark.parametrize("raw", [
    "max 60 min lauantai",   # a day condition smuggled into a duration field
    "4 h juhlapyhinä",
    "4 h / 2 h",
    "60 min ma-pe",
])
def test_durations_hiding_a_condition_are_refused(raw):
    value, (code, _) = rules.parse_duration(raw)
    assert value is None and code == rules.UNREADABLE


def test_no_duration_stated_is_not_an_error():
    assert rules.parse_duration(None) == (None, None)


# ------------------------------------------------------------ rule types


@pytest.mark.parametrize("luokka, tyyppi, expected", [
    (6, None, "paid"),
    (8, None, "free_limited"),
    (9, None, "banned_hours"),
    (0, "Pysäköintikielto", "always_banned"),
    (0, "pysäköintikielto", "always_banned"),     # the register varies the case
    (0, "Taxi", "reserved"),
    (6, "Taxi", "reserved"),                      # the space type wins over the class
])
def test_rule_type(luokka, tyyppi, expected):
    rule, _, issue = rules.rule_type(luokka, tyyppi)
    assert (rule, issue) == (expected, None)


def test_an_unknown_space_type_is_flagged_not_assumed():
    """The city adds space types. Falling through to the class would call a new kind of
    reserved bay 'paid', with full confidence."""
    rule, _, (code, _) = rules.rule_type(6, "Uusi Merkki")
    assert rule == "unknown" and code == rules.UNREADABLE


def test_an_unknown_class_is_flagged():
    rule, _, (code, _) = rules.rule_type(99, None)
    assert rule == "unknown" and code == rules.UNREADABLE


def test_the_class_carries_the_limit_it_states():
    assert rules.rule_type(5, None)[1] == 240      # "Kertamaksu enintään 4 tuntia"


@pytest.mark.parametrize("luokka, named", [
    (5, True), (0, True), (None, True), (99, False),
])
def test_class_names_stop_at_classes_we_know(luokka, named):
    """An unrecognised class gets no name: rule_type flags it, so a label would contradict it."""
    assert (rules.class_name_en(luokka) is not None) is named


# ---------------------------------------------------------------- season


def test_season_all_year_is_no_season():
    for raw in ("0", "Ympärivuotinen", "(1.1.-31.12.)", None):
        assert rules.parse_season(raw) == (None, None)


def test_season_range():
    assert rules.parse_season("1.4. - 31.10.") == ({"start": [4, 1], "end": [10, 31]}, None)


def test_season_we_cannot_read():
    value, (code, _) = rules.parse_season("Vain sataman luvalla")
    assert value is None and code == rules.UNREADABLE


# ---------------------------------------------------------------- window


MIDSUMMER_2026 = date(2026, 6, 19)
HOLIDAYS = {date(2026, 12, 24), date(2026, 12, 25), MIDSUMMER_2026}


@pytest.mark.parametrize("day, window", [
    (date(2026, 12, 25), rules.SUNDAY),    # Christmas Day, a Friday
    (date(2026, 12, 23), rules.SATURDAY),  # the day before Christmas Eve, a Wednesday
    (date(2026, 12, 22), rules.WEEKDAY),
    (date(2026, 10, 3), rules.SATURDAY),   # an ordinary Saturday
    (date(2026, 10, 4), rules.SUNDAY),
    (date(2026, 10, 5), rules.WEEKDAY),
])
def test_which_window_a_date_falls_under(day, window):
    assert rules.window_for(day, HOLIDAYS) == window


def test_a_holiday_outranks_the_weekday_it_lands_on():
    """Without this, Christmas reads as whatever weekday it happens to be, and the app
    confidently quotes paid weekday hours."""
    assert rules.window_for(date(2026, 12, 25), set()) == rules.WEEKDAY
    assert rules.window_for(date(2026, 12, 25), HOLIDAYS) == rules.SUNDAY
