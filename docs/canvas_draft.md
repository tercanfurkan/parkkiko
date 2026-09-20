# Mini Project Canvas — DRAFT

**Title (preliminary):** Parkability — where Helsinki's parking rules are misread
**Group members:** _TBD (3)_
**Workshop #:** _TBD_

> Draft v1. Every number below was verified against a live API, not taken from documentation.
> Open decisions are collected at the bottom — they are not yet decided.

---

## MOTIVATION

**End user:** a driver about to leave a car on a Helsinki street, and secondarily the city's
parking planning unit.

**Need.** Kerb legality is not visible from the kerb. It depends on the hour, the day, the
permit zone, and a sign the driver may already have walked past. Helsinki issued **165,724
parking fines in 2023 alone**. Many are not defiance but misreading.

**Objective.** Do not claim to grant permission. Show the rule, show the sign it came from,
and be honest when the data does not support an answer. A wrong "you may park here" costs the
user a fine and costs us their trust; an honest "unsure" costs nothing.

**Benefit.** Fewer avoidable fines for drivers. For the city, a ranked list of kerbs where the
signage demonstrably fails, which is actionable without any new data collection.

---

## DATA COLLECTION

**Rule source decision:** the City of Helsinki map server (`kartta.hel.fi`) is the single source
of parking rules. The Service Map API (`api.hel.fi/servicemap`) is a derived copy of the same
register: same IDs (`origin_id` = WFS `id`, 8,754 of 8,759 match), same geometry, imported about a
day later. It drops bay type, season, extra sign info, space count, bay angle and resident zone
code, and merges the raw classes into 8 display classes. Its only gains are English names and
pre-formatted hours (`9-21, (9-18)` → `ma-pe 9-21, la 9-18`). Not worth a second source and a join.

| Source | Endpoint / layer | Records | Used for |
|---|---|---|---|
| Street parking areas + rules | `https://kartta.hel.fi/ws/geoserver/avoindata/wfs`, `avoindata:Pysakointipaikat_alue` | 8,754 | geometry, class, hours (`voimassaolo`), max duration (`kesto`), bay type (`tyyppi`), season (`kausi`), spaces, sign info (`lisatieto`) |
| Temporary traffic arrangements | same server, `avoindata:Tilapainen_liikennejarjestely_alue` | 324 | roadworks/closures with start + end dates → mark affected streets uncertain |
| Finnish public holidays | calendar, e.g. Python `holidays` package | — | holiday = Sunday rules; day before holiday = Saturday (bracketed hours). Eve rule applied by us, not the package. |

Request GPS coordinates with `srsName=EPSG:4326` (default is EPSG:3879). All sources CC BY 4.0,
no registration or authentication (verified with bare HTTP requests).

