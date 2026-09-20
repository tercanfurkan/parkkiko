"""Parse the city register's raw rule strings into machine-readable values.

Pure functions, no I/O. Every parser returns (value, issue), where issue is None on success
or (code, explanation). Codes are the contract; the explanation is prose for the driver and
can be reworded freely. Parsers fail closed: anything they cannot fully account for becomes
an issue, never a partial answer.
"""
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
# stated limit comes from the class name ("Kertamaksu enintään 2 tuntia"), so it is data
# here rather than a regex over Finnish prose at read time.
LUOKKA_RULES = {                    # luokka: (rule_type, stated limit in minutes)
    1: ("free_limited", None),      # Ilmainen lyhytaikainen pysäköinti
    2: ("free_limited", None),      # Ilmainen pitkäaikainen pysäköinti
    3: ("paid", 60),                # Kertamaksu enintään 1 tunti
    4: ("paid", 120),               # Kertamaksu enintään 2 tuntia
    5: ("paid", 240),               # Kertamaksu enintään 4 tuntia
    6: ("paid", None),              # Maksullinen ilman asukas-/yritystunnusta
    7: ("paid", 60),                # Kertamaksu enintään 1 h ilman tunnusta
    8: ("free_limited", None),      # Ilmainen lyhytaikainen, pysäköintikiekko
    9: ("banned_hours", None),      # Pysäköinti sallittu pysäköintikieltoajan ulkopuolella
    10: ("paid", None),             # Maksullinen vyöhykehinta
    11: ("reserved", None),         # Z-tunnus nouto/palautus
}

# Space types, lower-cased. Membership is all we need; the driver-facing wording lives in the app.
BAN_TYPES = {"pysäköintikielto", "pysäyttämiskielto"}
RESERVED_TYPES = {
    "sähköpotkulauta", "sähköauto", "taxi", "taksi", "taxi, lataus", "kuormauspaikka", "inva",
    "matkailuliikenne", "cd", "moottoripyörä", "polkupyörä", "virka-auto", "poliisi",
    "kirjastoauto", "kuorma-auto", "parklet", "kaupunginkanslia", "valtioneuvosto",
    "henkilöauto, pakettiauto",
}


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
    try:
        rule, limit = LUOKKA_RULES[int(luokka)]
        return rule, limit, None
    except (KeyError, TypeError, ValueError):
        return "unknown", None, (UNREADABLE, f"no rule for class {luokka!r}")


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
