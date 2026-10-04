"""Turn the newest raw snapshot into the two files everything else reads.

    data/processed/parking_rules.parquet   analysis snapshot (metric CRS, committed to git)
    web/public/data/parking_areas.geojson  app data (GPS CRS, committed so the app just runs)

Usage: python pipeline/process.py
"""
import json
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd

import rules
from export_web import SOURCE as PARQUET, write_web

NEEDS_HOURS = {"paid", "free_limited", "banned_hours"}


def latest_snapshot():
    snaps = sorted(p for p in Path("data/raw").iterdir() if p.is_dir())
    if not snaps:
        sys.exit("No snapshot found. Run: python pipeline/fetch.py")
    return snaps[-1]


def classify(row):
    """Parse one parking area. Returns the rule plus a status and, if unsure, why."""
    issues = []

    def take(result):
        value, issue = result
        if issue:
            issues.append(issue)
        return value

    rule, stated_limit, issue = rules.rule_type(row.get("luokka"), row.get("tyyppi"))
    if issue:
        issues.append(issue)

    # Hours the register never stated are a status of their own, not a parse failure.
    hours, hours_issue = rules.parse_hours(row.get("voimassaolo"))
    no_hours_stated = hours_issue is not None and hours_issue[0] == rules.MISSING
    if hours_issue and not no_hours_stated:
        issues.append(hours_issue)

    minutes = take(rules.parse_duration(row.get("kesto")))
    season = take(rules.parse_season(row.get("kausi")))
    extra = take(rules.parse_extra(row.get("lisatieto")))

    if stated_limit is not None and minutes is not None and stated_limit != minutes:
        issues.append((rules.UNREADABLE,
                       f"the class allows {stated_limit} min but the register says {minutes} min"))
    if minutes is None:
        minutes = stated_limit

    codes = {code for code, _ in issues}
    if codes:
        status = "uncertain"
    elif no_hours_stated and rule in NEEDS_HOURS:
        status = "missing_hours"
    else:
        status = "official"

    return {
        "rule_type": rule,
        "class_name_en": rules.class_name_en(row.get("luokka")),
        "space_type_en": rules.space_type_en(row.get("tyyppi")),
        "hours": json.dumps(hours) if hours else None,
        "duration_min": minutes,
        "season": json.dumps(season) if season else None,
        "extra_info": extra,
        "status": status,
        "issue_codes": ",".join(sorted(codes)) or None,
        "reason": "; ".join(text for _, text in issues) or None,
    }


def check(areas):
    """Fail loudly if the register breaks an assumption everything downstream relies on."""
    if not areas["id"].is_unique or areas["id"].isna().any():
        raise ValueError("parking area ids must be unique and present")
    if (areas.geometry.isna() | areas.geometry.is_empty).any():
        raise ValueError("every parking area needs a geometry we can measure")
    if not areas.geometry.geom_type.isin({"Polygon", "MultiPolygon"}).all():
        raise ValueError("expected every geometry to be a polygon")
    # set_crs asserts the coordinate system rather than verifying it, so check the numbers:
    # if the server ever returns degrees, they land nowhere near Helsinki in metres.
    minx, miny, maxx, maxy = areas.total_bounds
    if not (25_400_000 < minx < 25_600_000 and 6_650_000 < miny < 6_750_000):
        raise ValueError(f"coordinates are not metres around Helsinki: {areas.total_bounds}")


def add_district(areas, snapshot):
    """Name the district each area sits in, by its centre.

    Some areas straddle a boundary, so containment of the centre picks exactly one and the
    answer does not depend on row order.
    """
    districts = (gpd.read_file(snapshot / "districts_3879.geojson")
                 .set_crs(3879, allow_override=True)[["nimi_fi", "geometry"]]
                 .rename(columns={"nimi_fi": "district"}))
    centres = areas[["geometry"]].copy()
    centres["geometry"] = areas.geometry.centroid
    hit = gpd.sjoin(centres, districts, predicate="within", how="left")
    areas["district"] = hit["district"]
    missing = int(areas["district"].isna().sum())
    print(f"  {areas['district'].nunique()} districts"
          + (f", {missing} areas outside all of them" if missing else ""))
    return areas


def main():
    snapshot = latest_snapshot()
    print(f"snapshot: {snapshot.name}")

    # GeoJSON always declares WGS84, so the metric file is mislabelled on read. Correct it,
    # or every distance and spatial join below is silently wrong.
    areas = gpd.read_file(snapshot / "parking_areas_3879.geojson").set_crs(3879, allow_override=True)
    check(areas)

    parsed = pd.DataFrame([classify(r) for r in areas.to_dict("records")], index=areas.index)
    areas = areas[["id", "luokka", "luokka_nimi", "tyyppi", "voimassaolo", "kesto", "kausi",
                   "lisatieto", "geometry"]].join(parsed)
    areas = add_district(areas, snapshot)

    PARQUET.parent.mkdir(parents=True, exist_ok=True)
    areas.to_parquet(PARQUET, compression="zstd")
    print(f"  {len(areas)} areas -> {PARQUET}")
    print(areas["status"].value_counts().to_string())

    target = write_web(areas)
    print(f"  {len(areas)} areas -> {target}")


if __name__ == "__main__":
    main()
