// The words a driver reads for an evaluated rule. evaluate.js decides; this only phrases it, so
// the wording can change without touching the logic.
import { reservedFor } from "./style.js";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n) => String(n).padStart(2, "0");

function when({ offset, minute, weekday }) {
  const clock = `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
  if (offset === 0) return clock;
  if (offset === 1) return minute === 0 ? "midnight" : `${clock} tomorrow`;
  return `${clock} ${WEEKDAYS[weekday]}`;
}

function duration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h && `${h} hour${h === 1 ? "" : "s"}`;
  const mins = m && `${m} minute${m === 1 ? "" : "s"}`;
  return [hours, mins].filter(Boolean).join(" ");
}

const CHECK = {
  missing_hours: () => "The register does not publish hours here.",
  uncertain: ({ reason }) => (reason ? `${reason[0].toUpperCase()}${reason.slice(1)}.` : null),
  unknown: () => "We do not recognise this rule.",
  calendar: ({ reason }) => `We are not sure which hours apply today${reason ? `: this day ${reason}` : ""}.`,
  season: () => "The season on the sign does not cover today.",
};

// What follows the current state, as the second line
function then(next) {
  if (!next) return null;
  if (next.kind === "check") return "Then check the sign.";
  if (next.kind === "no_parking") return "Then no parking.";
  if (next.kind === "limited") return next.duration ? `Then a limit of ${duration(next.duration)}.` : "Then a time limit applies.";
  if (next.kind === "paid") return `Free until then, then paid${next.duration ? `, up to ${duration(next.duration)}` : ""}.`;
  return null;
}

// "Then free until 09:00 tomorrow." after a paid or banned spell
function thenFree(next, verb) {
  if (next.kind === "check") return "Then check the sign.";
  if (!next.until) return `Then ${verb}, no limit.`;
  return `Then ${verb} until ${when(next.until)}.${next.thenCheck ? " Then check the sign." : ""}`;
}

/** { headline, detail } for an area and its evaluate() result. detail may be null. */
export function answer(area, result) {
  const { kind, until, stay } = result;
  if (kind === "check") return { headline: "Check the sign.", detail: CHECK[result.why](result) };
  if (kind === "reserved") {
    const who = reservedFor(area);
    return { headline: "Not for you.", detail: who ? `Reserved: ${who}.` : "Reserved space." };
  }
  if (stay) {
    return { headline: `Park here for ${duration(stay)}${kind === "paid" ? ", paid" : ""}.`, detail: `Move by ${when(until)}.` };
  }
  if (kind === "no_parking") {
    if (!until) return { headline: "No parking.", detail: null };
    return { headline: `No parking until ${when(until)}.`, detail: thenFree(result.then, "park here") };
  }
  if (kind === "paid") {
    if (!until) return { headline: "Paid at all times.", detail: null };
    return { headline: `Paid until ${when(until)}.`, detail: thenFree(result.then, "free") };
  }
  if (!until) return { headline: "Park here, no limit.", detail: null };
  return { headline: `Park here until ${when(until)}.`, detail: then(result.then) };
}
