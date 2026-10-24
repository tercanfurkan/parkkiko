// A reminder before the deadline: a calendar event with an alarm, which the phone fires even with
// the browser closed, and a notification as a bonus while the page is still running.

export const LEAD_MS = 10 * 60000;

// What starts at the deadline that the driver needs warning of
const WORSE = {
  paid: "Paid parking starts", no_parking: "No parking starts", limited: "The time limit starts",
  check: "Check the sign", move: "Move your car",
};

/**
 * { title, deadline, at } for an evaluate() result at `now`, or null when nothing gets worse at the
 * deadline or it is under ten minutes away: a reminder then would already be late.
 */
export function reminderFor(result, now) {
  const { kind, until, stay, then } = result;
  if (!until || stay) return null;
  const title = (kind === "free" || then?.kind === "check") && WORSE[then?.kind];
  if (!title) return null;
  const at = until.at - LEAD_MS;
  return at > now ? { title, deadline: until.at, at } : null;
}

/**
 * What the driver can do beside the answer: { type: "start" } for a time limit, which runs from
 * when they leave the car; { type: "remind", reminder } for a fixed deadline that gets worse; or null.
 */
export function actionFor(result, now) {
  if (result.stay) return { type: "start" };
  const reminder = reminderFor(result, now);
  return reminder && { type: "remind", reminder };
}

/**
 * A stay started now, from a result evaluated at the moment the driver taps: null if no limit
 * applies. `disc` is the instant the parking disc was set to, kept so the parked view can show it.
 */
export function stayFor(area, result) {
  if (!result.stay) return null;
  return {
    areaId: area.id, title: "Move your car", deadline: result.until.at, at: result.until.at - LEAD_MS,
    ...(result.disc && { disc: result.disc.at }),
  };
}

const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// RFC 5545 text: backslash, semicolon and comma are escaped, newlines written as \n
const text = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** An .ics file: an event at the deadline with an alarm LEAD_MS before it. */
export function calendarFile({ title, deadline }, { detail, url }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parkkiko//EN",
    "BEGIN:VEVENT",
    `UID:${deadline}-${Math.random().toString(36).slice(2)}@parkkiko`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(deadline)}`,
    `DTEND:${stamp(deadline + 15 * 60000)}`,
    `SUMMARY:${text(`${title} (Parkkiko)`)}`,
    `DESCRIPTION:${text(detail)}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `TRIGGER:-PT${LEAD_MS / 60000}M`,
    `DESCRIPTION:${text(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
