"""Parse the city register's raw rule strings into machine-readable values.

Pure functions, no I/O. Every parser returns (value, issue), where issue is None on success
or (code, explanation). Codes are the contract; the explanation is prose for the driver and
can be reworded freely. Parsers fail closed: anything they cannot fully account for becomes
an issue, never a partial answer.
"""
import datetime
import re

MISSING = "missing"          # the register states nothing
UNREADABLE = "unreadable"    # stated, but we cannot parse it
AMBIGUOUS = "ambiguous"      # stated, parses more than one way
NOTE = "note"                # free-text condition we deliberately do not parse


def _txt(value):
    """Raw fields arrive as str, None, or pandas NaN. Normalise to a plain string."""
    if value is None or (isinstance(value, float) and value != value):
        return ""
    return str(value)


# ---------------------------------------------------------------- rule type

# The whole domain of luokka, which is 1:1 with luokka_nimi in the register.
# The stated limit comes from the class name ("Kertamaksu enintään 2 tuntia") and the English
# name is the driver-facing label, so both are data here rather than prose parsed at read time.
LUOKKA_RULES = {   # luokka: (rule_type, stated limit in minutes, English name)
    1: ("free_limited", None, "Free short-term parking"),
    2: ("free_limited", None, "Free long-term parking"),
    3: ("paid", 60, "Single payment, up to 1 hour"),
    4: ("paid", 120, "Single payment, up to 2 hours"),
    5: ("paid", 240, "Single payment, up to 4 hours"),
    6: ("paid", None, "Paid without a resident or business permit; hours vary by location"),
    7: ("paid", 60, "Single payment up to 1 hour without a resident or business permit"),
    8: ("free_limited", None, "Free short-term parking without a permit; use a parking disc"),
    9: ("banned_hours", None, "Parking allowed outside the no-parking hours"),
    10: ("paid", None, "Paid at the zone rate"),
    11: ("reserved", None, "Z-permit car-sharing pickup and return"),
}
# The register leaves 1,926 areas unclassified, either as class 0 or with no class at all.
# In both the space type carries the rule, so they share one label and no rule of their own.
NO_CLASS_NAME = "No class in the register; the space type defines the rule"

# Space types, lower-cased, with the label the app shows. Membership decides the rule type.
BAN_TYPES = {
    "pysäköintikielto": "No parking",
    "pysäyttämiskielto": "No stopping",
}
RESERVED_TYPES = {
    "sähköpotkulauta": "Electric scooter", "sähköauto": "Electric car", "taxi": "Taxi",
    "taksi": "Taxi", "taxi, lataus": "Taxi, charging", "kuormauspaikka": "Loading zone",
    "inva": "Accessible parking", "matkailuliikenne": "Tourist coach",
    "cd": "Diplomatic vehicle", "moottoripyörä": "Motorcycle", "polkupyörä": "Bicycle",
    "virka-auto": "Official vehicle", "poliisi": "Police", "kirjastoauto": "Mobile library",
    "kuorma-auto": "Lorry", "parklet": "Parklet", "kaupunginkanslia": "City Executive Office",
    "valtioneuvosto": "Finnish Government", "henkilöauto, pakettiauto": "Car or van",
}


def _class_code(luokka):
    """The register stores the class as a float, and leaves it absent for some areas."""
    try:
        return int(luokka)
    except (TypeError, ValueError):
        return None


def class_name_en(luokka):
    """English name of a parking class, for analysis and the report.

    None for a class we do not know, so an unrecognised class is never given a confident
    name. rule_type flags the same input as an issue.
    """
    code = _class_code(luokka)
    if code is None or code == 0:
        return NO_CLASS_NAME
    entry = LUOKKA_RULES.get(code)
    return entry[2] if entry else None


def space_type_en(tyyppi):
    """English label of a space type, or None when the register states none we recognise."""
    t = _txt(tyyppi).strip().lower()
    return BAN_TYPES.get(t) or RESERVED_TYPES.get(t)


def rule_type(luokka, tyyppi):
    """Combine class and space type into (rule_type, stated limit, issue).

    An unrecognised space type is an issue, not a fall-through to the class: the city adds new
    ones, and guessing would turn a reserved bay into "paid" with full confidence.
    """
    t = _txt(tyyppi).strip().lower()
    if t in BAN_TYPES:
        return "always_banned", None, None
    if t in RESERVED_TYPES:
        return "reserved", None, None
    if t and not t.isdigit():
        return "unknown", None, (UNREADABLE, f"unknown space type {tyyppi!r}")
    entry = LUOKKA_RULES.get(_class_code(luokka))
    if entry is None:
        return "unknown", None, (UNREADABLE, f"no rule for class {luokka!r}")
    return entry[0], entry[1], None


# ----------------------------------------------------------------- windows

