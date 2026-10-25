"""Rebuild the app's data file from the committed snapshot.

    python pipeline/export_web.py            rebuild web/public/data/parking_areas.geojson
    python pipeline/export_web.py --check    is the committed file still what the data produces?

The file is committed so the app runs straight after a clone, and it is generated, so the two
can drift. `--check` is how you find out: it rebuilds to a temporary path and compares bytes.

pipeline/process.py calls write_web() directly after parsing the register, so there is one
writer whichever way the file is produced.
"""
import argparse
import json
import sys
import tempfile
from pathlib import Path

import geopandas as gpd

SOURCE = Path("data/processed/parking_rules.parquet")
TARGET = Path("web/public/data/parking_areas.geojson")

# What the app reads. Register values rather than labels: the wording lives in web/src/style.js,
# so changing a word is a one-line edit instead of a data rebuild.
# luokka rides along because 60 car-sharing bays are reserved by their class and state no
# tyyppi, so without it the app can only say "Reserved space" and not who it is for. 3 KB gzipped.
WEB_FIELDS = ["id", "rule_type", "luokka", "tyyppi", "hours", "duration_min", "season", "status",
              "reason", "extra_info", "predicted_hours", "predicted_from_m"]
# ~1 m, which is finer than the register's own accuracy and than any phone's GPS. Six decimals
# cost 19% more on the wire for precision nothing can use; four collapse small polygons entirely.
COORD_DECIMALS = 5


def write_web(areas, target=TARGET):
    """Write the areas as GPS-coordinate GeoJSON, carrying only what the app displays."""
    # Largest first, so smaller areas draw on top and take the tap: a no-parking square must not
    # swallow the street section lying inside it
    order = areas.geometry.area.sort_values(ascending=False, kind="stable").index
    web = areas.loc[order, WEB_FIELDS + ["geometry"]].to_crs(4326)
    # The register's class is a whole number; pandas reads it as a float, and "11.0" in the
    # app's data invites a string comparison that silently fails.
    web["luokka"] = web["luokka"].astype("Int64")
    target.parent.mkdir(parents=True, exist_ok=True)
    web.to_file(target, driver="GeoJSON", COORDINATE_PRECISION=COORD_DECIMALS)

    # Most areas leave most fields empty, and an empty value costs as many bytes as a real one.
    # The app tests whether a property is present, so absent is the honest encoding of "none".
    payload = json.loads(target.read_text())
    for feature in payload["features"]:
        feature["properties"] = {k: v for k, v in feature["properties"].items()
                                 if v is not None and v != ""}
    target.write_text(json.dumps(payload, separators=(",", ":")))
    return target


def load():
    if not SOURCE.exists():
        sys.exit(f"{SOURCE} not found. Run: python pipeline/fetch.py && python pipeline/process.py")
    return gpd.read_parquet(SOURCE, columns=WEB_FIELDS + ["geometry"])


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="compare the committed file against a fresh build, and say if they differ")
    args = ap.parse_args()

    if args.check:
        with tempfile.TemporaryDirectory() as tmp:
            # Same filename: the writer stamps it into the GeoJSON "name" member.
            fresh = write_web(load(), Path(tmp) / TARGET.name)
            if not TARGET.exists():
                sys.exit(f"{TARGET} is missing. Run: python pipeline/export_web.py")
            if fresh.read_bytes() != TARGET.read_bytes():
                sys.exit(f"{TARGET} is stale. Run: python pipeline/export_web.py")
        print(f"{TARGET} matches the committed data")
        return

    target = write_web(load())
    print(f"{target} ({target.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
