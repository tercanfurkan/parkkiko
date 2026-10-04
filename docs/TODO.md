# Task board

The shared plan. Two work streams run in parallel and sync through this file.

- **Data and backend** — the pipeline, the learning task, the report.
- **Frontend** — the map app in `web/`.

**Claim a task** by putting your name and stream in the Owner column in the same commit as your
first change. **Finish a task** by ticking it and naming the pull request. Keep edits to the row
you are working on, so two streams editing this file rarely touch the same lines.

Status values: `todo`, `doing`, `done`, `stretch`, `dropped`.

Run `.venv/bin/python -m pytest tests -q` before you push. It takes under a second and checks the
contract below, so a change that would break the other stream fails locally first.

Every task names where to read first. Follow those links before starting: most of them exist
because someone already measured the thing you are about to assume.

This file is the source. The spreadsheet in the team's Drive folder is a snapshot from before
this board moved into version control and is no longer kept in step.

---

## The boundary between the two streams

This is the only thing both streams depend on, so change it by agreement rather than in passing.

**`web/public/data/parking_areas.geojson`** is the contract. It is committed, so the app runs
straight after a clone, and it is generated, so only the backend rewrites it. `python
pipeline/export_web.py --check` says whether the committed copy still matches the data.

`WEB_FIELDS` in `pipeline/export_web.py` decides which fields are exported. What each field means
is in [data.md](data.md); how it is parsed is `pipeline/rules.py`. What matters to the app:

| Property | Present on | Note for the app |
|---|---|---|
| `id`, `rule_type`, `status` | all 8,754 | always there |
| `hours` | 5,823 | `{"mon_fri": [9, 21], "sat": [9, 18]}`, local time, `sun` when stated. A real object, not a string: no parsing needed |
| `duration_min` | 2,803 | minutes; `0` means explicitly no limit |
| `tyyppi` | 1,888 | Finnish space type; `spaceLabel()` in `web/src/style.js` turns it into words |
| `extra_info` | 1,362 | sign text to show verbatim |
| `reason` | 385 | why an area is uncertain, already written for a driver to read |
| `season` | 23 | `{"start": [4, 1], "end": [10, 31]}`, also an object |

A property is **absent** rather than null or empty when an area does not have it, so test for
presence. Geometry is MultiPolygon in WGS84, coordinates to 5 decimals, about 1 m.

**`web/public/data/holidays.json`** is the second committed file. It maps the dates whose parking
window is not simply their weekday, because a public holiday follows the Sunday window and the
day before follows the Saturday one.

Three rules, and the last one matters most:

- a date **absent** from `days`, but inside `years`, uses its weekday
- an entry with `"status": "uncertain"` is **check-the-sign**, never free
- a date **outside `years` is unknown**, not a weekday. The file covers three years from when it
  was generated, so after that every date would otherwise fall through to its weekday and
  Christmas would read as a Tuesday. Show check-the-sign instead.

**Who owns what.** Backend owns `pipeline/`, `analysis/`, `notebooks/`, `data/`. Frontend owns
`web/`. Neither edits the other without saying so here first. If the frontend needs a new field,
add a row to Open questions below rather than computing it in the browser.

---

## 1 Purpose

| Task | Owner | Status | Notes |
|---|---|---|---|
| Settle the app name | | todo | Parkkiko is unused by any parking app; the canvas no longer hedges it. Alternatives and what is taken: ask, the search is in the project history. |
| Name the related apps in the report | | todo | ParkClear (Los Angeles), Can I Park Here, ParkRight (Copenhagen), EasyPark (market leader in Finland). All answer a similar question; say what we do differently. Context: [process.md](process.md) section 1, [report_draft.md](report_draft.md) section 1. |

## 2 Data collection

| Task | Owner | Status | Notes |
|---|---|---|---|
| Fetch script, dated snapshots | | done | PR #25. `pipeline/fetch.py`. Sources, sizes and timings: [data.md](data.md). |
| Evaluate temporary traffic arrangements | | done | PR #27 dropped it after measuring. Read [future-work.md](future-work.md) before proposing any new source: it holds what we measured and rejected, and why. |
| Finnish holiday calendar | | done | PR #30. `pipeline/export_holidays.py` writes `web/public/data/holidays.json`. Contract is in the boundary section above. |

## 3 Preprocessing

| Task | Owner | Status | Notes |
|---|---|---|---|
| Parse hours, durations, seasons | | done | PR #25. `pipeline/rules.py`. Read its module docstring: the fail-closed contract is the project's core principle, not a style choice. |
| Class and space type to rule type | | done | PR #25, English labels in PR #27. `LUOKKA_RULES` and the space-type maps in `pipeline/rules.py` own the whole vocabulary. |
| District per area | | done | PR #30. `add_district()` in `pipeline/process.py`, by the area's centre, since 23 areas straddle a boundary. Feeds blocked validation, coverage per district and the district views below. |
| Register checks on every run | | done | PR #27. `check()` in `pipeline/process.py`. Why the coordinate check is a range and not an equality: the comment above it. |

