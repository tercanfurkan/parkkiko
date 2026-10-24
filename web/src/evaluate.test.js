import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { evaluate } from "./evaluate.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const features = read("../public/data/parking_areas.geojson").features;
const calendar = read("../public/data/holidays.json");
const area = (id) => features.find((f) => f.properties.id === id).properties;

// Helsinki is UTC+3 until 25 October 2026 and UTC+2 after it.
const at = (local, offset = "+03:00") => new Date(`${local}${offset}`);
// A moment on the answer's own clock: minutes from the evaluated day's midnight, plus its weekday
const t = (day, hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return expect.objectContaining({ offset: day, minute: h * 60 + m });
};

describe("the worked examples in rule-evaluation.md", () => {
  test.each([
    // 8001: paid, mon_fri 9-21
    ["8001 Tue 14:00", 8001, "2026-10-13T14:00", { kind: "paid", until: t(0, "21:00"), then: { kind: "free", until: t(1, "09:00") } }],
    ["8001 Tue 21:00 is already over", 8001, "2026-10-13T21:00", { kind: "free", until: t(1, "09:00"), then: { kind: "paid" } }],
    ["8001 Sun 14:00, no Sunday window", 8001, "2026-10-18T14:00", { kind: "free", until: t(1, "09:00"), then: { kind: "paid" } }],
    // 8006: free limited, mon_fri 8-20, 240 min
    ["8006 Tue 14:00", 8006, "2026-10-13T14:00", { kind: "free", stay: 240, until: t(0, "18:00"), then: null }],
    ["8006 Tue 18:30, the limit outlasts the window", 8006, "2026-10-13T18:30", { kind: "free", until: t(1, "08:00"), then: { kind: "limited", duration: 240 } }],
    // 8011: banned hours, mon_fri 7-18, sat 9-15
    ["8011 Tue 12:00", 8011, "2026-10-13T12:00", { kind: "no_parking", until: t(0, "18:00"), then: { kind: "free", until: t(1, "07:00") } }],
    ["8011 Tue 19:00, the ban returns in the morning", 8011, "2026-10-13T19:00", { kind: "free", until: t(1, "07:00"), then: { kind: "no_parking" } }],
    ["8011 Fri 19:00, Saturday has its own window", 8011, "2026-10-16T19:00", { kind: "free", until: t(1, "09:00"), then: { kind: "no_parking" } }],
    // 8139: paid, no hours published, 60 min
    ["8139 any time", 8139, "2026-10-13T14:00", { kind: "check", why: "missing_hours" }],
  ])("%s", (_, id, local, expected) => {
    expect(evaluate(area(id), at(local), calendar)).toEqual(expect.objectContaining(expected));
  });

  test("Christmas Day follows Sunday, so 8001 is free", () => {
    const answer = evaluate(area(8001), at("2026-12-25T14:00", "+02:00"), calendar);
    expect(answer.kind).toBe("free");
  });

  test("Christmas Eve is unsure in the calendar, so check the sign", () => {
    const answer = evaluate(area(8001), at("2026-12-24T14:00", "+02:00"), calendar);
    expect(answer).toEqual(expect.objectContaining({ kind: "check", why: "calendar" }));
    expect(answer.reason).toBeTruthy();
  });
});

describe("the look-ahead never says no limit when the rule comes back", () => {
  test("it stops at an unsure calendar day instead of reading past it", () => {
    // Tue 22 Dec 21:00: free until the 23rd, which the calendar is unsure about
    const answer = evaluate(area(8001), at("2026-12-22T21:00", "+02:00"), calendar);
    expect(answer).toEqual(expect.objectContaining({ kind: "free", until: t(1, "00:00"), then: { kind: "check" } }));
  });

  test("it stops where the calendar ends", () => {
    // Fri 29 Dec 2028 21:00: the 30th is a Saturday with no window, the 31st a day before a
    // holiday with none either, and then the calendar runs out
    const answer = evaluate(area(8001), at("2028-12-29T21:00", "+02:00"), calendar);
    expect(answer.then).toEqual({ kind: "check" });
  });

  test("a date outside the calendar is not guessed from its weekday", () => {
    const answer = evaluate(area(8001), at("2029-03-06T14:00", "+02:00"), calendar);
    expect(answer).toEqual(expect.objectContaining({ kind: "check", why: "calendar" }));
  });

  test("back-to-back all-day windows join, so Monday is paid until Saturday", () => {
    const allWeekdays = { id: 1, rule_type: "paid", status: "official", hours: { mon_fri: [0, 24] } };
    const answer = evaluate(allWeekdays, at("2026-10-12T10:00"), calendar);
    expect(answer).toEqual(expect.objectContaining({ kind: "paid", until: t(5, "00:00") }));
  });

  test("a rule in force at every hour of the coming week has no end to state", () => {
    // 8269: paid at all hours every day, one hour at a time
    expect(evaluate(area(8269), at("2026-10-13T14:00"), calendar)).toEqual(
      expect.objectContaining({ kind: "paid", stay: 60, until: t(0, "15:00") }),
    );
  });
});

