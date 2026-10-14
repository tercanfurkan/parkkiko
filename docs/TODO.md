# Task board

The shared plan. Two work streams run in parallel and sync through this file.

- **Data and backend** — the pipeline, the learning task, the report.
- **Frontend** — the map app in `web/`.

New to a task? [todo-context.md](todo-context.md) says what to read and what goes wrong, one
page.

Tasks have an ID, so one can be handed over by name: 6.2, 5.3. The number before the dot is the
stage above it.

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

The file is committed and rebuildable offline, decided in PR #29 and costing about 0.4 MB per
change in git. `WEB_FIELDS` in `pipeline/export_web.py` decides which fields are exported. What each field means
is in [data.md](data.md); how it is parsed is `pipeline/rules.py`. What matters to the app:

| Property | Present on | Note for the app |
|---|---|---|
| `id`, `rule_type`, `status` | all 8,754 | always there |
| `hours` | 5,823 | `{"mon_fri": [9, 21], "sat": [9, 18]}`, local time, `sun` when stated. A real object, not a string: no parsing needed |
| `duration_min` | 2,803 | minutes; `0` means explicitly no limit |
| `tyyppi` | 1,888 | Finnish space type; `spaceLabel()` in `web/src/style.js` turns it into words |
| `luokka` | 8,411 | the register's class number. Only needed for class 11, the 60 car-sharing bays that are reserved with no space type |
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

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 1.1 | Settle the app name | | todo | Parkkiko is unused by any parking app; the canvas no longer hedges it. Alternatives and what is taken: ask, the search is in the project history. |
| 1.2 | Name the related apps in the report | | todo | ParkClear (Los Angeles), Can I Park Here, ParkRight (Copenhagen), EasyPark (market leader in Finland). All answer a similar question; say what we do differently. Context: [process.md](process.md) section 1, [report_draft.md](report_draft.md) section 1. |

## 2 Data collection

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 2.1 | Fetch script, dated snapshots | | done | PR #25. `pipeline/fetch.py`. Sources, sizes and timings: [data.md](data.md). |
| 2.2 | Evaluate temporary traffic arrangements | | done | PR #27 dropped it after measuring. Read [future-work.md](future-work.md) before proposing any new source: it holds what we measured and rejected, and why. |
| 2.3 | Finnish holiday calendar | | done | PR #30. `pipeline/export_holidays.py` writes `web/public/data/holidays.json`. Contract is in the boundary section above. |

## 3 Preprocessing

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 3.1 | Parse hours, durations, seasons | | done | PR #25. `pipeline/rules.py`. Read its module docstring: the fail-closed contract is the project's core principle, not a style choice. |
| 3.2 | Class and space type to rule type | | done | PR #25, English labels in PR #27. `LUOKKA_RULES` and the space-type maps in `pipeline/rules.py` own the whole vocabulary. |
| 3.3 | District per area | | done | PR #30. `add_district()` in `pipeline/process.py`, by the area's centre, since 23 areas straddle a boundary. Feeds blocked validation, coverage per district and the district views below. |
| 3.4 | Register checks on every run | | done | PR #27. `check()` in `pipeline/process.py`. Why the coordinate check is a range and not an equality: the comment above it. |

## Quality

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| Q1 | Tests for the parsers, the status and the app contract | | done | PR #31. `pytest tests -q`, 76 cases, under a second, no network. Every case expecting a refusal is a regression we shipped once. |
| Q2 | Run the tests in CI | | todo | Waiting on the frontend stream's GitHub Actions work; wiring ours in is `pip install -r requirements.txt` then `pytest tests -q`. Run on every pull request, not only when `pipeline/` changes: two of the tests read the committed data files, which is exactly the case a path filter would skip. |

## 4 Exploration

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 4.1 | Neighbour agreement by distance | | done | PR #1, remeasured over every area in PR #25. `notebooks/02_missing_hours_neighbours.ipynb`. This measurement chose the method, which is the step the course chapter asks for. Figures: [report_stats.md](report_stats.md). |
| 4.2 | Summary statistics per variable | | todo | Mode of each categorical field, median area size. The course's own answers do this before any plot: see week 2 exercise 2 in `~/tcm/ids/ds/exercise_reference_answers`. Start from `notebooks/01_parking_rules.ipynb`. |
| 4.3 | Bivariate and multivariate views | | todo | Rule type against district and against duration, colour-encoded. Pattern to copy: the pairplot and stacked-bar cells of week 2 exercise 2 in the reference answers. |
| 4.4 | Outlier check on area sizes | | todo | Histogram, log scale. Tiny or huge polygons are likely register errors and affect which area a tap selects. Geometry is metric in the parquet, so `.area` is m². |
| 4.5 | Generate the remaining typed counts | | todo | Distinct raw spellings per field and counts per issue code, added to `analysis/report_stats.py`, then delete the hand-typed versions from [report_draft.md](report_draft.md) and [data.md](data.md). Follow the existing table builders in that file. |

