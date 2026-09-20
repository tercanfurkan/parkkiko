"""Write the latest snapshot's parking areas to web/public/data/ for the map.

Usage: python pipeline/export_web.py
"""
import json
from pathlib import Path

KEEP = ["id", "luokka", "luokka_nimi", "tyyppi", "voimassaolo", "kesto", "kausi", "lisatieto"]

raw = sorted(Path("data/raw").iterdir())[-1]
fc = json.loads((raw / "parking_areas_4326.geojson").read_text())
for f in fc["features"]:
    f["properties"] = {k: f["properties"].get(k) for k in KEEP}
out = Path("web/public/data/parking_areas.geojson")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(fc, ensure_ascii=False))
print(f"{len(fc['features'])} areas -> {out}")
