// What an area's rule means at a given moment. Every decision here is written out in
// docs/rule-evaluation.md; this file implements it and evaluate.test.js holds it to the examples.
//
// Times are Helsinki wall-clock minutes counted from the evaluated day's midnight, so 21:00
// tomorrow is { offset: 1, minute: 1260 }, and each carries `at`, the instant it happens, so a
// countdown to it is exact even across the nights the clocks change.

const DAY = 1440;
const HALF_HOUR = 30;        // a parking disc is set to the next half or full hour
const LOOK_AHEAD_DAYS = 7;   // every area with hours has a mon_fri window, so a week always finds the next start
const WINDOW_BY_WEEKDAY = ["sun", "mon_fri", "mon_fri", "mon_fri", "mon_fri", "mon_fri", "sat"];

const HELSINKI = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Helsinki",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function helsinkiParts(instant) {
  return Object.fromEntries(HELSINKI.formatToParts(instant).map(({ type, value }) => [type, Number(value)]));
}

function helsinkiNow(instant) {
  const p = helsinkiParts(instant);
  return { midnight: Date.UTC(p.year, p.month - 1, p.day), minute: p.hour * 60 + p.minute };
}

// The instant a Helsinki wall-clock time happens. wall is that time written as if it were UTC.
// Correcting by the zone's offset at the guess, twice, lands right on either side of a clock change.
function instantOf(wall) {
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = helsinkiParts(guess);
    guess += wall - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  return guess;
}

// The calendar day `offset` days from the evaluated one: which window applies, or null when the
// calendar cannot say. A holiday is a date, not a weekday, so it is looked up before the weekday.
function dayRule(midnight, offset, calendar) {
  const date = new Date(midnight + offset * DAY * 60000);
  const [first, last] = calendar.years;
  if (date.getUTCFullYear() < first || date.getUTCFullYear() > last) return null;
  const holiday = calendar.days[date.toISOString().slice(0, 10)];
  if (holiday?.status === "uncertain") return null;
  return { window: holiday?.window ?? WINDOW_BY_WEEKDAY[date.getUTCDay()], weekday: date.getUTCDay(), holiday };
}

// The area's windows laid out on one timeline from yesterday to a week ahead, plus where the
// calendar stops being sure. Yesterday matters for a range like 22-05 that runs into this morning.
function timeline(hours, midnight, calendar) {
  const inForce = [];
  const unsure = [];
  for (let offset = -1; offset <= LOOK_AHEAD_DAYS; offset++) {
    const day = dayRule(midnight, offset, calendar);
    const start = offset * DAY;
    if (!day) {
      unsure.push([start, start + DAY]);
      continue;
    }
    const range = hours[day.window];
    if (!range) continue;
    const [from, to] = range;
    inForce.push([start + from * 60, from < to ? start + to * 60 : start + DAY + to * 60]);
  }
  return { inForce, unsure, end: (LOOK_AHEAD_DAYS + 1) * DAY };
}

// A window already running continues even into a day the calendar is unsure about: it was set by
// a day the calendar is sure of.
function stateAt(line, minute) {
  if (line.inForce.some(([a, b]) => a <= minute && minute < b)) return "in";
  if (line.unsure.some(([a, b]) => a <= minute && minute < b)) return "unsure";
  return "out";
}

// The next moment the state changes, or null if it holds for the whole look-ahead. Edges where
// nothing changes are skipped, which is what joins back-to-back windows: 0-24 Monday to Friday
// is paid until Saturday, not until midnight.
function nextChange(line, minute) {
  const from = stateAt(line, minute);
  const edges = [...line.inForce, ...line.unsure].flat().filter((m) => m > minute && m < line.end).sort((a, b) => a - b);
  for (const edge of edges) {
    const state = stateAt(line, edge);
    if (state !== from) return { minute: edge, state };
  }
  return null;
}

// A time on the answer's clock, and `at`, the instant it happens, for a countdown
function moment(midnight, minute) {
  const offset = Math.floor(minute / DAY);
  return {
    offset, minute: minute - offset * DAY, weekday: new Date(midnight + offset * DAY * 60000).getUTCDay(),
    at: instantOf(midnight + minute * 60000),
  };
}

function inSeason(season, midnight) {
  const date = new Date(midnight);
  const today = [date.getUTCMonth() + 1, date.getUTCDate()];
  const after = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] >= b[1]);
  const { start, end } = season;
  return after(start, end)
    ? after(today, start) || after(end, today)       // a season that wraps the new year
    : after(today, start) && after(end, today);
}

// What applies while the rule is in force, and outside it, per rule type. The same window means
// opposite things: a paid area costs money inside it, a banned-hours area forbids parking.
const INSIDE = { paid: "paid", free_limited: "free", banned_hours: "no_parking" };
const OUTSIDE = { paid: "free", free_limited: "free", banned_hours: "free" };
// Where the time limit applies. Outside its window a paid or free-limited area has none; a
// banned-hours area with a limit is read as limiting the time you may park, which errs safe.
const LIMITED = { paid: "in", free_limited: "in", banned_hours: "out" };

