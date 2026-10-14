import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { evaluate } from "./evaluate.js";
import { actionFor, calendarFile, reminderFor, stayFor } from "./reminder.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const features = read("../public/data/parking_areas.geojson").features;
const calendar = read("../public/data/holidays.json");
const area = (id) => features.find((f) => f.properties.id === id).properties;
const remind = (id, local, offset = "+03:00") => {
  const now = new Date(`${local}${offset}`);
  return reminderFor(evaluate(area(id), now, calendar), now.getTime());
};
const instant = (local, offset = "+03:00") => Date.parse(`${local}${offset}`);

describe("a reminder is offered when something gets worse at the deadline", () => {
  test.each([
    ["free turns paid", 8001, "2026-10-13T21:30", "Paid parking starts", "2026-10-14T09:00"],
    ["free turns no parking", 8011, "2026-10-13T19:00", "No parking starts", "2026-10-14T07:00"],
    ["a time limit starts", 8006, "2026-10-13T18:30", "The time limit starts", "2026-10-14T08:00"],
  ])("%s", (_, id, local, title, deadline) => {
    const reminder = remind(id, local);
    expect(reminder).toEqual({ title, deadline: instant(deadline), at: instant(deadline) - 10 * 60000 });
  });

  test("and where the calendar stops being sure", () => {
    expect(remind(8001, "2026-12-22T21:00", "+02:00")).toEqual(expect.objectContaining({ title: "Check the sign" }));
  });
});

describe("no reminder when there is nothing to warn about", () => {
  test.each([
    ["paid until it turns free", 8001, "2026-10-13T14:40"],
    ["no parking now", 8011, "2026-10-13T12:00"],
    ["not for you", 8016, "2026-10-13T14:00"],
    ["check the sign", 8139, "2026-10-13T14:00"],
  ])("%s", (_, id, local) => {
    expect(remind(id, local)).toBeNull();
  });

  test("less than ten minutes before the deadline, when it would already be late", () => {
    expect(remind(8001, "2026-10-14T08:51")).toBeNull();
    expect(remind(8001, "2026-10-14T08:49")).not.toBeNull();
  });
});

describe("the action beside the answer", () => {
  const action = (id, local) => {
    const now = new Date(`${local}+03:00`);
    return actionFor(evaluate(area(id), now, calendar), now.getTime());
  };

  test("a time limit is started by the driver, since it runs from when they leave the car", () => {
    expect(action(8006, "2026-10-13T14:40")).toEqual({ type: "start" });
  });

  test("a fixed deadline that gets worse is a reminder", () => {
    expect(action(8001, "2026-10-13T21:30")).toEqual(expect.objectContaining({ type: "remind" }));
  });

  test("nothing when nothing gets worse", () => {
    expect(action(8001, "2026-10-13T14:40")).toBeNull();
  });
});

describe("a started stay", () => {
  test("runs the time limit from the moment it starts, with the reminder ten minutes before the end", () => {
    const start = new Date("2026-10-13T14:40+03:00");
    expect(stayFor(area(8006), evaluate(area(8006), start, calendar))).toEqual({
      areaId: 8006, title: "Move your car", deadline: instant("2026-10-13T18:40"), at: instant("2026-10-13T18:30"),
    });
  });

  test("is not offered when the window ends before the limit would", () => {
    // 8006 at 19:00: the 4-hour limit outlasts the window ending at 20:00, so there is no limit to
    // start. The answer is a fixed deadline instead, with "Remind me".
    const late = new Date("2026-10-13T19:00+03:00");
    expect(stayFor(area(8006), evaluate(area(8006), late, calendar))).toBeNull();
  });
});

describe("the calendar file", () => {
  const reminder = { title: "Move your car", deadline: instant("2026-10-13T18:40"), at: instant("2026-10-13T18:30") };
  const ics = calendarFile(reminder, { detail: "Free parking, 4 hours max; until 18:40", url: "https://example.org/parkkiko/" });

  test("is an event at the deadline with an alarm ten minutes before", () => {
    expect(ics).toMatch(/\r\nDTSTART:20261013T154000Z\r\n/);
    expect(ics).toMatch(/\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT10M\r\n/);
  });

  test("escapes the text a calendar would otherwise misread", () => {
    expect(ics).toContain("DESCRIPTION:Free parking\\, 4 hours max\\; until 18:40");
  });

  test("uses CRLF line endings throughout, as calendars require", () => {
    expect(ics.split("\r\n").every((line) => !line.includes("\n"))).toBe(true);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
