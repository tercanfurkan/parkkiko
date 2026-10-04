# Getting up to speed

For an agent session joining this project. Read this, explore in the order below, then wait for
instructions. Nothing here tells you what to build.

## What the project is

Parkkiko answers one question for a driver in Helsinki: may I park here, and until when? The city
publishes every street parking rule as open data, but as codes and Finnish strings a driver cannot
use. We turn that into a plain answer with its source attached.

It is a University of Helsinki *Introduction to Data Science* mini-project, graded on the six
stages of a data science project. The deliverables are a map website for drivers, a technical
report of at most 5 pages, and a 3-minute talk.

The one principle worth absorbing before touching anything: **the app never guesses.** A wrong
"you may park here" costs a driver a fine; an honest "we do not know" costs nothing. Every layer
is built that way, and a change that makes the system answer more confidently than the data
supports is a regression even when it looks like an improvement.

## Read in this order

1. **`README.md`** — layout, setup, how to run things.
2. **`docs/process.md`** — the project walked through stage by stage, with links to the code
   behind each claim. The fastest way to see the whole shape.
3. **`docs/TODO.md`** — the shared task board. It also carries the data contract between the
   backend and the frontend, who owns which directories, and the known traps. Read the traps
   before running anything; two of them cost an hour each if you hit them cold.
4. **`docs/data.md`** — sources, licence, file sizes, measured timings, and the limits of what
   the register can tell us.

Then skim, as the task needs:

- **`docs/report_stats.md`** — the measured figures, generated rather than typed.
- **`docs/future-work.md`** — ideas we evaluated and rejected, with the numbers. Check here before
  proposing a data source; some have already been measured and dropped.
- **`docs/report_draft.md`** — raw material for the report. Unmaintained by design; do not cite it.
- **`docs/canvas-working-notes.md`** — how the decisions were argued out. Superseded numbers, but
  it explains why things are the way they are.
- **`docs/mini-project-canvas.md`** — the course submission form.

## Then look at the code

```
pipeline/     fetch.py downloads a dated snapshot; rules.py parses the register's strings;
              process.py applies them and writes both outputs
analysis/     report_stats.py regenerates every figure the documents quote
notebooks/    01 what the register contains, 02 the neighbour finding, 03 English labels
web/          the map app: Vite, React, Leaflet, no backend
data/         processed/ is committed; raw/ is local and gitignored
```

`pipeline/rules.py` is the best single file to read. It is pure functions with no I/O, and it
shows what the raw data is really like: 66 spellings of opening hours, 25 ways to write a duration,
and a parser that refuses to answer rather than guess.

## Get it running

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m ipykernel install --user --name parkkiko --display-name "Python (parkkiko)"
.venv/bin/python pipeline/fetch.py      # about 2 s
.venv/bin/python pipeline/process.py    # about 1 s, writes the app's data file
cd web && npm install && npm run dev
```

If the pipeline output does not match the numbers in the docs, say so rather than updating the
docs: it means the register changed, which is itself a finding.

## How the two streams work together

Two sessions work in parallel: one on data and backend, one on the frontend. `docs/TODO.md` is
the sync point. Claim a task by putting your name in its Owner column in the same commit as your
first change, and raise anything that needs the other stream in the Open questions table rather
than deciding it alone.

The shared surface is one generated file, `web/public/data/parking_areas.geojson`, documented in
the task board. The frontend reads it and does not regenerate it; the backend produces it and does
not style it. If you need a field it does not carry, ask rather than deriving it in the browser,
because a value computed in two places will eventually disagree in two ways.

## House rules

- Every change goes through a worktree and a pull request. Nothing commits straight to `main`.
- Keep scope to what was asked. If you spot something else worth doing, add it to the task board.
- Say what you measured, not what you expect. Numbers in this repo are generated and checkable,
  and the reviews that shaped it repeatedly found confident claims that the data did not support.
