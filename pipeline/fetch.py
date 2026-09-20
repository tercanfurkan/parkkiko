"""Download a dated raw snapshot of the city's open data into data/raw/YYYY-MM-DD/.

    python pipeline/fetch.py              # what the app and analysis need (~4 s, 7 MB)
    python pipeline/fetch.py --violations # adds 2023 parking fines (~31 s, 106 MB)
    python pipeline/fetch.py --all        # every layer below

Violations are not used by the app or the learning task. They are kept here because they
are useful to explore locally, and are a possible later feature. See docs/future-work.md.
"""
import argparse
import json
import time
import urllib.request
from datetime import date
from pathlib import Path

WFS = "https://kartta.hel.fi/ws/geoserver/avoindata/wfs"
PAGE = 20000

# name -> (layer, CRS). EPSG:3879 is metric (analysis), EPSG:4326 is GPS (web map).
CORE = {
    "parking_areas_3879": ("avoindata:Pysakointipaikat_alue", "EPSG:3879"),
    "parking_areas_4326": ("avoindata:Pysakointipaikat_alue", "EPSG:4326"),
    "temporary_arrangements_4326": ("avoindata:Tilapainen_liikennejarjestely_alue", "EPSG:4326"),
}
OPTIONAL = {
    "violations_2023_3879": ("avoindata:Pysakointivirheet", "EPSG:3879"),
}


def fetch_layer(layer, crs):
    features, start = [], 0
    while True:
        url = (f"{WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames={layer}"
               f"&outputFormat=application/json&srsName={crs}&count={PAGE}&startIndex={start}")
        page = json.load(urllib.request.urlopen(url, timeout=600))["features"]
        features += page
        if len(page) < PAGE:
            return {"type": "FeatureCollection", "features": features}
        start += PAGE


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--violations", action="store_true", help="also fetch 2023 parking fines")
    ap.add_argument("--all", action="store_true", help="fetch every layer")
    args = ap.parse_args()

    layers = dict(CORE)
    if args.violations or args.all:
        layers |= OPTIONAL

    out = Path("data/raw") / date.today().isoformat()
    out.mkdir(parents=True, exist_ok=True)
    for name, (layer, crs) in layers.items():
        t = time.perf_counter()
        fc = fetch_layer(layer, crs)
        path = out / f"{name}.geojson"
        path.write_text(json.dumps(fc, ensure_ascii=False))
        mb = path.stat().st_size / 1e6
        print(f"{name}: {len(fc['features'])} features, {mb:.1f} MB, {time.perf_counter() - t:.1f} s")
    print(f"Saved to {out}")


if __name__ == "__main__":
    main()