## 5 Learning

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 5.1 | Build the feature table | | todo | One row per area: neighbour hours, distance, same-street flag, class, district. Label-encode categoricals as in week 2 exercise 1 of the reference answers. The join to copy is `nearest_pairs()` in `analysis/report_stats.py`. |
| 5.2 | Dummy baseline | | todo | `sklearn.DummyClassifier(strategy="most_frequent")`. The course compares against one explicitly: week 3 exercise 2 of the reference answers. Our hand count is 32.9%; the fitted number should match. |
| 5.3 | Nearest-neighbour model | | todo | Same-class kNN, distance weighted. Accuracy and macro-F1 against the baseline. Why this method: the measurement in [process.md](process.md) section 4, and the canvas Learning approach box. |
| 5.4 | Spatially blocked validation | | todo | Hold out whole districts, using the `district` column. Fold sizes are very uneven, so check the spread first. Neighbouring sections of one street are near-duplicates, so a random split tests on copies of the training data. Reasoning: [canvas-working-notes.md](canvas-working-notes.md), Learning approach. |
| 5.5 | Distance-matched test | | todo | Hide close neighbours so test distances match the 978 areas we must predict, median 153 m with 17.7% within 50 m. The gap table is in [report_stats.md](report_stats.md); `prediction_gap()` computes it. |
| 5.6 | Choose the distance cut-off | | todo | Accuracy against coverage. Accuracy wins: a wrong answer costs a fine, "unknown" costs nothing. Set the target before looking at results. Accuracy by distance: [report_stats.md](report_stats.md). |
| 5.7 | Error analysis | | todo | Which areas we get wrong and why, on a map. The course asks for exactly this after classification: week 3 exercise 2 step 5 in the reference answers. |
| 5.8 | Imputation reflection | | todo | What changes for a driver when we predict versus leave unknown, and who is affected. Week 2 exercise 2 closes on this question; our version is the fairness point in the canvas Privacy box. |
| 5.9 | Coverage per district | | todo | Turns the fairness claim on the canvas into a measured table. The `district` column now exists; see [data.md](data.md). |
| 5.10 | Ship predictions to the app | | todo | Adds a `predicted` flag and a source to the GeoJSON. Changes the contract above, so agree it in Open questions first. Producer is `WEB_FIELDS` in `pipeline/export_web.py`. |

## 6 The app

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 6.1 | Host the first version | furkan-frontend | done | PR #33, live at https://tercanfurkan.github.io/parkkiko/. Opens on the city, asks for location and zooms to it; areas show from zoom 15 with or without location. `web/src/App.jsx`, styling in `web/src/style.js`. Checked on a phone. The city's own map, for comparison, is palvelukartta.hel.fi. |
| 6.2 | **The answer line** | furkan-frontend | doing | **Highest value for the demo.** Replace the rule-type label with what a driver can do: "Park here for 2 hours", "Paid until 21:00, then free", "No parking until 18:00", "Check the sign". Every decision behind that sentence is written out in [rule-evaluation.md](rule-evaluation.md), including worked examples with real area ids to use as tests. 5,532 of 8,754 areas can give a concrete time answer, so the demo will mostly land on one. |
| 6.3 | Start parking, and remind me | furkan-frontend | doing | **Stretch, and the moment that sells it.** A button on the panel starts a stay: store the area id and the start time, show a live countdown to when the driver must move, and notify before it runs out. Keep it in `localStorage` so a refresh does not lose it. Use the Notification API where granted, but **always** show the countdown in the page, because iOS Safari only delivers notifications to an installed PWA and the demo may be on a phone that has not installed one. Pick the end time from the same `evaluate()` as the answer line. Never start a stay on an area that says check the sign. |
| 6.4 | Location and side of street | | todo | GPS finds nearby sections, the driver taps one and picks the side. GPS cannot tell the sides apart, which is why the driver must: measured in [canvas-working-notes.md](canvas-working-notes.md), Motivation. |
| 6.5 | Time and stay controls | | todo | Change arrival time and planned stay, and the answer updates. A control that does nothing was removed once before, deliberately: see PR #25. |
| 6.6 | Show estimates as estimates | | todo | Predicted hours must never look like the city's rule. The honesty principle is in [prompt.md](prompt.md) and the canvas Privacy box. |
| 6.7 | Deploy to GitHub Pages | furkan-frontend | done | PR #32. `.github/workflows/pages.yml`. Static build, base path `/parkkiko/`, set in `web/vite.config.js`. Nothing extra to run: the data file is committed. **Pages compresses the data file**: `content-encoding: gzip`, 0.33 MB transferred against 2.77 MB raw, measured 2026-10-04 with `curl -sI -H 'Accept-Encoding: gzip' <url>/data/parking_areas.geojson`. No rename to `.json` needed. |