/**
 * The answer for `area` at the instant `now`, given the holiday calendar.
 *
 * Returns one of:
 * - { kind: "check", why, reason? }      do not answer: why is missing_hours, uncertain, unknown,
 *                                         calendar or season
 * - { kind: "no_parking" }               never
 * - { kind: "reserved" }                 not for this driver
 * - { kind, until, stay?, then, disc?, estimate? }
 *                                         kind is paid, free or no_parking until `until`; `stay`
 *                                         is set when the time limit ends the stay first; `then`
 *                                         is what follows, { kind: "move" } when the driver must
 *                                         leave; `disc` is the time to set a parking disc to;
 *                                         `estimate` is set, in metres from its source, when the
 *                                         hours are stage 5's prediction (pipeline/predict.py)
 */
export function evaluate(area, now, calendar) {
  const { status, predicted_hours } = area;
  if (status === "missing_hours" && !predicted_hours) return { kind: "check", why: "missing_hours" };
  if (status !== "official" && status !== "missing_hours") return { kind: "check", why: "uncertain", reason: area.reason };
  const result = evaluateRule(area, predicted_hours ?? area.hours, now, calendar);
  return predicted_hours && result.kind !== "check" ? { ...result, estimate: area.predicted_from_m } : result;
}

function evaluateRule(area, hours, now, calendar) {
  const { rule_type, duration_min, season } = area;
  if (!(rule_type in INSIDE) && rule_type !== "always_banned" && rule_type !== "reserved") {
    return { kind: "check", why: "unknown" };
  }

  const { midnight, minute } = helsinkiNow(now);
  if (season && !inSeason(season, midnight)) return { kind: "check", why: "season" };
  if (rule_type === "always_banned") return { kind: "no_parking" };
  if (rule_type === "reserved") return { kind: "reserved" };
  if (!hours) return { kind: "check", why: "missing_hours" };

  const line = timeline(hours, midnight, calendar);
  const state = stateAt(line, minute);
  if (state === "unsure") {
    const day = calendar.days[new Date(midnight).toISOString().slice(0, 10)];
    return { kind: "check", why: "calendar", ...(day?.reason && { reason: day.reason }) };
  }

  const kind = state === "in" ? INSIDE[rule_type] : OUTSIDE[rule_type];
  const at = (m) => moment(midnight, m);
  const change = nextChange(line, minute);

  // Free parking under a limit of less than a day needs a parking disc: docs/rule-evaluation.md
  const short = duration_min > 0 && duration_min < DAY;
  const underLimit = kind === "free" && short && LIMITED[rule_type] === state;
  const start = underLimit ? Math.ceil(minute / HALF_HOUR) * HALF_HOUR : minute;
  const disc = underLimit ? { disc: at(start) } : {};

  // The time limit ends the stay before the rule changes: move by then, nothing follows
  if (duration_min && LIMITED[rule_type] === state && (!change || start + duration_min < change.minute)) {
    return { kind, stay: duration_min, until: at(start + duration_min), then: null, ...disc };
  }
  if (!change) return { kind, until: null, then: null };
  if (change.state === "unsure") return { kind, until: at(change.minute), then: { kind: "check" }, ...disc };

  // What starts when the rule next comes into force
  const comesBack =
    rule_type === "free_limited" ? { kind: "limited", ...(duration_min && { duration: duration_min }) }
    : rule_type === "paid" && duration_min ? { kind: "paid", duration: duration_min }
    : { kind: INSIDE[rule_type] };
  // From the end of a window to the next start, or to where the calendar stops being sure
  const freeUntilNext = (from, then = comesBack) => {
    const after = nextChange(line, from);
    if (!after) return { until: null, then: null };
    return { until: at(after.minute), then: after.state === "unsure" ? { kind: "check" } : then };
  };

  // Parked before a free limit starts: the disc goes to its start, and the limit runs from there
  if (rule_type === "free_limited" && state === "out" && short) {
    return { kind, until: at(change.minute + duration_min), then: { kind: "move" }, disc: at(change.minute) };
  }
  if (state === "out") return { kind, until: at(change.minute), then: comesBack, ...disc };
  // A free stay that outlasts the window: when the limit next starts, the disc no longer covers it
  if (kind === "free") return { kind, ...freeUntilNext(change.minute, underLimit ? { kind: "move" } : comesBack), ...disc };
  const next = freeUntilNext(change.minute);
  return {
    kind,
    until: at(change.minute),
    then: { kind: "free", until: next.until, ...(next.then?.kind === "check" && { thenCheck: true }) },
  };
}
