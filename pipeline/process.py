"""Turn the newest raw snapshot into the two files everything else reads.

    data/processed/parking_rules.parquet   analysis snapshot (metric CRS, committed to git)
    web/public/data/parking_areas.geojson  app data (GPS CRS, build artefact)

Usage: python pipeline/process.py
"""
import json
import re
import sys
from pathlib import Path

import geopandas as gpd

sys.path.insert(0, str(Path(__file__).parent))
import rules  # noqa: E402

NEEDS_HOURS = {"paid", "free_limited", "banned_hours"}
WEB_FIELDS = ["id", "rule_type", "hours", "duration_min", "season", "status", "reason",
              "extra_info", "luokka_nimi", "tyyppi"]


def latest_snapshot():
    snaps = sorted(p for p in Path("data/raw").iterdir() if p.is_dir())
    if not snaps:
        sys.exit("No snapshot found. Run: python pipeline/fetch.py")
    return snaps[-1]


def classify(row):
    """Return the parsed rule for one parking area, plus why it is uncertain (if it is)."""
    why = []
    rule, r = rules.rule_type(row.get("luokka"), row.get("tyyppi"), row.get("luokka_nimi"))
    if r:
        why.append(r)

    hours, r = rules.parse_hours(row.get("voimassaolo"))
    no_hours_stated = hours is None and "no hours" in (r or "")
    # A ban or a reserved bay applies at all times, so it needs no hours.
    missing_hours = no_hours_stated and rule in NEEDS_HOURS
    if r and not no_hours_stated:
        why.append(r)

    minutes, r = rules.parse_duration(row.get("kesto"))
    if r:
        why.append(r)

    season, r = rules.parse_season(row.get("kausi"))
    if r:
        why.append(r)

    extra, r = rules.parse_extra(row.get("lisatieto"))
    if r:
        why.append(r)

    r = rules.duration_contradiction(row.get("luokka_nimi"), minutes)
    if r:
        why.append(r)

    if why:
        status = "uncertain"
    elif missing_hours:
        status = "missing_hours"
    else:
        status = "official"

    return {
        "rule_type": rule,
        "hours": json.dumps(hours) if hours else None,
        "duration_min": minutes,
        "season": json.dumps(season) if season else None,
        "extra_info": extra,
        "status": status,
        "reason": "; ".join(why) or None,
    }


def add_roadworks(areas, snapshot):
    """Flag areas overlapping a temporary traffic arrangement, keeping its dates."""
    path = snapshot / "temporary_arrangements_4326.geojson"
    areas["roadworks_until"] = None
    if not path.exists():
        print("  no temporary arrangements in snapshot, skipping")
        return areas
    works = gpd.read_file(path).to_crs(areas.crs)
    hit = gpd.sjoin(areas[["geometry"]], works[["geometry", "liikennejarjestely_paattyy"]],
                    predicate="intersects", how="inner")
    ends = hit.groupby(hit.index)["liikennejarjestely_paattyy"].max()
    areas.loc[ends.index, "roadworks_until"] = ends
    print(f"  {len(ends)} areas overlap roadworks")
    return areas


def main():
    snapshot = latest_snapshot()
    print(f"snapshot: {snapshot.name}")

    # GeoJSON always declares WGS84, so the metric file is mislabelled on read. Correct it,
    # or every distance and spatial join below is silently wrong.
    areas = gpd.read_file(snapshot / "parking_areas_3879.geojson").set_crs(3879, allow_override=True)
    assert areas["id"].is_unique, "parking area ids are not unique"
    parsed = gpd.pd.DataFrame([classify(r) for r in areas.to_dict("records")], index=areas.index)
    areas = areas[["id", "luokka", "luokka_nimi", "tyyppi", "voimassaolo", "kesto", "kausi",
                   "lisatieto", "geometry"]].join(parsed)
    areas = add_roadworks(areas, snapshot)

    out = Path("data/processed")
    out.mkdir(parents=True, exist_ok=True)
    areas.to_parquet(out / "parking_rules.parquet", compression="zstd")
    print(f"  {len(areas)} areas -> {out / 'parking_rules.parquet'}")
    print(areas["status"].value_counts().to_string())

    # web export: GPS coordinates, display fields only, 6 decimals (~0.1 m)
    web = gpd.read_file(snapshot / "parking_areas_4326.geojson")[["id", "geometry"]]
    web = web.merge(areas.drop(columns="geometry"), on="id")[WEB_FIELDS + ["geometry"]]
    path = Path("web/public/data/parking_areas.geojson")
    path.parent.mkdir(parents=True, exist_ok=True)
    text = re.sub(r"(\d+\.\d{6})\d+", r"\1", web.to_json(drop_id=True))
    path.write_text(text)
    print(f"  {len(web)} areas -> {path} ({len(text) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