## UX

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| U1 | Pen sketches of the main flow | | todo | Open map, tap section, pick side, see answer and timeline, change time. The intended flow is written out in the canvas Communication box. |
| U2 | Figma mockups | | todo | Mobile screens. Colour-blind safe, every colour paired with a text label. The palette in use is `RULE_TYPES` in `web/src/style.js`; week 2 exercise 4 of the reference answers shows how the course grades charts. |

## Report and presentation

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| R1 | Technical report | | todo | Max 5 pages plus appendix, on the six stages. Write from [process.md](process.md); [report_draft.md](report_draft.md) is unmaintained raw material. Figures come from `analysis/report_stats.py`, never typed. |
| R2 | Spotlight talk | | todo | 3 minutes in week 42, slides plus a live demo. Requirements are on slide 20 of the first lecture, `~/tcm/ids/IntroDS-01.pdf`. |
| R3 | Showpiece: the coordinate system bug | | todo | A GeoJSON always declares WGS84, so the metric file read as degrees and a spatial join matched nothing. Week 3 exercise 1 of the reference answers is this exact problem. The fix and its comment are in `pipeline/process.py` `main()`. |
| R4 | Showpiece: fail-closed parsing | | todo | Input that used to give a confident wrong answer is now flagged. Before and after examples are in the PR #27 description and `pipeline/rules.py`. |
| R5 | Showpiece: chart quality | | todo | Colour-blind safe palette, no red and green pairing. Week 2 exercise 4 of the reference answers grades this; lecture 3 warns against red and green. |

## Stretch

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S1 | Read the unparsed sign conditions with a language model | | stretch | 301 areas hold conditions in Finnish prose, carried as `extra_info`. Week 4 of the course covers transformers. First thing to cut. |
| S2 | Street-level fine density layer | | stretch | **The stretch goal we intend to attempt.** Fines per street, normalised per parking space, as a layer beside the rules. Street level only, and read [future-work.md](future-work.md) first for why. |
| S3 | Traffic signs as a second source | | stretch | [future-work.md](future-work.md). No field links a sign to an area, so the match would be inferred with no ground truth. |
| S4 | Crowdsourced rules | | stretch | [future-work.md](future-work.md). No user base during the course, and a wrong entry costs someone a fine. |

---

## Open questions

What needs the other stream or the group to decide. **Add new rows at the top**, so two streams
appending at once do not collide. Move a row out once it is settled: a decisions table nobody
trusts to be current is worse than no table.

| Question | Raised by | Answer |
|---|---|---|
| 8 areas are typed "no parking" by the register and also state hours, so the ban probably applies only during them. We show "No parking" at every hour. It errs safe, costing a parking space rather than a fine, but it is wrong. Reclassify as banned-during-hours, or mark uncertain? | backend | |
| Do predicted hours ship before the spotlight demo? 978 areas say "the register does not publish hours here" until the learning task lands. | backend | Proposed: no. The model is unstarted, and "check the sign" is an honest answer in the demo. Say otherwise if the demo needs the coverage. |
| Does the frontend need a field the GeoJSON does not carry? Standing invitation, not a question with an end. | | Cheap to add: anything already in the parquet. `district` and `issue_codes` are a few KB each. Costly and refused once: `class_name_en`, 650 KB and register prose in a driver's panel. Nobody has spaces-per-area yet. |

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
