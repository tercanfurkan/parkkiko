# Parkkiko task board

To claim a task, put your name in Owner. Status is To do, Doing or Done.

Deadlines: spotlight talk in week 42, final submission on 27 October.

## UX

| Task | Owner | Status | Notes |
|---|---|---|---|
| Pen sketches of the main flow | | To do | Open map at location, tap street section, pick side, see answer and timeline, change time. |
| Figma mockups | | To do | Mobile screens from the sketches. Colour-blind-safe colours, each paired with a text label. |

## Data visualisation and discovery

| Task | Owner | Status | Notes |
|---|---|---|---|
| Explore rule fields | | To do | Notebook 01. Class and space-type mix, messy strings, contradictions, missing hours. |
| Validate the neighbour hours idea | | To do | Notebook 02. Accuracy at realistic distances: missing areas are a median 148 m from a known area. |
| Explore violations | | To do | Notebook 03. Decide whether street-level fine risk is worth adding. |
| Report figures | | To do | Pick 3 or 4 final figures for the report and the talk. |

## Data processing

| Task | Owner | Status | Notes |
|---|---|---|---|
| Parse hours | | To do | "9-21, (9-18)" means Mon–Fri 9–21, Sat 9–18. Ambiguous values become uncertain. |
| Normalise maximum parking time | | To do | 25 spellings such as "4 h", "4h" and "4" become minutes or no limit. |
| Class and space type to rule type | | To do | Paid, free with time limit, banned during hours, always banned, reserved. |
| Seasons and holidays | | To do | Seasonal date ranges. A holiday counts as Sunday, the day before as Saturday. |
| Contradictions and extra info | | To do | Contradicting fields become uncertain. Free text is shown to the driver as written. |
| Temporary traffic arrangements | | To do | Match roadworks to parking areas. Active roadworks make the answer uncertain. |

## Learning

| Task | Owner | Status | Notes |
|---|---|---|---|
| Validation setup | | To do | Hold out whole districts. Hide close neighbours so test distances match the missing areas. |
| Nearest-neighbour model | | To do | Same-class neighbours. Compare with always guessing the most common hours, 32.8% correct. |
| Random forest comparison | | To do | Keep the simpler model unless the forest is clearly better. |
| Choose the distance cut-off | | To do | Accuracy versus coverage. Set the accuracy target before seeing results. |

## Web app

| Task | Owner | Status | Notes |
|---|---|---|---|
| Rule evaluation | | To do | Rule and time give an answer and a timeline, such as "paid until 21:00, then free". |
| Location and side of street | | To do | GPS finds nearby sections. The user taps one and picks the side. |
| Time and stay controls | | To do | Change arrival time and planned stay, and the answer updates. |
| Deploy the website | | To do | Static site on GitHub Pages. |

## Report and presentation

| Task | Owner | Status | Notes |
|---|---|---|---|
| Technical report | | To do | Max 5 pages plus appendix. What we did and how, and what we would do differently. |
| Related apps section | | To do | ParkClear, Can I Park Here, ParkRight Copenhagen, EasyPark, and how Parkkiko differs. |
| Spotlight talk | | To do | 3 minutes in week 42, with slides and a demo. |
