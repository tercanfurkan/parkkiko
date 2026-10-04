# Data

## Sources

All from the City of Helsinki's open data, served over the map server's WFS interface at
`https://kartta.hel.fi/ws/geoserver/avoindata/wfs`. Licence is Creative Commons Attribution 4.0.
No account, key or registration is needed; we verified this with bare unauthenticated requests.

| Layer | Rows | Used for |
|---|---|---|
| `avoindata:Pysakointipaikat_alue` | 8,754 | street parking areas, their rules and geometry |
| `avoindata:Piirijako_peruspiiri` | 34 | basic districts, to name where an area sits |

We download metric coordinates (EPSG:3879), which makes distances come out in metres, and
convert to GPS coordinates once when exporting for the map. **A GeoJSON file always declares itself as WGS84 even when it is not**, so the metric file
must have its coordinate system set explicitly on read or every distance comes out wrong.

## Files

| File | Size | In git | Purpose |
|---|---|---|---|
| `data/raw/<date>/*.geojson` | 7.8 MB | no | dated snapshot, exactly as the city served it |
| `data/processed/parking_rules.parquet` | 0.8 MB | **yes** | analysis snapshot, one row per parking area |
| `web/public/data/parking_areas.geojson` | 2.8 MB, 0.32 MB gzipped | **yes** | what the app loads |
| `web/public/data/holidays.json` | 6 KB | **yes** | dates whose parking window differs from their weekday |

The processed file is committed so all three of us analyse identical data and results reproduce.
The app's file is committed too, so the map runs straight after a clone with no Python and no
network. Raw snapshots stay out of git and are re-fetched only when re-processing.

Both derived files are written by one function, `write_web` in `pipeline/export_web.py`, whether
the pipeline produces them or someone rebuilds them, so the app and the analysis cannot disagree
about what a rule says. Because the app's file is committed and generated, it can fall behind the
data it came from: `python pipeline/export_web.py --check` rebuilds it to a temporary path and
compares, so staleness is something you can test rather than hope about.

## Timings, measured

| Step | Time |
|---|---|
| Fetch the register and the districts | ~2.4 s |
| Rebuild only the app's file from the committed snapshot | ~0.7 s |
| Process everything into both outputs | ~1.4 s |
| Load the processed file in a notebook | <1 s |
| Build a spatial index over 8,754 areas | 3 ms |
| Find areas within 50 m of a point | 0.04 ms |

The whole dataset is under a megabyte once it is not GeoJSON. That is why there is no
database, object store or query service: free static hosting covers the app, and git covers
the team.

## What the processing produces

Each area gets a `rule_type` of paid, free with time limit, banned during hours, always banned,
or reserved; English labels in `class_name_en` and `space_type_en`; parsed `hours`,
`duration_min` and `season`; and a `status`:

| Status | Areas | Meaning |
|---|---|---|
| `official` | 7,391 | the register states a complete rule |
| `missing_hours` | 978 | rule type known, no hours published |
| `uncertain` | 385 | something could not be parsed or contradicts itself |

Every uncertain area carries an `issue_codes` value (`unreadable`, `ambiguous`, `note`) for code
to branch on, and a `reason` in plain words for the driver. The parsers fail closed: they must
account for every character of a field, so `7-18 7-15` is flagged as ambiguous rather than read
as `7-18`, and an unrecognised space type is flagged rather than falling back to the class.

## Columns

| Column | Meaning |
|---|---|
| `id` | the register's own area id, unique |
| `rule_type` | paid, free_limited, banned_hours, always_banned, reserved, unknown |
| `class_name_en` | English name of the parking class, or empty for a class we do not recognise |
| `space_type_en` | English name of the space type, where the register states one we recognise |
| `hours` | parsed windows, e.g. `{"mon_fri": [9, 21], "sat": [9, 18]}` |
| `duration_min` | maximum parking time in minutes; 0 means explicitly no limit |
| `season` | months and days the rule applies, or empty for all year |
| `status` | official, missing_hours or uncertain |
| `issue_codes` | unreadable, ambiguous or note, for code to branch on |
| `district` | one of 34 basic districts, by the area's centre; 30 have parking areas |
| `reason` | the same thing in plain words, for the driver |
| `luokka`, `luokka_nimi`, `tyyppi`, `voimassaolo`, `kesto`, `kausi`, `lisatieto` | the register's own fields, kept so any parse can be traced back |
| `geometry` | MultiPolygon, EPSG:3879 |

Before writing, the pipeline refuses to continue unless ids are unique and present, every area has
a geometry we can measure, every shape is a polygon, and the coordinates are metres around
Helsinki. That last one matters: reading the file asserts the coordinate system rather than
verifying it, so if the server ever returned degrees the numbers would land nowhere near the city.

The parquet is written by pyarrow. Versions before 21 cannot read it (`Repetition level histogram
size mismatch`), which is why `requirements.txt` pins a floor rather than leaving it open.

## Known limits

- **The register describes the plan, not the street.** A repainted bay or a bagged sign is
  invisible to us, and there is no feedback channel to detect it.
- **Free text is not parsed.** 301 areas carry conditions in prose, such as a night driving ban.
  These are marked uncertain and shown to the driver verbatim to judge.
- **Side of the street cannot be determined from GPS.** Rules differ per side, and phone accuracy
  in a street canyon is comparable to the street width, so the driver picks the side.
- **Public holidays are not in the register.** `pipeline/export_holidays.py` writes a calendar
  from the `holidays` package, covering three years from the day it runs. It needs regenerating
  before that runs out; `--check` fails once the current year is past the range.
- **Christmas Eve and Midsummer Eve are flagged rather than resolved.** The calendar calls them
  holidays and we have not confirmed the city's parking rules do. Reading them as Sundays would
  tell a driver parking is free when it may be paid, so they, and the days that derive from
  them, carry `uncertain`.
- **Temporary traffic arrangements are not usable**, see [future-work.md](future-work.md).
- **One area's hours are genuinely ambiguous** (`7-9, 15-17`, two ranges with no brackets) and
  stay uncertain by design.
