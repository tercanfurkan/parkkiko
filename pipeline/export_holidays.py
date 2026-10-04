"""Write the calendar the app needs to read a parking sign correctly.

    python pipeline/export_holidays.py

Finnish parking signs state up to three time windows: weekdays, then Saturday in brackets, then
Sunday. Which window applies on a given date is not just the weekday:

    a public holiday follows the Sunday window
    the day before a public holiday follows the Saturday window

So Christmas Day reads as a Sunday, and 23 December reads as a Saturday. Getting this wrong
produces a confident wrong answer on exactly the days people drive to see family.

Two days are marked uncertain rather than guessed. Christmas Eve and Midsummer Eve are holidays
in the calendar sense, but we have not confirmed that Helsinki's parking rules treat them as
such. Reading them as Sundays would tell a driver parking is free when it may be paid, which is
the one error this project refuses to make, so the app should say "check the sign" on those two.

The output maps only the dates that differ from their weekday, so the app can look a date up and
fall back to its weekday when it is absent.
"""
import json
from datetime import date, timedelta
from pathlib import Path

import holidays

TARGET = Path("web/public/data/holidays.json")
YEARS = range(date.today().year, date.today().year + 3)

# Days the calendar calls holidays but the city's parking rules may not. Unconfirmed, and the
# unsafe direction, so they are flagged rather than resolved.
UNCONFIRMED = {"Christmas Eve", "Midsummer Eve", "New Year's Eve"}


def calendar(years=YEARS):
    """Dates whose parking window differs from their weekday, and why."""
    public = holidays.Finland(years=list(years) + [max(years) + 1])
    out = {}
    for day, name in public.items():
        if day.year not in years:
            continue
        if day.weekday() != 6:                       # a holiday that is not already a Sunday
            out[day.isoformat()] = {"window": "sun", "name": name}
            if name in UNCONFIRMED:
                out[day.isoformat()]["uncertain"] = (
                    "we have not confirmed the city treats this as a holiday for parking")
    for day, name in public.items():
        eve = day - timedelta(days=1)
        if eve.year in years and eve.isoformat() not in out and eve.weekday() < 5:
            out[eve.isoformat()] = {"window": "sat", "name": f"day before {name}"}
    return dict(sorted(out.items()))


def main():
    days = calendar()
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps({
        "note": "Dates whose parking window differs from their weekday. Absent means use the "
                "weekday: Mon-Fri the first window, Saturday the bracketed one, Sunday the third. "
                "An entry with 'uncertain' should be shown as check-the-sign, not as free.",
        "years": [min(YEARS), max(YEARS)],
        "days": days,
    }, ensure_ascii=False, indent=1))
    print(f"{len(days)} dates -> {TARGET}")


if __name__ == "__main__":
    main()
