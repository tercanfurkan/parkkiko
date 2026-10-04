"""An area's status is what the app shows a driver, so the three cases must stay distinct.

`official` means the register states a complete rule. `missing_hours` means we know the kind of
rule but not when it applies. `uncertain` means something could not be read. Collapsing any of
them into another either hides a gap or cries wolf, and both have happened here before.
"""
import pytest

from process import classify


def area(**overrides):
    """A paid area with complete hours, which the tests vary one field at a time."""
    return {"luokka": 6, "tyyppi": None, "voimassaolo": "9-21, (9-18)", "kesto": "4 h",
            "kausi": None, "lisatieto": None, **overrides}


def test_a_complete_rule_is_official():
    assert classify(area())["status"] == "official"


def test_no_hours_on_a_paid_area_is_missing_not_uncertain():
    """The app can say 'the register does not publish hours here', which is a different and
    more useful sentence than 'something is wrong with this area'."""
    assert classify(area(voimassaolo=None))["status"] == "missing_hours"


@pytest.mark.parametrize("tyyppi", ["Pysäköintikielto", "Taxi"])
def test_areas_that_need_no_hours_are_not_missing_them(tyyppi):
    """A ban and a reserved bay apply at every hour. Marking them 'missing hours' once put
    1,892 areas into the wrong bucket."""
    assert classify(area(voimassaolo=None, tyyppi=tyyppi))["status"] == "official"


@pytest.mark.parametrize("field, value", [
    ("voimassaolo", "7-18 7-15"),            # ambiguous hours
    ("kesto", "max 60 min lauantai"),        # a condition hidden in the duration
    ("tyyppi", "Uusi Merkki"),               # a space type we do not know
    ("kausi", "Vain sataman luvalla"),       # a season we cannot read
    ("lisatieto", "Ei koske huoltoajoa"),    # a condition in prose we do not parse
])
def test_anything_unreadable_makes_the_area_uncertain(field, value):
    result = classify(area(**{field: value}))
    assert result["status"] == "uncertain"
    assert result["reason"], "an uncertain area must say why, in words a driver can read"
    assert result["issue_codes"], "and carry a code the app can branch on"


def test_a_contradiction_between_the_class_and_the_duration_is_uncertain():
    """Class 5 is 'maximum 4 hours'. If the register also says 24 h, we do not pick one."""
    assert classify(area(luokka=5, kesto="24 h"))["status"] == "uncertain"


def test_the_class_limit_is_used_when_the_register_states_no_duration():
    assert classify(area(luokka=5, kesto=None))["duration_min"] == 240


def test_sign_text_we_do_not_parse_is_carried_through_for_the_driver():
    note = "Ei koske huoltoajoa"
    assert classify(area(lisatieto=note))["extra_info"] == note


def test_plain_sign_codes_are_not_treated_as_conditions():
    """lisatieto often holds a reference number, which says nothing about the rule."""
    assert classify(area(lisatieto="7522"))["status"] == "official"
