// A reminder before the deadline: a calendar event with an alarm, which the phone fires even with
// the browser closed, and a notification as a bonus while the page is still running.

export const LEAD_MS = 10 * 60000;

// What starts at the deadline that the driver needs warning of
const WORSE = { paid: "Paid parking starts", no_parking: "No parking starts", limited: "The time limit starts", check: "Check the sign" };

/**
 * { title, deadline, at } for an evaluate() result at `now`, or null when nothing gets worse at the
 * deadline or it is under ten minutes away: a reminder then would already be late.
 */
export function reminderFor(result, now) {
  const { kind, until, stay, then } = result;
  if (!until) return null;
  const title = stay ? "Move your car" : (kind === "free" || then?.kind === "check") && WORSE[then?.kind];
  if (!title) return null;
  const at = until.at - LEAD_MS;
  return at > now ? { title, deadline: until.at, at } : null;
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
