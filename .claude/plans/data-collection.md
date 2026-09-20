# Data collection: make the data easy to explore, and ready for the app

## Context

Parkkiko answers "may I park here, and until when?" from Helsinki's open parking register. The
register publishes rules as raw strings (`9-21, (9-18)`, `4 h`, `ei aikarajaa`) that neither a
driver nor a teammate can use directly.

This phase has two goals:

1. **Understand the data** — what must be parsed, what is unusable, what we can learn from it.
2. **Make it usable** — one processed dataset that feeds exploration, the learning task and the
   app, so rules cannot drift apart between them.

Everything below is sized from measurements taken against the live API, not estimates.

## Measured facts that drive the design

| Step | Measurement |
|---|---|
| Fetch parking areas (8,754) | 6.2 MB, 1.9 s |
| Fetch temporary arrangements (299) | 0.4 MB, 1.2 s |
| Parse + classify all 8,754 rows | 14 ms |
| Parking areas as GeoParquet | 0.52 MB |
| Web GeoJSON (trimmed fields, 6 dp) | 3.81 MB, **0.45 MB gzipped** |
| Build spatial index | 3 ms |
| Nearby-areas query (50 m radius) | 0.04 ms |

**Consequence:** the whole dataset is ~0.5 MB. No hosted database, object store or query service
is justified. Free static hosting covers the app; git covers the team.

## Decisions settled

- **App runtime:** one static GeoJSON on GitHub Pages, loaded once, all rule evaluation in the
  browser against the selected time. No backend.
- **Snapshot sharing:** the processed Parquet is committed, so all three of us analyse identical
  data. Raw snapshots stay out of git and are re-fetched only when re-processing.
- **Exploration access:** Parquet in git, queried with DuckDB SQL (no account, no server) or
  geopandas.
- **Map viewing without code:** the pipeline exports a GeoJSON that drops into kepler.gl or Felt.
- **Out of scope now:** 2023 violations and Digiroad traffic signs. Both are recorded in
  `docs/future-work.md` as later ML/feature opportunities. No planning effort spent on them.

## Prerequisite

PR #1 (project skeleton) is still open. Merge it first, then branch from `main`:

```
git worktree add .claude/worktrees/data-collection -b data-collection
```

Per the repo convention, copy this plan to
`.claude/worktrees/data-collection/.claude/plans/` once approved.

## Work items

### 1. Trim the fetch script — `pipeline/fetch.py`

Remove the violations layer. Keep parking areas in both coordinate systems (metric for analysis,
GPS for the web) and temporary arrangements. Full fetch then costs ~4 s instead of ~35 s.

### 2. New `pipeline/process.py` — the one place rules are parsed

Reads the newest raw snapshot, writes both downstream files. Steps, in order of difficulty:

- **Rule type** from `luokka` + `tyyppi` → paid, free with time limit, banned during hours,
  always banned, reserved. `luokka` alone is ambiguous: class 0 holds both bans and reserved bays.
- **Hours** from `voimassaolo`: `a, (b), c` → Mon–Fri a, Sat b, Sun c. Strip newlines. A throwaway
  20-line parser left ~960 rows unparsed, so the real parser needs the distinct-value list from
  notebook 01 first. Anything ambiguous (`7-18 7-15`) → `uncertain`, never guessed.
- **Duration** from `kesto`: 25 spellings of ~8 values, including inline Russian and
  `max 60 min lauantai` (a day condition hidden in a duration field).
- **Season** from `kausi`: `0` = all year; several date-range formats.
- **Contradictions** → `uncertain` (e.g. class named "max 4 h" with `kesto` = `24 h`).
- **Free-text `lisatieto`** (1,761 rows) is not parsed: mark `uncertain`, carry the text through
  for the app to show verbatim.
- **Temporary arrangements**: spatial overlap, carrying start/end dates.

Outputs:
- `data/processed/parking_rules.parquet` — **committed**, ~0.5 MB, the analysis snapshot.
- `web/public/data/parking_areas.geojson` — trimmed fields, 6 dp coordinates, gitignored build
  artefact.

Every row keeps a `status` of `official`, `uncertain` or `missing_hours`, plus a `reason`. This
column is the honesty contract of the whole project and everything downstream reads it.

### 3. SQL access — `requirements.txt`, `docs/querying.md`

Add `duckdb` and `pyarrow`. A short doc with 4–5 runnable examples: count by rule type, list
unparsed hour strings, find areas within 50 m of a point (DuckDB spatial), areas missing hours by
district. Aimed at a teammate who knows SQL but not geopandas.

### 4. Notebooks

- `01_parking_rules.ipynb` and `02_missing_hours_neighbours.ipynb`: read the committed Parquet
  instead of raw GeoJSON.
- `03_violations.ipynb`: delete. Its findings move to `docs/future-work.md`.
- Notebook 01 stays the source of truth for the distinct-value lists the parsers implement.

### 5. `docs/data.md` — the data section of the report

Sources and licence, the measured table above, what each file is for, and the known limits: the
register describes the plan and not the street; `lisatieto` free text is unparsed; the app cannot
verify which side of the street the driver is on without them picking it.

### 6. Web app — `web/src/App.jsx`

Enable Leaflet's canvas rendering (`preferCanvas`). 8,754 polygons can stutter on a phone with the
default renderer. If canvas is not enough, fall back to splitting into the 118 area files
(median 2 KB, max 31 KB) — measured, but not built unless needed.

## Verification

```
.venv/bin/python pipeline/fetch.py            # ~4 s, prints feature counts
.venv/bin/python pipeline/process.py          # <1 s
.venv/bin/python -c "import duckdb; print(duckdb.sql(\"select status, count(*) from 'data/processed/parking_rules.parquet' group by 1\"))"
cd web && npm run build                       # must stay green
```

Checks that must pass:

- Parquet has 8,754 rows; `status` counts sum to the total with no nulls.
- Every row with `status = official` has parsed hours; no `uncertain` row carries a guessed value.
- Web GeoJSON is ≤ 0.5 MB gzipped.
- Notebooks 01 and 02 execute top to bottom; notebook 02 still reproduces ~98% same-class
  neighbour accuracy and the 148 m median distance.
- Upload the exported GeoJSON to kepler.gl and confirm it renders and filters by rule type.