## Quality

| Task | Owner | Status | Notes |
|---|---|---|---|
| Tests for the parsers, the status and the app contract | | done | PR #31. `pytest tests -q`, 76 cases, under a second, no network. Every case expecting a refusal is a regression we shipped once. |
| Run the tests in CI | | todo | Waiting on the frontend stream's GitHub Actions work; wiring ours in is `pip install -r requirements.txt` then `pytest tests -q`. Run on every pull request, not only when `pipeline/` changes: two of the tests read the committed data files, which is exactly the case a path filter would skip. |

## 4 Exploration

| Task | Owner | Status | Notes |
|---|---|---|---|
| Neighbour agreement by distance | | done | `notebooks/02_missing_hours_neighbours.ipynb`. This measurement chose the method, which is the step the course chapter asks for. Figures: [report_stats.md](report_stats.md). |
| Summary statistics per variable | | todo | Mode of each categorical field, median area size. The course's own answers do this before any plot: see week 2 exercise 2 in `~/tcm/ids/ds/exercise_reference_answers`. Start from `notebooks/01_parking_rules.ipynb`. |
| Bivariate and multivariate views | | todo | Rule type against district and against duration, colour-encoded. Pattern to copy: the pairplot and stacked-bar cells of week 2 exercise 2 in the reference answers. |
| Outlier check on area sizes | | todo | Histogram, log scale. Tiny or huge polygons are likely register errors and affect which area a tap selects. Geometry is metric in the parquet, so `.area` is m². |
| Generate the remaining typed counts | | todo | Distinct raw spellings per field and counts per issue code, added to `analysis/report_stats.py`, then delete the hand-typed versions from [report_draft.md](report_draft.md) and [data.md](data.md). Follow the existing table builders in that file. |

## 5 Learning

| Task | Owner | Status | Notes |
|---|---|---|---|
| Build the feature table | | todo | One row per area: neighbour hours, distance, same-street flag, class, district. Label-encode categoricals as in week 2 exercise 1 of the reference answers. The join to copy is `nearest_pairs()` in `analysis/report_stats.py`. |
| Dummy baseline | | todo | `sklearn.DummyClassifier(strategy="most_frequent")`. The course compares against one explicitly: week 3 exercise 2 of the reference answers. Our hand count is 32.9%; the fitted number should match. |
| Nearest-neighbour model | | todo | Same-class kNN, distance weighted. Accuracy and macro-F1 against the baseline. Why this method: the measurement in [process.md](process.md) section 4, and the canvas Learning approach box. |
| Spatially blocked validation | | todo | Hold out whole districts, using the `district` column. Fold sizes are very uneven, so check the spread first. Neighbouring sections of one street are near-duplicates, so a random split tests on copies of the training data. Reasoning: [canvas-working-notes.md](canvas-working-notes.md), Learning approach. |
| Distance-matched test | | todo | Hide close neighbours so test distances match the 978 areas we must predict, median 153 m with 17.7% within 50 m. The gap table is in [report_stats.md](report_stats.md); `prediction_gap()` computes it. |
| Choose the distance cut-off | | todo | Accuracy against coverage. Accuracy wins: a wrong answer costs a fine, "unknown" costs nothing. Set the target before looking at results. Accuracy by distance: [report_stats.md](report_stats.md). |
| Error analysis | | todo | Which areas we get wrong and why, on a map. The course asks for exactly this after classification: week 3 exercise 2 step 5 in the reference answers. |
| Imputation reflection | | todo | What changes for a driver when we predict versus leave unknown, and who is affected. Week 2 exercise 2 closes on this question; our version is the fairness point in the canvas Privacy box. |
| Coverage per district | | todo | Turns the fairness claim on the canvas into a measured table. The `district` column now exists; see [data.md](data.md). |
| Ship predictions to the app | | todo | Adds a `predicted` flag and a source to the GeoJSON. Changes the contract above, so agree it in Open questions first. Producer is `WEB_FIELDS` in `pipeline/export_web.py`. |

## 6 The app