# The three windows a sign can state, in the order the register writes them.
WEEKDAY, SATURDAY, SUNDAY = "mon_fri", "sat", "sun"


def window_for(day, holiday_dates):
    """Which window of a sign applies on a date, given the public holidays around it.

    A public holiday follows the Sunday window, and the day before one follows the Saturday
    window. Without this, Christmas Day reads as whatever weekday it lands on.
    """
    if day in holiday_dates:
        return SUNDAY
    if day + datetime.timedelta(days=1) in holiday_dates:
        return SATURDAY
    if day.weekday() == 5:
        return SATURDAY
    if day.weekday() == 6:
        return SUNDAY
    return WEEKDAY


# ------------------------------------------------------------------- hours

# '.' appears as a typo for '-' ('9.21'), so it is accepted as a separator.
_RANGE = re.compile(r"(\d{1,2})\s*[-–.]\s*(\d{1,2})")


def parse_hours(raw):
    """'9-21, (9-18)' -> {'mon_fri': [9,21], 'sat': [9,18]}.

    Brackets mean Saturday, a later bare range means Sunday, and holidays follow Sunday.
    Every character must be accounted for, so a stray range or word is flagged rather than
    dropped: '7-18 7-15' is ambiguous, not "7-18".
    """
    s = _txt(raw).replace("\n", " ").strip()
    if not s:
        return None, (MISSING, "the register states no hours for this section")

    out, seen_bracket, leftover = {}, False, s
    for m in _RANGE.finditer(s):
        a, b = int(m.group(1)), int(m.group(2))
        if a > 24 or b > 24:
            return None, (UNREADABLE, f"hour outside 0-24 in {raw!r}")
        leftover = leftover.replace(m.group(0), " ", 1)
        bracketed = s.rfind("(", 0, m.start()) > s.rfind(")", 0, m.start())
        if bracketed:
            out["sat"], seen_bracket = [a, b], True
        elif "mon_fri" not in out:
            out["mon_fri"] = [a, b]
        elif seen_bracket:
            out["sun"] = [a, b]
        else:
            return None, (AMBIGUOUS, f"two ranges with no brackets to tell the days apart: {raw!r}")

    if not out:
        return None, (UNREADABLE, f"no time range in {raw!r}")
    unaccounted = re.sub(r"[(),\s]+", " ", leftover).strip()
    if unaccounted:
        return None, (UNREADABLE, f"the hours {raw!r} also say {unaccounted!r}, which we cannot read")
    return out, None


# ---------------------------------------------------------------- duration

_DURATION = re.compile(r"(?:max\s*)?(\d+)\s*(h|min)?")
_RU_DUPLICATE = re.compile(r"\(?\s*\d+\s*(?:мин|ч)\s*\)?")


def parse_duration(raw):
    """'4 h' -> 240 minutes. 0 means explicitly no limit, None means none stated.

    The whole string must match, so conditions smuggled into this field
    ('max 60 min lauantai') are flagged instead of silently read as 60 minutes.
    """
    s = _txt(raw).strip().lower()
    if not s:
        return None, None
    if "ei aikaraj" in s:
        return 0, None

    head, *rest = s.split(",")
    m = _DURATION.fullmatch(head.strip())
    if not m or any(not _RU_DUPLICATE.fullmatch(r.strip()) for r in rest):
        return None, (UNREADABLE, f"unreadable duration {raw!r}")
    unit = m.group(2)
    return int(m.group(1)) * (1 if unit == "min" else 60), None


# ------------------------------------------------------------------ season

_ALL_YEAR = {"0", "ympärivuotinen"}
_DATES = re.compile(r"(\d{1,2})\.\s*(\d{1,2})\.?\s*[-–]\s*(\d{1,2})\.\s*(\d{1,2})\.?")


def parse_season(raw):
    """'1.4. - 31.10.' -> {'start': [4,1], 'end': [10,31]}. None means all year."""
    s = _txt(raw).strip().strip("()").replace(" ", "").lower()
    if not s or s in _ALL_YEAR:
        return None, None
    m = _DATES.search(s)
    if m:
        d1, m1, d2, m2 = (int(x) for x in m.groups())
        if 1 <= m1 <= 12 and 1 <= m2 <= 12:
            if (m1, d1) == (1, 1) and (m2, d2) == (12, 31):
                return None, None                    # all year, written as a range
            return {"start": [m1, d1], "end": [m2, d2]}, None
    return None, (UNREADABLE, f"unreadable season {raw!r}")


# --------------------------------------------------- extra info (lisatieto)

def parse_extra(raw):
    """Sign reference codes are metadata; anything wordier is a condition we do not parse."""
    s = _txt(raw).strip()
    if not s or s == "0":
        return None, None
    if re.fullmatch(r"[\d\-/, ]+", s):
        return s, None                               # plain sign code(s)
    return s, (NOTE, "the sign carries a condition we do not read; check it yourself")
