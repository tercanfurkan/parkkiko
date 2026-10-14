// The words a driver reads for an evaluated rule. evaluate.js decides; this only phrases it, so
// the wording can change without touching the logic.
//
// The headline answers "can I park, and do I pay", with the clock time that is the commitment.
// The countdown is help beside it, ticking; the detail says what follows.
import { reservedFor } from "./style.js";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n) => String(n).padStart(2, "0");

/** "21:00", "09:00 tomorrow", "Monday 09:00" */
export function when({ offset, minute, weekday }) {
  const clock = `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
  if (offset === 0) return clock;
  if (offset === 1) return minute === 0 ? "midnight" : `${clock} tomorrow`;
  return `${WEEKDAYS[weekday]} ${clock}`;
}

function duration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h && `${h} hour${h === 1 ? "" : "s"}`;
  const mins = m && `${m} minute${m === 1 ? "" : "s"}`;
  return [hours, mins].filter(Boolean).join(" ");
}

/** "11:28:42" for a countdown in milliseconds. Rounded down: never promise time that is not there. */
export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(pad).join(":");
}

const DAY_MS = 86400000;

const CHECK = {
  missing_hours: () => "The register does not publish hours here",
  uncertain: ({ reason }) => (reason ? `${reason[0].toUpperCase()}${reason.slice(1)}` : null),
  unknown: () => "We do not recognise this rule",
  calendar: ({ reason }) => `We are not sure which hours apply today${reason ? `: this day ${reason}` : ""}`,
  season: () => "The season on the sign does not cover today",
};

// What follows, said as "… after that"
function after(next) {
  if (!next) return null;
  if (next.kind === "check") return "Check the sign after that";
  if (next.kind === "no_parking") return "No parking after that";
  if (next.kind === "paid") return `Paid after that${next.duration ? `, ${duration(next.duration)} max` : ""}`;
  if (next.kind === "limited") return next.duration ? `${duration(next.duration)} max after that` : "A time limit applies after that";
  // free, after a paid or banned spell
  if (!next.until) return "Free after that, no time limit";
  return `Free after that until ${when(next.until)}${next.thenCheck ? ", then check the sign" : ""}`;
}

const LABEL = { paid: "Paid parking", free: "Free parking", no_parking: "No parking" };

/**
 * { headline, detail, countdown? } for an area and its evaluate() result at `now`. detail may be
 * null. countdown is { to, label }: the instant to count down to and how to say it, present only
 * within a day, since past that "until Monday 09:00" says it better.
 */
export function answer(area, result, now) {
  const { kind, until, stay } = result;
  if (kind === "check") return { headline: "Check the sign", detail: CHECK[result.why](result) };
  if (kind === "reserved") {
    const who = reservedFor(area);
    return { headline: "Not for you", detail: who ? `Reserved: ${who}` : "Reserved space" };
  }
  // A time limit runs from when the driver leaves the car, so there is nothing to count down yet
  if (stay) return { headline: `${LABEL[kind]}, ${duration(stay)} max`, detail: `Park now and move by ${when(until)}` };
  const countdown = until && until.at - now < DAY_MS ? { to: until.at, label: kind === "no_parking" ? "Allowed in" : "left" } : undefined;
  if (!until) {
    const always = { no_parking: null, paid: "At all hours", free: "No time limit" };
    return { headline: LABEL[kind], detail: always[kind] };
  }
  return { headline: `${LABEL[kind]} until ${when(until)}`, detail: after(result.then), countdown };
}