describe("hours mean opposite things per rule type", () => {
  // The trap in todo-context.md: read backwards, this inverts the 237 banned-hours areas
  test("inside the window a paid area costs money and a banned one forbids parking", () => {
    const now = at("2026-10-13T12:00");
    expect(evaluate(area(8001), now, calendar).kind).toBe("paid");
    expect(evaluate(area(8011), now, calendar).kind).toBe("no_parking");
  });

  test("always banned and reserved ignore their hours", () => {
    const now = at("2026-10-13T03:00");
    const banned = features.find((f) => f.properties.rule_type === "always_banned" && f.properties.status === "official" && f.properties.hours);
    const reserved = features.find((f) => f.properties.rule_type === "reserved" && f.properties.status === "official" && f.properties.hours);
    expect(evaluate(banned.properties, now, calendar).kind).toBe("no_parking");
    expect(evaluate(reserved.properties, now, calendar).kind).toBe("reserved");
  });

  test("a time limit on a banned-hours area still caps the stay outside the ban", () => {
    // 9646: no parking mon_fri 9-17, 60 min
    expect(evaluate(area(9646), at("2026-10-13T18:00"), calendar)).toEqual(
      expect.objectContaining({ kind: "free", stay: 60, until: t(0, "19:00") }),
    );
  });
});

describe("when not to answer", () => {
  test("no area the register is unsure about ever comes out as a time", () => {
    const now = at("2026-10-13T14:00");
    const answered = features
      .map((f) => f.properties)
      .filter((p) => p.status !== "official" || p.rule_type === "unknown")
      .filter((p) => evaluate(p, now, calendar).kind !== "check");
    expect(answered.map((p) => p.id)).toEqual([]);
  });

  test("an uncertain area passes its reason on", () => {
    const p = features.find((f) => f.properties.status === "uncertain").properties;
    expect(evaluate(p, at("2026-10-13T14:00"), calendar)).toEqual({ kind: "check", why: "uncertain", reason: p.reason });
  });

  test("outside its season a rule says check the sign", () => {
    const seasonal = features.find((f) => f.properties.season?.end[0] === 10 && f.properties.status === "official").properties;
    expect(evaluate(seasonal, at("2026-11-15T12:00", "+02:00"), calendar)).toEqual(expect.objectContaining({ kind: "check", why: "season" }));
  });
});

describe("Helsinki time, whatever the phone says", () => {
  test("the same moment gives the same answer in any device time zone", () => {
    const now = at("2026-10-13T20:30");
    const before = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      const there = evaluate(area(8001), now, calendar);
      process.env.TZ = "Asia/Tokyo";
      expect(evaluate(area(8001), now, calendar)).toEqual(there);
      expect(there).toEqual(expect.objectContaining({ kind: "paid", until: t(0, "21:00") }));
    } finally {
      process.env.TZ = before;
    }
  });

  test.each([
    ["clocks go forward", "2026-03-29T08:00", "+03:00"],
    ["clocks go back", "2026-10-25T08:00", "+02:00"],
  ])("%s: the wall-clock time stays right", (_, local, offset) => {
    // Sunday 08:00: 8001 has no Sunday window, so free until Monday 09:00 local
    expect(evaluate(area(8001), at(local, offset), calendar)).toEqual(
      expect.objectContaining({ kind: "free", until: t(1, "09:00") }),
    );
  });

  test("a range that wraps past midnight runs into the next morning", () => {
    // No official area wraps today; the four that do are uncertain reserved bays
    const nights = { id: 2, rule_type: "banned_hours", status: "official", hours: { mon_fri: [22, 5] } };
    expect(evaluate(nights, at("2026-10-13T23:00"), calendar)).toEqual(
      expect.objectContaining({ kind: "no_parking", until: t(1, "05:00") }),
    );
    expect(evaluate(nights, at("2026-10-14T03:00"), calendar)).toEqual(
      expect.objectContaining({ kind: "no_parking", until: t(0, "05:00") }),
    );
  });
});

