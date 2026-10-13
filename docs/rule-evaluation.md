# What the rule means at a given moment

The app turns a parking area and a time into one sentence: **"Park here for 2 hours."** These are
the decisions behind that sentence. They are written down because they are judgement calls about
Finnish parking signs, not facts in the data, and because guessing them differently in the
browser than in the pipeline would make the app and the analysis disagree.

Implement `evaluate(area, now, calendar)` as a pure function and test it against the worked
examples at the bottom.

## 1. Which window applies today

`hours` can carry `mon_fri`, `sat` and `sun`. Pick one by the date, not the weekday alone:

1. If the date is in `holidays.json` under `days`, use the `window` it names.
2. If that entry has `"status": "uncertain"`, stop: **check the sign**.
3. If the date is outside the calendar's `years`, stop: **check the sign**. Do not fall back to
   the weekday; that is how Christmas ends up reading as a Tuesday.
4. Otherwise Monday to Friday use `mon_fri`, Saturday `sat`, Sunday `sun`.

If the chosen window is absent, the rule is not in force that day. A sign stating only `mon_fri`
says nothing about Sunday, which means no restriction applies.

**Always use Europe/Helsinki**, never the device clock's zone. A visitor's phone may be on
another one, and a driver standing in Helsinki is subject to Helsinki time.

## 2. What the hours mean, per rule type

The same window means different things. This is the part most likely to be got backwards.

| Rule type | Inside the window | Outside it |
|---|---|---|
| `paid` | you pay, and `duration_min` caps the stay if present | free, no limit |
| `free_limited` | free, but `duration_min` caps the stay | free, no limit |
| `banned_hours` | you may not park | you may park, no limit |
| `always_banned` | never, whatever the hours say | never |
| `reserved` | not for you, whatever the hours say | not for you |
| `unknown` | check the sign | check the sign |

`9-21` is in force from 09:00 to 20:59. **At 21:00 it is over.** A range that wraps, like
`22-05`, runs from 22:00 to 04:59 the next morning.

## 3. How long the driver may stay

Take the earlier of two things:

- the time the window ends, if it ends something that limits them
- now plus `duration_min`

`duration_min` of `0` means the register explicitly states no limit. **Absent means no limit was
stated**, which is not the same thing but leads to the same answer: do not cap.

Round down to a whole number the driver can use. "2 hours", not "2 hours 7 minutes". If under an
hour, use minutes.

## 4. When not to answer

Never resolve any of these into "free" or a duration:

- `status` is `missing_hours`: we know the kind of rule, not when it applies
- `status` is `uncertain`: say what `reason` says
- the calendar says the day is uncertain, or the date is outside its range
- `season` is present and today falls outside it: the sign says something else off-season and we
  do not know what

## Worked examples

Real areas from the committed file. Times are Europe/Helsinki.

| Area | Rule | When | Expected |
|---|---|---|---|
| 8001 | paid, `mon_fri 9-21` | Tue 14:00 | Paid parking, until 21:00. Then free. |
| 8001 | paid, `mon_fri 9-21` | Tue 21:00 | Free, no limit. |
| 8001 | paid, `mon_fri 9-21` | Sun 14:00 | Free, no limit. No Sunday window means no rule. |
| 8006 | free limited, `mon_fri 8-20`, 240 min | Tue 14:00 | Park here for 4 hours. |
| 8006 | free limited, `mon_fri 8-20`, 240 min | Tue 18:30 | Park here for 1 hour 30 minutes, until the rule ends at 20:00. After that, no limit. |
| 8011 | banned hours, `mon_fri 7-18, sat 9-15` | Tue 12:00 | No parking until 18:00. |
| 8011 | banned hours, `mon_fri 7-18, sat 9-15` | Tue 19:00 | Park here, no limit. |
| 8139 | paid, no hours, 60 min | any | The register does not publish hours here. Check the sign. |
| any | paid, `mon_fri 9-21` | 25 Dec 14:00 | Christmas Day follows Sunday, so free. |
| any | paid, `mon_fri 9-21` | 24 Dec 14:00 | Check the sign: the calendar marks the day uncertain. |

## What the driver should read

The sentence is the product. Lead with what they can do, then when it changes.

- **Park here for 2 hours.** Free until 20:00.
- **Park here for 4 hours**, paid. 21:00 onwards is free.
- **No parking** until 18:00.
- **Check the sign.** We cannot read this one: *(the reason)*.
- **Not for you.** Reserved for taxis.

Never print a rule type as a label on its own. "Free, time limited" is a category, not an answer.
