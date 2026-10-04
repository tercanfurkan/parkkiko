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
the sign", which no rule lookup can do. A street-level density layer is the buildable half of
this, and is on the task board as the project's stretch goal.

**The weather idea, and why only half of it works.** Enforcement surely varies: rain may keep
inspectors indoors, and nobody writes tickets at 04:00 on Christmas morning, so a quiet period
may mean quiet enforcement rather than careful parking. Testing that needs a timestamp, and the
records carry only `vuosi` and `kuukausi`, a year and a month. There is no day and no hour, so a
fine cannot be matched to the weather when it was written, and the map cannot be conditioned on
"it is raining now" or "it is 04:00". What remains possible is monthly: fines per street per
month against monthly rainfall and temperature, which the Finnish Meteorological Institute
publishes openly. Earlier years are CSV downloads on the dataset page, so a panel of roughly 120
months is available. I have not checked their API.

**Why it is not in the project.** The fines are geocoded to street addresses, not to the parked
car: all 165,724 records sit on 10,932 distinct coordinates, with 3,705 at a single address. Only 15%
fall within 10 m of a parking area and 41% within 20 m, so a fine cannot be attributed to an area
or a street side, only to a street. Time resolution is the month, so nothing can be said about the
hour. Counts also partly reflect where inspectors patrol rather than where rules are broken: a quiet
month may be a staffing change, and nothing in the data separates that from weather or from
behaviour. Any layer built on this says "where fines happen", never "where you will be fined",
and never overrides the register's own rule.

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
