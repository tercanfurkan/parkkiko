// The words a driver reads for an evaluated rule. evaluate.js decides; this only phrases it, so
// the wording can change without touching the logic.
//
// The headline answers "can I park, and do I pay". The detail says until when and what follows.
// A clock time is the commitment; the countdown beside it is help, rounded down, never up.
import { reservedFor } from "./style.js";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n) => String(n).padStart(2, "0");

function when({ offset, minute, weekday }) {
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

// "6 h 20 min". Past a day a countdown stops helping: "until Monday 09:00" says it
function countdown(minutes) {
  if (minutes >= 1440) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ");
}

const sentence = (...parts) => parts.filter(Boolean).join(". ") || null;

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

/** { headline, detail } for an area and its evaluate() result. detail may be null. */
export function answer(area, result) {
  const { kind, until, stay } = result;
  if (kind === "check") return { headline: "Check the sign", detail: CHECK[result.why](result) };
  if (kind === "reserved") {
    const who = reservedFor(area);
    return { headline: "Not for you", detail: who ? `Reserved: ${who}` : "Reserved space" };
  }
  if (stay) return { headline: `${LABEL[kind]}, ${duration(stay)} max`, detail: `Until ${when(until)}, then move your car` };
  if (!until) {
    const always = { no_parking: null, paid: "At all hours", free: "No time limit" };
    return { headline: LABEL[kind], detail: always[kind] };
  }
  const left = countdown(until.left);
  return {
    headline: `${LABEL[kind]} until ${when(until)}`,
    detail: sentence(left && (kind === "no_parking" ? `Allowed in ${left}` : `${left} left`), after(result.then)),
  };
}
