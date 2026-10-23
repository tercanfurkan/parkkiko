<!--
Maintained draft of the technical report. Updated as each stage closes; a section still marked
"To be written" is a stage that has not closed yet.

- What the report must be, and how it is graded: report-spec.md. At most 5 pages as a PDF.
- Every number is copied from report_stats.md, which analysis/report_stats.py generates. Rerun it
  with --write --figures rather than typing a number. One-off measurements (the fines count, the
  rejected datasets, the traffic signs) are sourced where they appear.
- Comments like this one do not render in the PDF.

Status: stages 1-4 written, 5-6 and the reflection to come.
-->

# Parkkiko: technical report

Jamila Shulekha, Mai Phuong Pham, Ömer Furkan Tercan. Introduction to Data Science, University of
Helsinki, autumn 2026. App: https://tercanfurkan.github.io/parkkiko/. Code and data:
https://github.com/tercanfurkan/parkkiko.

**Summary.** Helsinki publishes every street parking rule as open data, but as codes and strings
no driver can read at the kerb. Parkkiko turns that register into one plain answer for a chosen
street section at the current moment: may I park here, do I pay, and until when. The register is
incomplete or self-contradicting for about one section in six, and the project's central rule is
that the app never answers more confidently than the data supports. Most of the technical work
went into knowing when not to answer.

---

## 1. Problem and target user

On the street a parking rule is invisible. It depends on the day, the hour and the side of the
road, and the sign that states it may be behind the driver. The city recorded 156,383 parking
fines and 9,341 warnings in 2023 (City of Helsinki, *Pysäköintivirheet Helsingissä*, Helsinki
Region Infoshare, CC BY 4.0).

**Target user:** drivers in central Helsinki without a residential permit, especially visitors and
occasional drivers. **From A to B:** from "I think this is fine" to "paid until 21:00, then free
until 09:00 tomorrow", or an honest "check the sign".

---

## 2. Data collection

| Source | Rows | Used for |
|---|---|---|
| City of Helsinki WFS, `avoindata:Pysakointipaikat_alue` | 8,754 areas | the rules themselves |
| City of Helsinki WFS, `avoindata:Piirijako_peruspiiri` | 34 districts | coverage and blocked validation |
| Finnish public holidays, `holidays` package | 61 dates | a holiday follows Sunday rules |

All CC BY 4.0, no key or registration. `pipeline/fetch.py` saves a dated snapshot, and everything
downstream runs on the snapshot, so every result is reproducible.

**A dataset we evaluated and rejected.** The canvas planned to use live roadworks. Measured, the
city's temporary traffic arrangements run a median of 711 days, and of the 191 parking areas
overlapping one, only 18 state a purpose that mentions parking. An overlap told us a permit exists
nearby, not that the spaces are gone, so we dropped it.

---

## 3. Preprocessing

The register states rules as human text, and turning that into something a program can evaluate
against a date and time was most of the work.

- **Hours.** `9-21, (9-18)` means Monday to Friday 9 to 21 and Saturday 9 to 18: brackets mean
  Saturday, a third range Sunday. The field has 66 distinct spellings, including a `.` typed for
  a `-`.
- **Time limits.** 25 spellings of about 8 values: `4 h`, `4h`, `4 H`, `4`, inline Russian, and
  two different ways to write "no limit".
- **Rule type** comes from the class and the space type together. The class alone is ambiguous,
  because class 0 holds both parking bans and reserved bays.

**The parsers fail closed.** Each must account for every character of a field. Earlier versions
returned a confident answer for the part they recognised: `7-18 7-15` became `7-18`, and
`max 60 min lauantai` became 60 minutes with the Saturday condition dropped. Now both are flagged.
Every area ends with a status, an issue code a program can branch on, and a reason in plain words
for the driver. Of the 385 uncertain areas, 301 carry a free-text condition we do not parse, 86
an unreadable field and 1 genuinely ambiguous hours.

> *To add: the before-and-after table of parser output (board task R4).*

---

## 4. Exploration

Everything planned in the canvas's exploration box was carried out. Tables:
`docs/report_stats.md`; charts: `docs/figures/`.

### The typical area

Following the course's practice of describing the typical case before plotting anything (the mode
of each category, the median of each number), the typical Helsinki parking area is **paid**,
**Monday to Friday 9-21 and Saturday 9-18**, has a **4-hour** limit where one is stated, covers
**46 m²**, and lies in **Kampinmalmi**, the central district. That hours pattern covers 32.9% of
areas with stated hours, which is also the score of the dummy baseline the learning task must
beat.

![Areas by rule type](figures/rule_types.png)

Three quarters of street parking allows parking in some form. The remaining quarter, reserved and
banned, is where fines happen and is exactly what a driver cannot see from the car. Reserved bays
look ordinary: the largest groups are e-scooters (312), electric cars (187), taxis (122) and
loading (100), with the full list in Appendix A.

### Where the register is, and what it says there

![Rule types per district](figures/rule_type_by_district.png)

Two findings. First, this is a city-centre register: Kampinmalmi, Ullanlinna and Kallio alone hold
1,471, 1,330 and 1,009 areas, while 17 of the 30 districts with any area have fewer than ten. The
likely reason is that the city does not regulate kerbside parking in the suburbs, so an empty map
there probably means "no rule" rather than "no data", but nothing in the register lets the app
tell a driver which. Second, rule type clusters by
district: the centre is paid, while Lauttasaari, Munkkiniemi and Haaga are almost entirely free
with a time limit, the parking-disc districts. That matters for the learning task, because holding
out a whole district also holds out a whole rule regime.

