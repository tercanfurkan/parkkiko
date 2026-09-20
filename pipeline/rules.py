"""Parse the city register's raw rule strings into machine-readable values.

Pure functions, no I/O. Every parser returns (value, reason); reason is None on success
and a short explanation when the value could not be trusted. Nothing is ever guessed.
"""
import re


def _txt(value):
    """Raw fields arrive as str, None, or pandas NaN. Normalise to a plain string."""
    if value is None or (isinstance(value, float) and value != value):
        return ""
    return str(value)


# ---------------------------------------------------------------- rule type

RESERVED_TYPES = {
    "Sähköpotkulauta": "e-scooter", "Sähköauto": "electric car", "Taxi": "taxi",
    "Taksi": "taxi", "Taxi, lataus": "taxi", "Kuormauspaikka": "loading", "Inva": "disabled",
    "Matkailuliikenne": "tourist coach", "CD": "diplomatic", "Moottoripyörä": "motorcycle",
    "Polkupyörä": "bicycle", "Virka-auto": "official car", "Poliisi": "police",
    "Kirjastoauto": "library bus", "Kuorma-auto": "lorry", "Parklet": "parklet",
    "Kaupunginkanslia": "city hall", "Valtioneuvosto": "government",
    "henkilöauto, pakettiauto": "car or van",
}
BAN_TYPES = {"Pysäköintikielto", "pysäköintikielto", "Pysäyttämiskielto"}

# luokka -> rule type. 6,10 paid without limit; 3,4,5,7 paid with limit; 1,2,8 free; 9 ban hours.
PAID = {3, 4, 5, 6, 7, 10}
FREE = {1, 2, 8}


def rule_type(luokka, tyyppi, luokka_nimi=None):
    """Combine class and space type into one of five driver-facing rule types."""
    t = _txt(tyyppi).strip()
    if t in BAN_TYPES:
        return "always_banned", None
    if t in RESERVED_TYPES:
        return "reserved", None
    if luokka in PAID:
        return "paid", None
    if luokka in FREE:
        return "free_limited", None
    if luokka == 9:
        return "banned_hours", None
    if luokka == 11:  # Z-tunnus nouto/palautus: pickup/return bay
        return "reserved", None
    return "unknown", f"no rule type for luokka={luokka!r} tyyppi={t!r}"


# ------------------------------------------------------------------- hours

_RANGE = re.compile(r"(\d{1,2})\s*[-–]\s*(\d{1,2})")


def _window(text):
    m = _RANGE.search(text)
    if not m:
        return None
    a, b = int(m.group(1)), int(m.group(2))
    return [a, b] if a <= 24 and b <= 24 else None


def parse_hours(raw):
    """'9-21, (9-18)' -> {'mon_fri': [9,21], 'sat': [9,18]}.

    Brackets mean Saturday; a third bare range means Sunday. Holidays follow Sunday.
    """
    s = _txt(raw).replace("\n", " ").strip()
    if not s:
        return None, "no hours in register"
    s = re.sub(r"(?<=\d)\.(?=\d)", "-", s)          # '9.21' typo -> '9-21'
    s = re.sub(r"(\d)\s*\(", r"\1, (", s)           # '7-18 (7-15)' -> '7-18, (7-15)'

    out, seen_bracket = {}, False
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        w = _window(part)
        if w is None:
            return None, f"unreadable time range in {raw!r}"
        if "(" in part:
            out["sat"], seen_bracket = w, True
        elif "mon_fri" not in out:
            out["mon_fri"] = w
        elif seen_bracket:
            out["sun"] = w
        else:
            return None, f"ambiguous: two ranges without brackets in {raw!r}"
    return (out, None) if out else (None, f"no time range in {raw!r}")


# ---------------------------------------------------------------- duration

_DAY_WORDS = ("lauantai", "sunnuntai", "arkisin", "maanantai")


def parse_duration(raw):
    """'4 h' -> 240 minutes. 0 means no time limit."""
    s = _txt(raw).strip().lower()
    if not s:
        return None, None                            # no limit stated is not an error
    if any(w in s for w in _DAY_WORDS):
        return None, f"day condition hidden in duration field: {raw!r}"
    if "ei aikaraj" in s:
        return 0, None
    s = s.split(",")[0]                              # drop Russian duplicate
    m = re.search(r"(\d+)\s*(h|min)", s)
    if m:
        return int(m.group(1)) * (60 if m.group(2) == "h" else 1), None
    if s.strip().isdigit():
        return int(s.strip()) * 60, None             # bare number means hours
    return None, f"unreadable duration {raw!r}"


# ------------------------------------------------------------------ season

_ALL_YEAR = {"0", "ympärivuotinen", "1.1.-31.12.", "1.1.-31.12", "1.1.-31.12."}
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
    return None, f"unreadable season {raw!r}"


# --------------------------------------------------- extra info (lisatieto)

def parse_extra(raw):
    """Sign reference codes are metadata; anything wordier is a condition we do not parse."""
    s = _txt(raw).strip()
    if not s or s == "0":
        return None, None
    if re.fullmatch(r"[\d\-/, ]+", s):
        return s, None                               # plain sign code(s)
    return s, "unparsed condition in extra info"


# ----------------------------------------------------------- contradictions

_NAMED_HOURS = re.compile(r"enintään\s+(\d+)\s*(tunti|tuntia|h)")


def duration_contradiction(luokka_nimi, minutes):
    """Class name states a limit that disagrees with the duration field."""
    m = _NAMED_HOURS.search(_txt(luokka_nimi).lower())
    if not m or minutes is None:
        return None
    named = int(m.group(1)) * 60
    if named != minutes:
        return f"class name says {named // 60} h but duration field says {minutes} min"
    return None
