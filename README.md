# Parkkiko

May I park here, and until when? A mobile-friendly map of Helsinki street parking rules, built on
the city's open data. University of Helsinki, Introduction to Data Science mini-project.

**[How this project was built](docs/process.md)** walks through the six stages of a data science
project with the code, data and results behind each one.
**[The task board](docs/TODO.md)** is the shared plan, and carries the data contract between the
pipeline and the app. New here? Start with **[docs/prompt.md](docs/prompt.md)**.

## Layout

- `docs/` the task board, process walkthrough, project canvas, data documentation and SQL guide
- `analysis/` regenerates every figure and table quoted in the report
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

**The cleaned data and the app's data file are already in git**, so you can explore, and run the
map, straight after cloning. Run these when you want the raw files to poke at, or when you change
the pipeline:

```bash
.venv/bin/python pipeline/fetch.py              # raw snapshot -> data/raw/YYYY-MM-DD/
.venv/bin/python pipeline/process.py            # parse it     -> data/processed/ and web/public/data/
.venv/bin/python pipeline/export_web.py         # rebuild just the app's file, offline
.venv/bin/python pipeline/export_web.py --check # is the committed app file still current?
.venv/bin/python pipeline/export_holidays.py    # refresh the holiday calendar the app reads
```

Measured timings are in [docs/data.md](docs/data.md).

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

**A map, with no code.** Drag `web/public/data/parking_areas.geojson` into
[kepler.gl](https://kepler.gl). It is in the repo, so there is nothing to run first.

## Tests

```bash
.venv/bin/python -m pytest tests -q      # under a second, no network
```

`tests/test_rules.py` and `tests/test_status.py` cover the parsers and the status they produce.
Every case expecting a refusal is one the parsers once answered confidently and wrongly.
`tests/test_app_data.py` checks the two committed files against the contract in
[docs/TODO.md](docs/TODO.md), which is what the frontend is written against.

```bash
cd web && npm test      # under a second, no network; also runs before every deploy
```

`web/src/style.test.js` checks that an area whose rule is not fully known never looks official,
and that the app has a colour and label for every value in the data. `web/src/extent.test.js`
checks that the area the app treats as Helsinki still covers every parking area.

## Report figures

The tables in `docs/report_stats.md` and the charts in `docs/figures/` are generated from the
committed snapshot, so they can be checked and they follow the register when it changes. The
canvas is a submission form and is written by hand.

```bash
.venv/bin/python analysis/report_stats.py --write --figures   # -> docs/report_stats.md, docs/figures/
```

## Web app

The app's data file is committed, so this is all it takes:

```bash
cd web && npm install && npm run dev
```

A push to `main` deploys it to https://tercanfurkan.github.io/parkkiko/. To deploy a branch for
testing on a phone, see the header of `.github/workflows/pages.yml`.
