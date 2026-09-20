"""Download a dated raw snapshot of all sources into data/raw/YYYY-MM-DD/.

Usage: python pipeline/fetch.py
"""
import json
import urllib.request
from datetime import date
from pathlib import Path

WFS = "https://kartta.hel.fi/ws/geoserver/avoindata/wfs"
PAGE = 20000

# file name -> (layer, CRS). EPSG:3879 is metric (analysis), EPSG:4326 is GPS (web map).
LAYERS = {
    "parking_areas_3879": ("avoindata:Pysakointipaikat_alue", "EPSG:3879"),
    "parking_areas_4326": ("avoindata:Pysakointipaikat_alue", "EPSG:4326"),
    "temporary_arrangements_4326": ("avoindata:Tilapainen_liikennejarjestely_alue", "EPSG:4326"),
    "violations_2023_3879": ("avoindata:Pysakointivirheet", "EPSG:3879"),
}


def fetch_layer(layer, crs):
    features, start = [], 0
    while True:
        url = (f"{WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames={layer}"
               f"&outputFormat=application/json&srsName={crs}&count={PAGE}&startIndex={start}")
        page = json.load(urllib.request.urlopen(url, timeout=300))["features"]
        features += page
        if len(page) < PAGE:
            return {"type": "FeatureCollection", "features": features}
        start += PAGE


def main():
    out = Path("data/raw") / date.today().isoformat()
    out.mkdir(parents=True, exist_ok=True)
    for name, (layer, crs) in LAYERS.items():
        fc = fetch_layer(layer, crs)
        (out / f"{name}.geojson").write_text(json.dumps(fc, ensure_ascii=False))
        print(f"{name}: {len(fc['features'])} features")
    print(f"Saved to {out}")


if __name__ == "__main__":
    main()
