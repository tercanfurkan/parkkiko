# Parkkiko

May I park here, and until when? A mobile-friendly map of Helsinki street parking rules, built on the city's open data. University of Helsinki, Introduction to Data Science mini-project.

## Layout

- `docs/` project canvas and idea spec
- `pipeline/` scripts: download data, export for the web app
- `notebooks/` exploration and learning
- `web/` React + Leaflet map app
- `data/` local data snapshots, not in git

## Data

All sources are City of Helsinki open data (CC BY 4.0), no login needed. Each run saves a dated snapshot, so analysis is reproducible.

```
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python pipeline/fetch.py        # -> data/raw/YYYY-MM-DD/ (~130 MB, a few minutes)
.venv/bin/jupyter notebook notebooks/
```

## Web app

```
.venv/bin/python pipeline/export_web.py   # -> web/public/data/
cd web && npm install && npm run dev
```
