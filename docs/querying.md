# Querying the data with SQL

You do not need geopandas, pandas or a notebook to explore this data. DuckDB reads the processed
file directly and speaks ordinary SQL, including spatial functions. There is no server, no
account and nothing to start.

```bash
.venv/bin/python -m duckdb          # or: pip install duckdb && duckdb
```

Then point queries straight at the file. Coordinates are metres (EPSG:3879), so distances come
out in metres.

## How much can the app answer?

```sql
select status, rule_type, count(*) as areas
from 'data/processed/parking_rules.parquet'
group by 1, 2
order by areas desc;
```

## Why is an area uncertain?

Every uncertain area explains itself in plain words.

```sql
select reason, count(*) as areas
from 'data/processed/parking_rules.parquet'
where status = 'uncertain'
group by 1
order by areas desc;
```

## Which raw spellings exist?

Useful when the city publishes a new variant the parsers have not seen.

```sql
select voimassaolo, count(*) as areas
from 'data/processed/parking_rules.parquet'
group by 1
order by areas desc
limit 20;
```

## What is near a point?

Load the spatial extension once per session.

```sql
install spatial; load spatial;

select id, rule_type, hours, duration_min, status,
       round(ST_Distance(geometry, ST_Point(25496500, 6672800))) as metres
from 'data/processed/parking_rules.parquet'
where metres < 150
order by metres;
```

## Where are the gaps?

```sql
select rule_type, count(*) as missing
from 'data/processed/parking_rules.parquet'
where status = 'missing_hours'
group by 1
order by missing desc;
```

## Roadworks right now

```sql
select id, rule_type, roadworks_until
from 'data/processed/parking_rules.parquet'
where roadworks_until is not null
order by roadworks_until;
```

## Seeing it on a map without code

Run `python pipeline/process.py`, then drag `web/public/data/parking_areas.geojson` onto
[kepler.gl](https://kepler.gl) or [Felt](https://felt.com). Both give an interactive map where
you can colour by `rule_type` or `status` and filter, with nothing to install.