describe("the deadline as a real moment, for the countdown", () => {
  test("is the instant the wall-clock time happens in Helsinki", () => {
    const answer = evaluate(area(8001), at("2026-10-13T14:40:30"), calendar);
    expect(answer.until.at).toBe(Date.parse("2026-10-13T21:00+03:00"));
  });

  test("is an hour nearer across the night the clocks go forward", () => {
    // Saturday 21:00 (UTC+2) to Sunday 09:00 (UTC+3) is 11 hours, not 12: a wall-clock countdown
    // would promise an hour that does not exist
    const sundays = { id: 3, rule_type: "paid", status: "official", hours: { mon_fri: [9, 18], sun: [9, 18] } };
    const answer = evaluate(sundays, at("2026-03-28T21:00", "+02:00"), calendar);
    expect(answer.until.at - Date.parse("2026-03-28T21:00+02:00")).toBe(11 * 3600000);
  });

  test("is an hour further across the night the clocks go back", () => {
    const sundays = { id: 3, rule_type: "paid", status: "official", hours: { mon_fri: [9, 18], sun: [9, 18] } };
    const answer = evaluate(sundays, at("2026-10-24T21:00"), calendar);
    expect(answer.until.at - Date.parse("2026-10-24T21:00+03:00")).toBe(13 * 3600000);
  });
});

// Free parking under a time limit needs a parking disc. Paid parking is paid instead, a limit of
// a day or more needs none, and outside its hours the limit does not apply at all.
describe("the parking disc", () => {
  test.each([
    ["8006 free, 4 h, inside 8-20", 8006, "2026-10-13T14:00", true],
    ["8006 at 18:30, the limit still applies until 20:00", 8006, "2026-10-13T18:30", true],
    ["8025 class 1, 15 min", 8025, "2026-10-13T10:00", true],
    ["9646 after its no-parking hours, 60 min free", 9646, "2026-10-13T18:00", true],
    ["8006 after 20:00, no limit applies", 8006, "2026-10-13T21:00", false],
    ["8006 on Sunday, no window at all", 8006, "2026-10-18T14:00", false],
    ["9646 during its no-parking hours", 9646, "2026-10-13T12:00", false],
    ["8269 paid, 1 h: pay, no disc", 8269, "2026-10-13T14:00", false],
    ["8001 paid", 8001, "2026-10-13T14:00", false],
    ["8539 free, 24 h: no disc", 8539, "2026-10-13T14:00", false],
  ])("%s", (_, id, local, needed) => {
    expect(Boolean(evaluate(area(id), at(local), calendar).disc)).toBe(needed);
  });

  // The disc goes to the next half or full hour after arrival, and the limit counts from the disc
  test.each([
    ["14:05 sets 14:30, so 4 h runs to 18:30", "2026-10-13T14:05", { disc: t(0, "14:30"), stay: 240, until: t(0, "18:30") }],
    ["14:35 sets 15:00, so 4 h runs to 19:00", "2026-10-13T14:35", { disc: t(0, "15:00"), stay: 240, until: t(0, "19:00") }],
    ["arriving on a mark keeps it", "2026-10-13T14:30", { disc: t(0, "14:30"), stay: 240, until: t(0, "18:30") }],
    ["15:40 sets 16:00, and 4 h then reaches the end of the rule at 20:00", "2026-10-13T15:40",
      { disc: t(0, "16:00"), until: t(1, "08:00"), then: { kind: "limited", duration: 240 } }],
  ])("8006: %s", (_, local, expected) => {
    expect(evaluate(area(8006), at(local), calendar)).toEqual(expect.objectContaining(expected));
  });
});
