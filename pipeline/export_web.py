"""Rebuild the app's data file from the committed snapshot.

    python pipeline/export_web.py

Reads data/processed/parking_rules.parquet and writes web/public/data/parking_areas.geojson.
No network and no raw snapshot needed, so anyone who cloned the repo can produce it, and so can
a deploy job. pipeline/process.py calls the same code after it parses the register.
"""
import json
import sys
from pathlib import Path

import geopandas as gpd

SOURCE = Path("data/processed/parking_rules.parquet")
TARGET = Path("web/public/data/parking_areas.geojson")

# What the app reads. Register values rather than labels: the wording lives in web/src/style.js,
# so changing a word is a one-line edit instead of a data rebuild.
WEB_FIELDS = ["id", "rule_type", "tyyppi", "hours", "duration_min", "season", "status",
              "reason", "extra_info"]
COORD_DECIMALS = 6          # ~0.1 m, far finer than the register's own accuracy


def write_web(areas, target=TARGET):
    """Write the areas as GPS-coordinate GeoJSON, carrying only what the app displays."""
    web = areas[WEB_FIELDS + ["geometry"]].to_crs(4326)
    target.parent.mkdir(parents=True, exist_ok=True)
    web.to_file(target, driver="GeoJSON", COORDINATE_PRECISION=COORD_DECIMALS)

    # Most areas leave most fields empty, and an empty value costs as many bytes as a real one.
    # The app tests whether a property is present, so absent is the honest encoding of "none".
    payload = json.loads(target.read_text())
    for feature in payload["features"]:
        feature["properties"] = {k: v for k, v in feature["properties"].items()
                                 if v is not None and v != ""}
    target.write_text(json.dumps(payload, separators=(",", ":")))
    return len(payload["features"])


def main():
    if not SOURCE.exists():
        sys.exit(f"{SOURCE} not found. Run: python pipeline/process.py")
    count = write_web(gpd.read_parquet(SOURCE))
    print(f"{count} areas -> {TARGET} ({TARGET.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
