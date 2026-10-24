# What the rule means at a given moment

The app turns a parking area and a time into one sentence: **"Park here for 2 hours."** These are
the decisions behind that sentence. They are written down because they are judgement calls about
Finnish parking signs, not facts in the data, and because guessing them differently in the
browser than in the pipeline would make the app and the analysis disagree.

Implemented as `evaluate(area, now, calendar)` in `web/src/evaluate.js`, held to the worked examples
at the bottom by `evaluate.test.js`. The wording a driver reads is `web/src/answer.js`.

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
| `paid` | you pay, and `duration_min` caps the stay if present | free until the window next starts |
| `free_limited` | free, but `duration_min` caps the stay | free until the window next starts |
| `banned_hours` | you may not park | you may park until the window next starts; a `duration_min` caps it |
| `always_banned` | never, whatever the hours say | never |
| `reserved` | not for you, whatever the hours say | not for you |
| `unknown` | check the sign | check the sign |

`9-21` is in force from 09:00 to 20:59. **At 21:00 it is over.** A range that wraps, like
`22-05`, runs from 22:00 to 04:59 the next morning.

## 3. Until when, and never "no limit" while the rule comes back

**A window ending is not the end of the rule.** A ban that ends at 18:00 starts again at 07:00
tomorrow, and a car left overnight is fined. So the answer always runs to the next time the rule
changes, looking up to a week ahead through the calendar:

- Back-to-back windows count as one: `0-24` Monday to Friday is paid until Saturday 00:00, not
  until midnight.
- A free stay that starts inside a free-limited window and outlasts it runs on to the next start,
  and no further: at 18:30 with a 4-hour limit ending 20:00, move by 08:00 tomorrow, because the
  disc does not carry over (see the parking disc below).
- The look-ahead stops where the calendar stops being sure, an uncertain day or a date past its
  range: "Park here until midnight. Then check the sign."
- Only a rule in force at no hour of the coming week gives "no limit". No official area has one,
  since every area with hours has a `mon_fri` window.

`duration_min` caps the stay when it ends first: "Free parking, 2 hours max. Park now and move by
16:00." There is no countdown for it: the limit runs from when the driver leaves the car, not from
when they look. `0` means the register explicitly states no limit, and absent means none was
stated: neither caps.

**A free stay under a time limit needs a parking disc.** In Finland, free parking with a time
limit on the sign means displaying a parking disc, and parking without one is fined. The disc is
set to the **next half or full hour after arrival**, and the limit counts from the disc:

- arrive at 14:05, set the disc to 14:30; with a 4-hour limit, move by 18:30;
- arrive at 14:35, set the disc to 15:00; move by 19:00;
- arrive exactly on a mark, 14:30, and the disc stays at 14:30. Whether the rule means that mark
  or the next one, the earlier disc only shortens the stay, so it errs safe.

Two more rules decide when the driver must move:

- **Parked while the limit is off**, the disc is set to when the limit starts, and the limit runs
  from there: at 21:00 in an `8-20` area with 4 hours, set the disc to 08:00 and move by 12:00.
- **A disc does not carry over a gap.** Parked at 18:30 under that limit, the disc says 18:30;
  after 20:00 there is no limit, but at 08:00 it returns and the 18:30 disc no longer covers the
  car, so move by 08:00.

So on free parking under a limit of less than 24 hours, the answer says "Set your parking disc to
15:00" first, before the time, and the move-by time follows from the disc. No disc is needed on
paid parking, where the driver pays instead, which "Paid parking" already says, or where the limit
is 24 hours or more, or none is stated.

The disc belongs to the rule, not to a class. Class 8 names it, but class 1 needs one too, and so
does a banned-hours area with a limit, outside its ban.

The clock time is the commitment, "until 21:00". Beside it a countdown ticks, "11:28:42 left",
**rounded down to the second, never up**, and left out past a day, where "until Monday 09:00" says
it better. It counts to the real instant, so on the night the clocks go forward it is an hour
shorter than the wall clock suggests, not an hour longer.

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
| 8001 | paid, `mon_fri 9-21` | Tue 14:00 | Paid parking until 21:00. 7 h left. Free after that until 09:00 tomorrow |
| 8001 | paid, `mon_fri 9-21` | Tue 21:00 | Free parking until 09:00 tomorrow. 12 h left. Paid after that |
| 8001 | paid, `mon_fri 9-21` | Sun 14:00 | Free parking until 09:00 tomorrow. No Sunday window means no rule today |
| 8006 | free limited, `mon_fri 8-20`, 240 min | Tue 14:00 | Free parking, 4 hours max. Set your parking disc to 14:00. Park now and move by 18:00 |
| 8006 | free limited, `mon_fri 8-20`, 240 min | Tue 14:05 | Free parking, 4 hours max. Set your parking disc to 14:30. Park now and move by 18:30 |
| 8006 | free limited, `mon_fri 8-20`, 240 min | Tue 15:40 | Free parking until 08:00 tomorrow. Set your parking disc to 16:00. Move your car then: the 4 hours from the disc reach 20:00, when the limit ends, and the disc does not cover tomorrow |
| 8006 | free limited, `mon_fri 8-20`, 240 min | Tue 18:30 | Free parking until 08:00 tomorrow. 13 h 30 min left. Set your parking disc to 18:30. Move your car then |
| 8006 | free limited, `mon_fri 8-20`, 240 min | Tue 21:00 | Free parking until 12:00 tomorrow. Set your parking disc to 08:00 tomorrow. Move your car then |
| 8539 | free limited, `mon_fri 0-24`, 24 h | Tue 14:00 | Free parking, 24 hours max. Park now and move by 14:00 tomorrow, no disc |
| 8011 | banned hours, `mon_fri 7-18, sat 9-15` | Tue 12:00 | No parking until 18:00. Allowed in 6 h. Free after that until 07:00 tomorrow |
| 8011 | banned hours, `mon_fri 7-18, sat 9-15` | Tue 19:00 | Free parking until 07:00 tomorrow. 12 h left. No parking after that |
| 8139 | paid, no hours, 60 min | any | The register does not publish hours here. Check the sign. |
| any | paid, `mon_fri 9-21` | 25 Dec 14:00 | Christmas Day follows Sunday, so free. |
| 8001 | paid, `mon_fri 9-21` | Tue 22 Dec 21:00 | Free parking until midnight. 3 h left. Check the sign after that: the 23rd rests on Christmas Eve |
| any | paid, `mon_fri 9-21` | 24 Dec 14:00 | Check the sign: the calendar marks the day uncertain. |

## What the driver should read

The sentence is the product. The headline answers "can I park, and do I pay"; the line under it
says until when and what follows.

- **Free parking, 2 hours max.** Set your parking disc to 14:00. Park now and move by 16:00
- **Paid parking until 21:00.** 6 h 20 min left. Free after that until 09:00 tomorrow
- **No parking until 18:00.** Allowed in 3 h. Free after that until 07:00 tomorrow
- **Check the sign.** *(the reason)*
- **Not for you.** Reserved: Taxi

Never print a rule type as a label on its own. "Free, time limited" is a category, not an answer.
