# Technical report: raw material

**Not maintained.** This is a scrapbook for whoever writes the report: tables, phrasings and
checklists of what each section must cover. It is not kept in step with the project, and nothing
should be cited from it without checking.

For the current state of the project read [process.md](process.md). For current figures run
`python analysis/report_stats.py --write --figures` and take them from
[report_stats.md](report_stats.md). The fines count and the measurements of the dataset we
rejected are one-off, and are sourced where they appear below.

The report itself is at most 5 pages plus an appendix, and follows the six stages of a data
science project.

---

## 1. Purpose

Helsinki publishes every street parking rule as open data, but in a form no driver can use: codes
and strings in a municipal register. On the street the rule is invisible, because it depends on
the day, the hour and which side of the road you are on, and the sign that states it may be
behind you.

The city recorded 156,383 parking fines and 9,341 warnings in 2023.

**Target audience:** drivers in central Helsinki without a residential parking permit, especially
visitors and occasional drivers.

**From A to B:** from "I think this is fine" to "the city says this is paid until 21:00, then free
until 09:00", or an honest "we do not know".

---

## 2. Data collection

| Source | Rows | Licence |
|---|---|---|
| `avoindata:Pysakointipaikat_alue`, City of Helsinki WFS | 8,754 | CC BY 4.0 |

No key, no registration, verified with bare unauthenticated requests. Each run saves a dated
snapshot so every result can be reproduced.

**A dataset we evaluated and rejected.** The city also publishes temporary traffic arrangements,
which sounded like live roadworks. Measured, the arrangements run a median of 711 days and up to
3,204, and of the 191 parking areas overlapping one, only 18 state a purpose that mentions
parking. An overlap told us a permit exists nearby, not that the spaces are gone, so we removed
it. Including a dataset because it exists is not data collection.

---

## 3. Preprocessing

The register states rules as human text. Turning that into something evaluable is most of the work.

- **Hours.** `9-21, (9-18)` means Monday to Friday 9 to 21 and Saturday 9 to 18. Brackets mean
  Saturday, a third range means Sunday. 66 distinct spellings, including a `.` typed for a `-`.
- **Durations.** 25 spellings of about 8 values: `4 h`, `4h`, `4 H`, `4`, plus inline Russian and
  two different ways to write "no limit".
- **Rule type** comes from the class and the space type together. The class alone is ambiguous,
  because class 0 holds both parking bans and reserved bays.

**The parsers fail closed.** Each must account for every character of a field. Earlier versions
returned a confident answer for the part they recognised: `7-18 7-15` became `7-18`, and
`max 60 min lauantai` became 60 minutes with the Saturday condition dropped. Now both are flagged.
Every area ends with a status, an issue code for branching, and a reason in plain words.

> *Report note: include the before and after table here.*

---

## 4. Exploratory data analysis

### What the city actually publishes

| Rule type | Areas | Share |
|---|---|---|
| Paid | 4,446 | 50.8% |
| Free with time limit | 2,035 | 23.2% |
| Reserved | 1,043 | 11.9% |
| Always banned | 885 | 10.1% |
| Banned during hours | 283 | 3.2% |
| Unknown | 62 | 0.7% |

Three quarters of the city's street parking allows parking in some form. The remaining quarter is
where fines happen, and it is the part a driver cannot see from the car.

### What "reserved" means in practice

| Reserved for          |   Areas |
|:----------------------|--------:|
| Electric scooter      |     312 |
| Electric car          |     187 |
| Taxi                  |     122 |
| Loading zone          |     100 |
| Accessible parking    |      88 |
| Tourist coach         |      63 |
| not stated            |      60 |
| Diplomatic vehicle    |      59 |
| Motorcycle            |      17 |
| Bicycle               |      14 |
| Taxi, charging        |       8 |
| Car or van            |       3 |
| Official vehicle      |       3 |
| Police                |       2 |
| City Executive Office |       1 |
| Mobile library        |       1 |
| Parklet               |       1 |
| Finnish Government    |       1 |
| Lorry                 |       1 |

These look like ordinary spaces from the driver's seat. They are the clearest case for the app:
not a rule to interpret, just "this space is not for you".

### How much can the app answer

| Status | Areas |
|---|---|
| Complete rule published | 7,391 |
| Rule type known, hours missing | 978 |
| Uncertain, with a stated reason | 385 |

### The finding that chose our method

For areas whose hours we know, copying the hours of the nearest area of the same class is correct
97.5% of the time, against 32.9% for always guessing the most common pattern. Accuracy depends
almost entirely on distance:

| Distance to nearest same-class area | Correct | Areas |
|---|---|---|
| 0 to 10 m | 99.5% | 4,711 |
| 10 to 50 m | 95.5% | 706 |
| 50 to 200 m | 68.4% | 152 |
| over 200 m | 35.4% | 65 |

> *Report note: add summary statistics per variable, a size histogram for outliers, and rule type
> against district.*

---

## 5. Learning

> *To be written once the model runs. Must include: the dummy baseline, accuracy and macro-F1,
> spatially blocked validation, the distance cut-off chosen from the accuracy-versus-coverage
> curve, error analysis on a map, and a reflection on what imputation changes for a driver.*

---

## 6. Communication and added value

> *To be written. The deliverable is a mobile-friendly map site; the added value is a plain answer
> with its source attached.*

---

## What we would do differently

- **A coordinate system bug we caused ourselves.** A GeoJSON file always declares itself as WGS84
  even when it holds metric coordinates, so our metric file was read as degrees. Nothing crashed.
  A spatial join simply matched zero rows, and we only noticed because zero was implausible.
  Setting the coordinate system explicitly on read is one line; finding out that we needed it took
  a wrong answer that looked right.
- **We measured a dataset before trusting its name.** "Temporary traffic arrangements" are not
  temporary.
- **Parsers should fail closed from the start.** Our first version silently truncated what it did
  not understand, which in an app about honesty is the worst possible failure mode.
