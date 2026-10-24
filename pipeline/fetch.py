"""Download a dated raw snapshot of the city's open data into data/raw/YYYY-MM-DD/.

Usage: python pipeline/fetch.py

Takes a few seconds. The files are exactly what the city's server returned, so you can also
open them in any map tool. Run pipeline/process.py afterwards to parse the rules.
"""
import json
import time
import urllib.request
from datetime import date
from pathlib import Path

WFS = "https://kartta.hel.fi/ws/geoserver/avoindata/wfs"
PAGE = 20000

# name -> (layer, CRS). EPSG:3879 is metric, so distances come out in metres.
LAYERS = {
    "parking_areas_3879": ("avoindata:Pysakointipaikat_alue", "EPSG:3879"),
    # 34 basic districts. Big enough to hold out whole ones in cross-validation, and named
    # after places people recognise, unlike the 148 sub-areas.
    "districts_3879": ("avoindata:Piirijako_peruspiiri", "EPSG:3879"),
}


def layer_url(layer, crs, count=PAGE, start=0):
    """The WFS request for one page of a layer."""
    return (f"{WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames={layer}"
            f"&outputFormat=application/json&srsName={crs}&count={count}&startIndex={start}")


def fetch_layer(layer, crs):
    """Download one WFS layer, following the server's paging."""
    features, start = [], 0
    while True:
        page = json.load(urllib.request.urlopen(layer_url(layer, crs, start=start), timeout=600))["features"]
        features += page
        if len(page) < PAGE:
            return {"type": "FeatureCollection", "features": features}
        start += PAGE


def save(fc, path):
    """Write a layer as a snapshot keeps it. Only the features are kept, so the file does not say
    its coordinate system: pipeline/process.py read_metric() asserts it on every read."""
    path.write_text(json.dumps(fc, ensure_ascii=False))


def main():
    out = Path("data/raw") / date.today().isoformat()
    out.mkdir(parents=True, exist_ok=True)
    for name, (layer, crs) in LAYERS.items():
        started = time.perf_counter()
        fc = fetch_layer(layer, crs)
        path = out / f"{name}.geojson"
        save(fc, path)
        print(f"{name}: {len(fc['features'])} features, {path.stat().st_size / 1e6:.1f} MB, "
              f"{time.perf_counter() - started:.1f} s")
    print(f"Saved to {out}")


if __name__ == "__main__":
    main()