**Time limits against rule type.** Limits sit where they should: 1,582 of the 4-hour limits are on
free-limited areas, and paid areas use 1 hour (457) and 4 hours (524). The crosstab also surfaces
register errors that no single-column check would: 2 areas typed "always banned" and 1 of unknown
type carry a 4-hour limit, and 2 "banned during hours" areas carry a 1- or 2-hour one.

### Outliers in polygon size

![Polygon sizes](figures/area_sizes.png)

Sizes span three orders of magnitude, so outliers are found with the interquartile rule on the
logarithm of the area: on the raw scale every large polygon would be an outlier and no small one
could be. That gives bounds of 3.9 to 527 m², with 2 areas below and 35 above. The five largest
are all no-parking zones, up to 9,977 m² in Taka-Töölö, which are whole squares rather than
street sections. **13 of the 35 large polygons overlap another area, 31 areas in all**, and that
is a finding for the app rather than the analysis: where a no-parking zone lies over a street
section, a tap can select the zone instead of the section the driver meant.

### What the app can answer

![Rule status across the city](figures/status_map.png)

| Status | Areas |
|---|---|
| Complete rule published | 7,391 |
| Rule type known, hours missing | 978 |
| Uncertain, with a stated reason | 385 |

### The finding that chose the method

![Accuracy by distance](figures/accuracy_by_distance.png)

Hiding each area's hours and copying them from its nearest same-class neighbour is correct 97.5%
of the time, against 32.9% for always guessing the most common pattern. Accuracy depends almost
entirely on distance: 99.5% within 10 m, 35.4% beyond 200 m. The 978 areas we actually need to
predict sit a median of 153 m from the nearest area we can learn from, with only 17.7% within
50 m, so the headline number describes areas we do not need to predict. The exploration stage
chose the method and also set the honest expectation for it.

---

## 5. Learning

> *To be written when the stage closes. Must cover: the problem as supervised classification of
> the hours pattern; the dummy baseline; same-class k-nearest neighbours; spatially blocked
> validation by district; the distance-matched test and the accuracy it gives; the cut-off chosen
> from accuracy against coverage, favouring accuracy; error analysis; what imputation changes for
> a driver.*

---

## 6. The app and communication of results

> *To be written when the stage closes. Shipped so far: a static map site (Vite, React, Leaflet,
> no backend, about 0.4 MB of data compressed); the answer line, which evaluates a rule at the
> current moment through the holiday calendar and runs it to the next change rather than to the
> end of today's window; a live countdown; a reminder ten minutes before the deadline as a
> calendar alarm plus a notification. Cover: why the answer runs to the next change (a ban that
> ends at 18:00 starts again at 07:00), colour-blind safe colours, and how "check the sign" is
> shown.*

---

## 7. Reflection on the canvas

### What worked

- **Measuring before choosing.** The neighbour experiment in exploration chose the learning method
  and told us in advance how far its accuracy would carry.
- **The exploration plan held.** Every view the canvas listed was produced, and two of them found
  things we had not looked for: register errors in the limit crosstab, and overlapping polygons
  that affect what a tap selects.

### What changed from the plan, and why

- **Live roadworks were dropped**, measured as above.
- **The fines data moved from motivation to stretch.** The 2023 records carry only a month and a
  year, so the planned link to time of day or weather was impossible; street-level density is the
  part that remains buildable.
- **The answer changed shape.** The canvas promised "paid until 21:00, then free". Working through
  real rules showed a window ending is not the rule ending: a car left after a ban ends at 18:00 is
  fined at 07:00 the next morning, so the answer now runs to the next time the rule changes.

> *To add when stages 5 and 6 close: whether predicted hours reached the app, and the
> side-of-the-street selection.*

### What we would do differently

- **A coordinate system bug we caused ourselves.** A GeoJSON file always declares itself WGS84,
  even when it holds metric coordinates, so our metric file was read as degrees. Nothing crashed:
  a spatial join simply matched zero rows, and we noticed only because zero was implausible.
- **Check a dataset before trusting its name.** "Temporary" traffic arrangements last years.
- **Fail closed from the first version.** Our first parsers silently truncated what they did not
  understand, which in an app about honesty is the worst failure available.

---

## 8. Future steps

> *To be written. Candidates, each measured in `docs/future-work.md`: traffic signs from Digiroad
> as a second source (14,386 parking signs in Helsinki, as points with a facing direction and
> typed time panels, measured 14 Oct 2026 from `digiroad:dr_liikennemerkit`), street-level fine
> density, and other cities with open parking registers.*

---

## 9. Learning outcomes

> *To be written by each of us.*

---

## Appendix A. What "reserved" means in practice

| Reserved for | Areas |
|:--|--:|
| Electric scooter | 312 |
| Electric car | 187 |
| Taxi | 122 |
| Loading zone | 100 |
| Accessible parking | 88 |
| Tourist coach | 63 |
| not stated | 60 |
| Diplomatic vehicle | 59 |
| Motorcycle | 17 |
| Bicycle | 14 |
| Taxi, charging | 8 |
| 8 other types | 13 |

## Appendix B. Generated tables

Summary statistics, time limit against rule type, size outliers, raw spellings per field and issue
codes, as generated: `docs/report_stats.md`.
