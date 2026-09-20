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
car: 165,724 fines sit on 10,932 distinct coordinates, with 3,705 at a single address. Only 15%
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
