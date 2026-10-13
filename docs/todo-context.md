# What to read before picking up a task

A one-page index. The tasks are in [TODO.md](TODO.md); this says what to use for each and what
goes wrong. If you have not seen the project, read [prompt.md](prompt.md) first.

**The principle everything bends to:** the app never answers more confidently than the data
supports. A wrong "you may park here" costs a driver a fine; an honest "check the sign" costs
nothing. A change that makes the app sound more certain is a regression even when it looks like
an improvement.

## Right now

The spotlight demo is this week. The priority is look and feel for the least effort, so the
answer line first and the parking reminder as a stretch. **Predicted hours are not shipping
before the demo**: the learning task has not started, 978 areas will keep saying the register
publishes no hours there, and that is an honest answer on stage rather than a gap.

## Per task

| Doing this | Read | Use | Trap |
|---|---|---|---|
| The answer line | [rule-evaluation.md](rule-evaluation.md) | `web/public/data/parking_areas.geojson`, `holidays.json` | The hours mean opposite things per rule type: inside the window a paid area costs money and a banned one forbids parking. Backwards inverts 237 areas. |
| Start parking, remind me | the row in [TODO.md](TODO.md) | `localStorage`, the same `evaluate()` | iOS Safari only notifies an installed PWA, so the in-page countdown is the mechanism and the notification the bonus. |
| Anything touching the map data | the contract in [TODO.md](TODO.md) | the committed GeoJSON | A property is absent, never null or empty. Test for presence. |
| Labels and colours | `web/src/style.js` | `tyyppi`, `luokka`, `rule_type` | The app owns every word a driver reads. The pipeline ships the register's own values. |
| Anything in the pipeline | [data.md](data.md) | `pipeline/rules.py` first | Parsers fail closed. A partial answer is the bug, not a feature. |
| The learning task | the rows in [TODO.md](TODO.md) | `data/processed/parking_rules.parquet` | Neighbouring sections of one street are near-duplicates. A random split tests on copies of the training data. |
| Report or talk | [process.md](process.md), [presentation.md](presentation.md) | [report_stats.md](report_stats.md) | Figures are generated, never typed. Rerun `analysis/report_stats.py`. |

## Where things are

- **Tasks, the data contract, known traps:** [TODO.md](TODO.md)
- **What a rule means at a given moment:** [rule-evaluation.md](rule-evaluation.md)
- **Sources, file sizes, column meanings, limits:** [data.md](data.md)
- **The project stage by stage:** [process.md](process.md)
- **Measured figures, generated:** [report_stats.md](report_stats.md)
- **Ideas we measured and rejected:** [future-work.md](future-work.md), read before proposing a
  data source
- **Commands:** the README owns them

## Before you push

```bash
.venv/bin/python -m pytest tests -q     # the pipeline and the data contract
cd web && npm test                      # what the app promises drivers
```

Both run in under a second. The frontend tests read the committed data file, so they catch a
regenerated file that would break the app.
