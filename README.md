# Parkkiko

May I park here, and until when? A mobile-friendly map of Helsinki street parking rules, built on
the city's open data. University of Helsinki, Introduction to Data Science mini-project.

## Layout

- `docs/` project canvas, data documentation, SQL guide, task board
- `pipeline/` download the data, parse the rules, export for the app
- `notebooks/` exploration
- `web/` React and Leaflet map app
- `data/processed/` the analysis snapshot, committed so everyone works on identical data
- `data/raw/` local snapshots, not in git

## Setup

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m ipykernel install --user --name parkkiko --display-name "Python (parkkiko)"
```

The second line registers the notebook kernel. Without it, notebooks run against the wrong
Python and fail to import geopandas.

## Data

Everything comes from the City of Helsinki's open data under CC BY 4.0, with no login. See
[docs/data.md](docs/data.md) for the sources, sizes, timings and known limits.

```bash
.venv/bin/python pipeline/fetch.py               # ~7 s  -> data/raw/YYYY-MM-DD/
.venv/bin/python pipeline/fetch.py --violations  # adds 2023 fines, 106 MB, exploration only
.venv/bin/python pipeline/process.py             # ~4 s  -> parquet + web GeoJSON
```

You only need to fetch and process if you are changing the pipeline. The processed file is in
git, so exploration works straight after cloning.

## Exploring

Three ways, pick whichever suits you:

```bash
.venv/bin/python -m jupyter notebook notebooks/   # notebooks, pick the "Python (parkkiko)" kernel
.venv/bin/python -m duckdb                        # plain SQL, see docs/querying.md
```

Or open `web/public/data/parking_areas.geojson` in [kepler.gl](https://kepler.gl) for an
interactive map with no code at all.

## Web app

```bash
.venv/bin/python pipeline/process.py   # writes web/public/data/
cd web && npm install && npm run dev
```