**Not yet included, pending Learning Task:** parking violations, `avoindata:Pysakointivirheet`
(WFS serves 2023 only: 156,383 fines + 9,341 warnings; older years 2014–2022 as CSV on
https://hri.fi/data/en_GB/dataset/pysakointivirheet-helsingissa, unopened). Digiroad traffic signs
(68,010 in Helsinki) only if the app shows the source sign.

**Data management plan.** A script downloads each source and saves a dated raw snapshot in the
repo. All cleaning and analysis run on snapshots, never on live API calls, so results are
reproducible. Raw files are never hand-edited; cleaned data is regenerated from raw by code.
Refresh when the city updates the register (daily at most); record the download date with each
snapshot. No personal data. Credit the City of Helsinki per CC BY 4.0.

---

## PREPROCESSING

**Goal:** turn each of the 8,754 raw parking areas into a structured rule the app can evaluate
against any date and time. Anything that cannot be parsed reliably becomes an explicit
"uncertain" with a reason, never a guess. All steps are deterministic code; no ML here (≈61 hour
strings and 25 duration strings fit a hand-checkable lookup table).

1. **Rule type from class + bay type.** Raw `luokka` alone is insufficient: class 0 holds both
   bans and reserved bays; `tyyppi` separates them. Output one of: paid, free with time limit,
   banned during hours, always banned, reserved (taxi, loading, e-scooter, EV, disabled, …).
2. **Parse hours (`voimassaolo`).** `a, (b), c` = Mon–Fri a, Sat b, Sun c. E.g. `9-21, (9-18)`.
   Strip whitespace/newlines. Ambiguous values like `7-18 7-15` → uncertain.
3. **Normalise max duration (`kesto`).** 25 spellings of ~8 values (`4 h`, `4h`, `4 H`, `4`;
   inline Russian `30 min, (30 мин)`; `ei aikarajaa` / `ei aikarajoitusta` = no limit).
   Conditions hidden in the field (`max 60 min lauantai`) → uncertain.
4. **Parse season (`kausi`).** `0` = all year (410 records); date ranges in several formats
   (`1.4. - 31.10.`, `(1.4.-31.10.)`).
5. **Flag contradictions.** E.g. class name says max 4 h, `kesto` says `24 h` → uncertain.
6. **Extra info (`lisatieto`, 1,761 filled).** Plain sign codes are kept as metadata. Free-text
   conditions (e.g. night driving ban 22–6) are not parsed: the area is marked uncertain and the
   text is shown to the driver as written, to decide.
7. **Temporary arrangements.** Spatial overlap with parking areas, keeping start/end dates;
   active arrangement at query time → uncertain.
8. **Calendar.** Holiday = Sunday; day before a holiday = Saturday (bracketed hours).
9. **Spatial index** over parking area geometries for nearest-area lookup from GPS.

**Missing hours (988 areas; 60 in core, 928 outside).** Either left as unknown, or predicted
from neighbouring areas, class and district — shown only above a validated confidence threshold
and labelled as predicted. Decision belongs to the Learning Task block.

**Feature engineering:** only needed for predicting missing hours (neighbour hours, distance,
class, district, street).

---

## EXPLORATORY DATA ANALYSIS

- Class balance of the 8,759 areas (see Learning Task — it is severe).
- Coverage map: which kerbs have a rule, which are class 0 "Other", which have no sign nearby.
  This is the honest map of what we do not know.
- Violation density per parking space, by district and by month, normalised so that big
  districts do not simply dominate.
- Agreement check: does the sign panel text agree with the polygon's `validity_period`?
  Disagreement rate is itself a headline finding.
- Distance distribution from sign to nearest kerb, to pick a defensible cutoff in step 5.

---

## VISUALIZATIONS

- **Confidence map of Helsinki** — kerbs coloured green / grey, where grey is an explicit
  model output, not missing data. Interactive: click a kerb to see the rule and the sign
  record it came from.
- **Time slider** — the same map at 09:00 Tuesday versus 20:00 Saturday, since the rule
  changes and this makes that legible.
- **Ranked table for the city** — the 20 kerbs with the highest fines per space, each with
  its sign text, as a maintenance worklist.
- Static: class imbalance, violation seasonality, sign-to-kerb distance histogram.

---

## LEARNING TASK

**Problem.** 964 parking areas with a rule type (paid, time-limited, banned during hours) have no
stated hours, so the app cannot say when the rule applies. Predict their hours from nearby
parking areas of the same class. Predict only where a close neighbour exists; otherwise show
"unknown".

- **Setting:** supervised, multiclass classification.
- **Target:** hours pattern of an area, e.g. `9-21,(9-18)` = Mon–Fri 9–21, Sat 9–18.
- **Labelled data:** areas with known hours (~5,800).
- **Inputs:** hours of nearest same-class areas, distance to them, same-street match, class,
  district.

**Measured feasibility (1,500 random known areas, hours hidden):**

| Method | Correct |
|---|---|
| Majority class (`9-21,(9-18)`) | 32.8% |
| Nearest area's hours | 89.3% |
| Nearest same-class area's hours | 98.3% |

| Same-class neighbour distance | Correct | n |
|---|---|---|
| 0–10 m | 99.1% | 1,291 |
| 10–50 m | 93.8% | 145 |
| 50–200 m | 73.3% | 15 (too small to trust) |

**Main risk.** Missingness is not random (lecture 2, slide 29). Missing-hours areas are far from
known ones: nearest known same-class area median 148 m, only 18.3% within 50 m. The test above is
dominated by close neighbours and is optimistic for the areas we actually need to predict. The
distance cut-off is the confidence threshold and must be validated at realistic distances.

**Optional enhancement (undecided): street-level fine risk.** Fines per street per month from
2023 violations. Fines are geocoded to address points, not the parked car: 165,724 fines on
10,932 coordinates (3,705 at Haartmaninkatu 4); only 15.0% within 10 m and 41.0% within 20 m of
any parking area. So area- or side-level attribution is not possible; street level only.
61.8% of fines are rule-related (no ticket, time exceeded, sign ban). Monthly time only.
Counts partly reflect patrol intensity.

---

## LEARNING APPROACH

**Methods.**
- **Baseline:** majority class (`9-21,(9-18)`, 32.8% correct).
- **Main method:** k-nearest neighbours restricted to the same parking class, distance-weighted.
  Chosen because the feasibility test showed proximity carries almost all the signal (98.3%
  with 1 same-class neighbour), and because the answer is explainable to a driver: "hours
  copied from the parking area 20 m away on the same street".
- **Comparison:** decision tree / random forest on engineered features (neighbour hours,
  distance, same-street match, class, district), to check whether anything beats plain kNN.
  Keep the simpler model unless the gain is clear.
- **Abstention:** predict only if the nearest same-class neighbour is within a distance
  cut-off; otherwise "unknown". Cut-off chosen on validation data, not guessed.

**Metrics.**
- Accuracy and macro-F1 (classes are imbalanced).
- **Coverage:** share of the 964 missing-hours areas that receive a prediction.
- **Accuracy vs coverage curve** over distance cut-offs; pick the cut-off where accuracy stays
  above a target set in advance (e.g. 95%). A wrong prediction can cost a driver a fine,
  an "unknown" costs nothing, so accuracy is prioritised over coverage.

**Splitting and validation.**
- **No random split.** Neighbouring sections of the same street are near-duplicates; a random
  split tests on them and inflates accuracy.
- **Spatially blocked cross-validation:** hold out whole grid blocks or districts.
- **Distance-matched test:** missing areas are a median 148 m from known same-class areas, while
  most known areas have a neighbour within 10 m. Simulate the real situation by hiding all
  known areas within a radius of each test area, so test distances match those of the missing
  areas. Report this score as the headline, since it reflects real use.

---

## COMMUNICATION OF RESULTS

**Deliverable 1 (target audience):** a small web map. Pick a location and a time, get green or
grey, plus the rule text and the sign record behind it. Non-technical, no jargon, and it must
show its source. Static hosting, no backend needed — the model output is precomputed per kerb.

**Deliverable 2 (course):** technical report, max 5 pages plus appendix, covering the wrangling,
the spatial split, what failed, and what we would do differently.

**Spotlight talk:** 3 minutes, week 42.

---

## DATA PRIVACY AND ETHICAL CONSIDERATIONS

- **No personal data is collected.** Violations carry location, month, and reason code — no
  plate, no owner, no identifier. No consent or pseudonymisation is required, and we should say
  so explicitly rather than leave it unaddressed.
- **Aggregation floor.** Fines are still geocoded near homes. Report violation counts only
  aggregated to kerb segments with a minimum count, never as individual mapped points.
- **Fairness.** A model predicting where fines occur will partly learn *where enforcement
  patrols go*, not where rules are broken. Publishing it risks concentrating enforcement on
  already-policed districts, a feedback loop. Compare predicted risk against district
  demographics and state the disparity in the report rather than shipping it silently.
- **Liability.** The app must never assert permission. Green means "the register and the sign
  agree"; it is not legal advice, and the interface has to say that.
- **Grey is not failure.** Refusing to answer where the data is thin is the ethical default,
  and we should be judged on how honestly grey is assigned.

---

## ADDED VALUE

For the driver: avoided fines, and a tool that admits what it does not know — which is what
makes it trustworthy enough to use twice.

For the city: the disagreement analysis and the fines-per-space ranking are a signage
maintenance worklist derived entirely from data the city already publishes. No survey, no
sensors, no new collection.

The prediction becomes value at the moment it abstains as readily as it answers.

---

## FUTURE WORK (out of scope for the mini-project)

- **Crowdsourced rules.** Drivers photograph or enter the sign for areas with unknown hours;
  accepted above an agreement/confidence threshold. Out of scope: no user base during the course
  to reach any threshold, wrong entries cause fines (needs moderation), and reports leak user
  location/time (privacy).

---

## OPEN DECISIONS — need the group's / instructor's call

1. **Scope.** Ship Task A alone, or A + B? B is the stronger ML story but doubles the pipeline.
2. **Weeks available.** The plan above assumes the full 5-week course arc. Not yet confirmed.
3. **Third framing not included.** A conformal-prediction version making "grey" a formal
   coverage guarantee was considered and left out: it would calibrate against the register but
   claim guarantees about the street, and that gap is hard to defend. Reconsider only if a
   reviewer asks for it.
4. **Sign-to-kerb assignment has no ground truth.** Step 5 is inferred. If that inference is
   weak, the "show the sign it came from" promise weakens with it. This is the largest single
   risk in the project and is not yet mitigated.
5. **2023-only violations.** Confirm no earlier years are published before relying on Task B.
