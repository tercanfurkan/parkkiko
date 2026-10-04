"""Write the calendar the app needs to read a parking sign correctly.

    python pipeline/export_holidays.py            rebuild web/public/data/holidays.json
    python pipeline/export_holidays.py --check    does the committed file still hold?

A Finnish sign states up to three windows: weekdays, Saturday in brackets, Sunday. Which one
applies is decided by `window_for` in rules.py, which the whole pipeline shares. This script
only runs it over a range of dates and writes the answer down, so the app needs no calendar.

Dates outside the range the file covers are not weekdays by default: they are unknown, and the
app must say check-the-sign. Falling back to the weekday would make Christmas read as a Tuesday
the first January nobody regenerates this.
"""
import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

import holidays

import rules

TARGET = Path("web/public/data/holidays.json")
YEARS = range(date.today().year, date.today().year + 3)


def unconfirmed_days(year):
    """Days the calendar calls holidays but the city's parking rules may not.

    Derived from the date rather than matched on the package's English names, which change
    with its version and its language setting. A silent miss here would publish Christmas Eve
    as a confident Sunday, which is the one direction this project never errs in.
    """
    midsummer_eve = next(d for d in (date(year, 6, day) for day in range(19, 26))
                         if d.weekday() == 4)
    return {date(year, 12, 24): "Christmas Eve", midsummer_eve: "Midsummer Eve"}


def calendar():
    """Dates whose window is not simply their weekday, and how sure we are of each."""
    public = holidays.Finland(years=[*YEARS, max(YEARS) + 1])  # +1: 31 Dec is an eve
    dates = set(public)

    unconfirmed = {}
    for year in YEARS:
        for day, name in unconfirmed_days(year).items():
            if day not in dates:
                sys.exit(f"{name} {day} is no longer a holiday in the calendar package. "
                         f"Check whether it still needs flagging before trusting this file.")
            unconfirmed[day] = name

    days = {}
    for day in (min(YEARS, default=0) and date(min(YEARS), 1, 1) + timedelta(n)
                for n in range((date(max(YEARS), 12, 31) - date(min(YEARS), 1, 1)).days + 1)):
        window = rules.window_for(day, dates)
        if window == _plain_weekday(day):
            continue                                     # the app falls back to the weekday
        entry = {"window": window, "name": public.get(day) or f"day before {public[day + timedelta(1)]}"}
        rests_on = day if day in unconfirmed else day + timedelta(1)
        if rests_on in unconfirmed:
            entry["status"] = "uncertain"
            entry["reason"] = (f"rests on {unconfirmed[rests_on]}, which the calendar calls a "
                               f"holiday but we have not confirmed the city does for parking")
        days[day.isoformat()] = entry
    return days


def _plain_weekday(day):
    return rules.window_for(day, set())


def build():
    return {
        "note": "Dates whose parking window is not simply their weekday. Absent and inside "
                "'years' means use the weekday. Outside 'years' is unknown, not a weekday: "
                "show check-the-sign. An entry with 'status': 'uncertain' is also check-the-sign.",
        "years": [min(YEARS), max(YEARS)],
        "days": calendar(),
    }


def write():
    """Write the calendar and return where it went."""
    payload = build()
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    return TARGET, payload


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="does the committed file match, and does it still cover this year?")
    args = ap.parse_args()

    if args.check:
        payload = build()
        if not TARGET.exists():
            sys.exit(f"{TARGET} is missing. Run: python pipeline/export_holidays.py")
        committed = json.loads(TARGET.read_text())
        if date.today().year > committed["years"][1]:
            sys.exit(f"{TARGET} covers {committed['years']} and we are past it. "
                     f"Run: python pipeline/export_holidays.py")
        if committed["days"] != payload["days"] and committed["years"] == payload["years"]:
            sys.exit(f"{TARGET} does not match the calendar. Run: python pipeline/export_holidays.py")
        print(f"{TARGET} covers {committed['years'][0]}-{committed['years'][1]} and still holds")
        return

    target, payload = write()
    uncertain = sum("status" in d for d in payload["days"].values())
    print(f"{len(payload['days'])} dates ({uncertain} uncertain) -> {target}")


if __name__ == "__main__":
    main()
