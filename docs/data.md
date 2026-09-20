# Data

## Sources

All from the City of Helsinki's open data, served over the map server's WFS interface at
`https://kartta.hel.fi/ws/geoserver/avoindata/wfs`. Licence is Creative Commons Attribution 4.0.
No account, key or registration is needed; we verified this with bare unauthenticated requests.

| Layer | Rows | Used for |
|---|---|---|
| `avoindata:Pysakointipaikat_alue` | 8,754 | street parking areas, their rules and geometry |
| `avoindata:Tilapainen_liikennejarjestely_alue` | 299 | roadworks and closures, with start and end dates |
| `avoindata:Pysakointivirheet` | 165,724 | 2023 parking fines, optional, exploration only |

We request metric coordinates (EPSG:3879) for analysis and GPS coordinates (EPSG:4326) for the
map. **A GeoJSON file always declares itself as WGS84 even when it is not**, so the metric file
must have its coordinate system set explicitly on read or every distance comes out wrong.

## Files

| File | Size | In git | Purpose |
|---|---|---|---|
| `data/raw/<date>/*.geojson` | 14.5 MB | no | dated snapshot, exactly as the city served it |
| `data/processed/parking_rules.parquet` | 0.8 MB | **yes** | analysis snapshot, one row per parking area |
| `web/public/data/parking_areas.geojson` | 4.7 MB, 0.43 MB gzipped | no | what the app loads |

The processed file is committed so all three of us analyse identical data and results reproduce.
Raw snapshots stay out of git and are re-fetched only when re-processing. Both derived files come
from one script, so the rules in the app and in the analysis cannot drift apart.

## Timings, measured

| Step | Time |
|---|---|
| Fetch the three core layers | 7-14 s, varies with the server |
| Fetch 2023 violations as well | +31 s |
| Process everything into both outputs | ~2 s |
| Load the processed file in a notebook | <1 s |
| Build a spatial index over 8,754 areas | 3 ms |
| Find areas within 50 m of a point | 0.04 ms |

The whole dataset is under a megabyte once it is not GeoJSON. That is why there is no
database, object store or query service: free static hosting covers the app, and git covers
the team.

## What the processing produces

Each area gets a `rule_type` of paid, free with time limit, banned during hours, always banned,
or reserved; parsed `hours`, `duration_min` and `season`; and a `status`:

| Status | Areas | Meaning |
|---|---|---|
| `official` | 7,391 | the register states a complete rule |
| `missing_hours` | 978 | rule type known, no hours published |
| `uncertain` | 385 | something could not be parsed or contradicts itself |

Every uncertain area carries a `reason` in plain words. Nothing is ever guessed: if a value
cannot be read, the area says so instead of showing a wrong answer.

172 areas currently overlap a roadworks arrangement and should not be trusted while it lasts.

## Known limits

- **The register describes the plan, not the street.** A repainted bay or a bagged sign is
  invisible to us, and there is no feedback channel to detect it.
- **Free text is not parsed.** 301 areas carry conditions in prose, such as a night driving ban.
  These are marked uncertain and shown to the driver verbatim to judge.
- **Side of the street cannot be determined from GPS.** Rules differ per side, and phone accuracy
  in a street canyon is comparable to the street width, so the driver picks the side.
- **Public holidays are not in any source.** A holiday follows Sunday rules and the day before a
  holiday follows Saturday rules, so the app supplies its own calendar.
- **One area's hours are genuinely ambiguous** (`7-9, 15-17`, two ranges with no brackets) and
  stay uncertain by design.
