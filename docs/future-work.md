# Future work

Out of scope for the mini-project. Recorded here so the reasoning is not lost, and because two of
these are genuine machine learning opportunities that would improve the app.

## Parking fines as a risk layer

Helsinki publishes every recorded parking violation. The 2023 data holds 156,383 fines and 9,341
warnings, all twelve months, issued by parking inspectors (162,125) and police (3,599).
To pull it locally:

```python
from pipeline.fetch import fetch_layer
import json
fc = fetch_layer("avoindata:Pysakointivirheet", "EPSG:3879")   # ~31 s, 106 MB
json.dump(fc, open("data/raw/violations_2023.geojson", "w"))
```

**Why it is interesting.** It is observed ground truth rather than a target we invented. A model
of where drivers are actually fined would let the app warn "this street is often misread, check
the sign", which no rule lookup can do.

**Why it is not in the project.** The fines are geocoded to street addresses, not to the parked
car: all 165,724 records sit on 10,932 distinct coordinates, with 3,705 at a single address. Only 15%
fall within 10 m of a parking area and 41% within 20 m, so a fine cannot be attributed to an area
or a street side, only to a street. Time resolution is the month, so nothing can be said about the
hour. Counts also partly reflect where inspectors patrol rather than where rules are broken, which
would need addressing before publishing anything.

Dataset: https://hri.fi/data/en_GB/dataset/pysakointivirheet-helsingissa

## Traffic signs as a second source

Digiroad, the national road register, holds 68,010 traffic signs in Helsinki. Street maintainers
are required to report them. Each sign carries a type code and up to four additional panels of
free text, such as `9-21 (9-18)` or
`Vyöhyke/Zon 1. Ei koske P-tunnuksella/Gäller ej med P-tecknet A`.

**Why it is interesting.** It would deliver the original promise of showing the driver the sign a
rule came from, and it gives an independent source to cross-check the parking register against.
Parsing those bilingual, inconsistent panels into structured rules is a real learning task.

**Why it is not in the project.** No field links a sign to the parking area it governs, so the
match must be inferred from geometry with no ground truth to validate it against.

Endpoint: `https://avoinapi.vaylapilvi.fi/vaylatiedot/digiroad/ows`, layer
`digiroad:dr_liikennemerkit`, filter `kuntakoodi=91` for Helsinki.

## Crowdsourced rules

Drivers photograph or type the sign for areas with unknown hours, and an entry is accepted once
enough reports agree.

**Why it is not in the project.** There is no user base during the course, so no confidence
threshold could ever be reached. A wrong entry causes a fine, so it needs moderation. Reports also
reveal where and when someone parked, which raises privacy questions we cannot test.

## Temporary traffic arrangements, evaluated and dropped

The city publishes `avoindata:Tilapainen_liikennejarjestely_alue`, 295 polygons for temporary
traffic arrangements. We built the spatial join, measured what it gave us, and removed it.

It does not describe what its name suggests. The arrangements run for years, not days: a median
of 711 days and a maximum of 3,204. They are construction projects and event permits, not
roadworks closures, so nothing about them is live.

The link to parking is also inferred rather than stated. Of 8,754 parking areas, 191 overlap an
arrangement, 45 of those only overlap one that has already ended, and of the 146 that remain only
18 have a stated purpose that mentions parking at all. The status field does not help: 290 of the
295 records claim to be ongoing, including the expired ones.

So an overlap told us a permit exists nearby, not that the parking spaces are gone. Marking an
area uncertain on that basis is the same unfounded confidence the project exists to avoid.

What this idea actually needs is a feed of real parking suspensions with real dates. Helsinki does
not appear to publish one.

## A risk heatmap from historical fines, and weather

The idea: colour the map by how often drivers are actually fined, then make that risk depend on
the current conditions, on the theory that enforcement varies. Rain might keep inspectors indoors;
nobody is writing tickets at 04:00 on Christmas morning, so a quiet hour in the data may mean
quiet enforcement rather than careful parking.

It is a good hypothesis. Half of it is testable with Helsinki's open data and half is not, and the
dividing line is the time resolution.

**What the fines data actually carries.** Every record has a year and a month, and nothing finer:
the fields are `vuosi` and `kuukausi`, and there is no day, date or hour anywhere in the layer.
Location is the street address, not the parked car: 165,724 records sit on 10,932 distinct
coordinates, 3,705 of them at a single address, and only 15% fall within 10 m of a parking area.

**So the second iteration cannot be built from this source.** Matching a fine to the weather at
the time it was written needs a timestamp, and conditioning the map on "it is raining now" or "it
is 04:00" needs the model to have learned an hour-of-day effect that the data cannot show. The
Christmas-night case is a single day inside a monthly total.

**What is buildable, in order:**

1. **A street-level density layer.** Fines per street, ideally per parking space so long streets
   do not simply dominate, over 2,701 streets. Street, not area or side: the geocoding cannot
   support anything finer. This is a genuine product feature, since a street with a clear sign and
   many fines is a street people misread.
2. **Monthly seasonality.** Twelve points per street per year from the WFS layer, which serves
   2023 only. Earlier years back to 2014 are CSV downloads on the dataset page, so a multi-year
   panel of roughly 120 months is possible with some wrangling.
3. **Monthly weather.** The Finnish Meteorological Institute publishes open observations, which
   would give rainfall and temperature per month to put beside the fine counts. I have not checked
   their API. At monthly resolution this tests "are wet months quieter" and nothing sharper.

**The confound to state plainly in any write-up.** Fine counts measure enforcement as much as
behaviour. A quiet month may mean fewer inspectors, a holiday rota, or a staffing change, and
nothing in the data separates those from weather. That is a reason to present the layer as "where
fines happen" rather than "where you will be fined", and never to let it override the register's
own rule.

Dataset: https://hri.fi/data/en_GB/dataset/pysakointivirheet-helsingissa