| Task | Owner | Status | Notes |
|---|---|---|---|
| Host the first version | | todo | The map already draws all 8,754 areas over OpenStreetMap tiles: `web/src/App.jsx`, styling in `web/src/style.js`. Not yet deployed. The city's own map, for comparison, is palvelukartta.hel.fi. |
| Rule evaluation | | todo | Rule plus a time gives an answer and a timeline, e.g. paid until 21:00 then free. Hour semantics differ per rule type and are documented in `pipeline/rules.py` `parse_hours` and `LUOKKA_RULES`; the backend will review that reading. |
| Location and side of street | | todo | GPS finds nearby sections, the driver taps one and picks the side. GPS cannot tell the sides apart, which is why the driver must: measured in [canvas-working-notes.md](canvas-working-notes.md), Motivation. |
| Time and stay controls | | todo | Change arrival time and planned stay, and the answer updates. A control that does nothing was removed once before, deliberately: see PR #25. |
| Show estimates as estimates | | todo | Predicted hours must never look like the city's rule. The honesty principle is in [prompt.md](prompt.md) and the canvas Privacy box. |
| Deploy to GitHub Pages | | todo | Static build, base path `/parkkiko/`, already set in `web/vite.config.js`. Nothing extra to run: the data file is committed. **Check once deployed** whether Pages compresses it: `curl -sI -H 'Accept-Encoding: gzip' <url>/data/parking_areas.geojson \| grep -i content-encoding`. Uncompressed it is 2.8 MB against 0.32 MB gzipped, which decides whether the app is usable on mobile data. If it is not compressed, serving it as `.json` is worth testing. |

## UX

| Task | Owner | Status | Notes |
|---|---|---|---|
| Pen sketches of the main flow | | todo | Open map, tap section, pick side, see answer and timeline, change time. The intended flow is written out in the canvas Communication box. |
| Figma mockups | | todo | Mobile screens. Colour-blind safe, every colour paired with a text label. The palette in use is `RULE_TYPES` in `web/src/style.js`; week 2 exercise 4 of the reference answers shows how the course grades charts. |

## Report and presentation

| Task | Owner | Status | Notes |
|---|---|---|---|
| Technical report | | todo | Max 5 pages plus appendix, on the six stages. Write from [process.md](process.md); [report_draft.md](report_draft.md) is unmaintained raw material. Figures come from `analysis/report_stats.py`, never typed. |
| Spotlight talk | | todo | 3 minutes in week 42, slides plus a live demo. Requirements are on slide 20 of the first lecture, `~/tcm/ids/IntroDS-01.pdf`. |
| Showpiece: the coordinate system bug | | todo | A GeoJSON always declares WGS84, so the metric file read as degrees and a spatial join matched nothing. Week 3 exercise 1 of the reference answers is this exact problem. The fix and its comment are in `pipeline/process.py` `main()`. |
| Showpiece: fail-closed parsing | | todo | Input that used to give a confident wrong answer is now flagged. Before and after examples are in the PR #27 description and `pipeline/rules.py`. |
| Showpiece: chart quality | | todo | Colour-blind safe palette, no red and green pairing. Week 2 exercise 4 of the reference answers grades this; lecture 3 warns against red and green. |

## Stretch

| Task | Owner | Status | Notes |
|---|---|---|---|
| Read the unparsed sign conditions with a language model | | stretch | 301 areas hold conditions in Finnish prose, carried as `extra_info`. Week 4 of the course covers transformers. First thing to cut. |
| Street-level fine density layer | | stretch | **The stretch goal we intend to attempt.** Fines per street, normalised per parking space, as a layer beside the rules. Street level only, and read [future-work.md](future-work.md) first for why. |
| Traffic signs as a second source | | stretch | [future-work.md](future-work.md). No field links a sign to an area, so the match would be inferred with no ground truth. |
| Crowdsourced rules | | stretch | [future-work.md](future-work.md). No user base during the course, and a wrong entry costs someone a fine. |

---

## Open questions

Raise anything here that needs the other stream or the group to decide.

| Question | Raised by | Answer |
|---|---|---|
| Add new rows at the top of this table, so two streams appending at once do not collide. | | |
| Does the frontend need a field the GeoJSON does not carry? | | Open, for the frontend. The parquet also holds the raw register strings, the class and `issue_codes`; any can be added to `WEB_FIELDS`. Say which and why here. `district` now exists; nobody has spaces-per-area yet. |
| Should the app's data file be committed, generated offline, or built on deploy? | backend | Committed, and rebuildable offline with `pipeline/export_web.py`. Costs ~0.4 MB per change in git. |

## Known traps

- **Upgrade pyarrow before opening the parquet.** Versions before 21 fail with a repetition level
  histogram error, which reads like a corrupt file. `pip install -U "pyarrow>=21"`.
- **Register the notebook kernel**, or notebooks run against the wrong Python and cannot import
  geopandas. The command is in the README.
- **`web/public/data/` is committed but still generated.** Only the backend regenerates it:
  `pipeline/export_web.py` for the areas, `pipeline/export_holidays.py` for the calendar, and
  `pipeline/process.py` writes both. Never hand-edit either, and both take `--check`.
- **It is one long line, marked binary in `.gitattributes`.** A merge conflict in it cannot be
  resolved by hand: take either side and re-run the export.
