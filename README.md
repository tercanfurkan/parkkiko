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

**The cleaned data is already in git**, so you can explore straight after cloning. Run the two
scripts when you want the raw files to poke at, or when you change the pipeline:

```bash
.venv/bin/python pipeline/fetch.py     # ~4 s  -> data/raw/YYYY-MM-DD/*.geojson
.venv/bin/python pipeline/process.py   # ~2 s  -> data/processed/ and web/public/data/
```

`fetch.py` saves exactly what the city's server returned, one dated folder per run, so you can
open the raw GeoJSON in any map tool and compare it against what we parsed. `process.py` reads
the newest folder and writes the cleaned Parquet plus the map file for the app.

## Exploring

Three ways, pick whichever suits you.

**Notebooks.** Start Jupyter and choose the "Python (parkkiko)" kernel:

```bash
.venv/bin/python -m jupyter notebook notebooks/
```

**SQL.** No pandas or geopandas needed, see [docs/querying.md](docs/querying.md):

```bash
.venv/bin/python -c "import duckdb; print(duckdb.sql(\"select status, count(*) from 'data/processed/parking_rules.parquet' group by 1\"))"
```

**A map, with no code.** Run `pipeline/process.py`, then drag
`web/public/data/parking_areas.geojson` into [kepler.gl](https://kepler.gl).

## Web app

```bash
.venv/bin/python pipeline/process.py   # writes web/public/data/
cd web && npm install && npm run dev
```
