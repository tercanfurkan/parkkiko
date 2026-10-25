// The panel as a driver reads it, rendered from the committed data at moments the test sets.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test } from "vitest";
import RulePanel from "./RulePanel.jsx";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const areas = read("../public/data/parking_areas.geojson").features.map((f) => f.properties);
const calendar = read("../public/data/holidays.json");
const area = (id) => areas.find((a) => a.id === id);
// Helsinki is UTC+3 until 25 October 2026
const at = (local) => new Date(`${local}+03:00`);
const noop = () => {};

/** The panel's text, as a driver would read it. */
function panel(props, now, stay = null) {
  const html = renderToStaticMarkup(
    <RulePanel area={props} zoomedIn calendar={calendar} now={now} stay={stay}
      onClose={noop} onStart={noop} onOpenStay={noop} />,
  );
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("what the panel says, area by area", () => {
  test.each([
    // Estimates: shown as ours, with their source, and the sign wins
    [8193, "2026-10-13T14:40", "paid, estimated from 25 m",
      ["Estimate", "Paid parking until 21:00", "Estimated from the same kind of parking 25 m away", "trust the sign"], []],
    [8139, "2026-10-13T14:40", "class 7, withheld from estimates",
      ["Check the sign", "The register does not publish hours here"], ["Estimate"]],
    // The parking disc: rounded up, the limit counted from it, and no carry-over
    [8006, "2026-10-13T14:05", "free 8-20, 4 h, under the limit",
      ["Free parking, 4 hours max", "Set your parking disc to 14:30", "Park now and move by 18:30"], []],
    [8006, "2026-10-13T18:30", "the limit outlasts the hours",
      ["Free parking until 08:00 tomorrow", "Set your parking disc to 18:30", "Move your car then"], []],
    [8006, "2026-10-13T21:00", "parked while the limit is off",
      ["Free parking until 12:00 tomorrow", "Set your parking disc to 08:00 tomorrow", "Move your car then"], []],
    [9646, "2026-10-13T18:05", "free with 60 min after a no-parking spell",
      ["Free parking, 1 hour max", "Set your parking disc to 18:30"], []],
    // No disc where none is needed
    [8269, "2026-10-13T14:40", "paid, 1 h", ["Paid parking, 1 hour max"], ["disc"]],
    [8539, "2026-10-13T14:40", "free, 24 h", ["Free parking, 24 hours max"], ["disc"]],
    [8001, "2026-10-13T21:30", "paid area after its hours", ["Free parking until 09:00 tomorrow", "Paid after that"], ["disc"]],
  ])("area %i at %s, %s", (id, local, _, says, never) => {
    const text = panel(area(id), at(local));
    for (const phrase of says) expect(text).toContain(phrase);
    for (const phrase of never) expect(text).not.toContain(phrase);
  });

  test("after Start parking, the disc the stay began with stays on screen", () => {
    const stay = { areaId: 8006, title: "Move your car", deadline: at("2026-10-13T19:00").getTime(),
      at: at("2026-10-13T18:50").getTime(), disc: at("2026-10-13T15:00").getTime() };
    const text = panel(area(8006), at("2026-10-13T14:45"), stay);
    expect(text).toContain("Parked. Move by 19:00");
    expect(text).toContain("Parking disc set to 15:00");
  });
});

// Every area in the data, at moments that matter: what must always hold, whatever a street says
describe("every area in the data", () => {
  const moments = { "Tuesday noon": at("2026-10-13T12:00"), "Saturday noon": at("2026-10-17T12:00"),
    "Sunday 03:00": at("2026-10-18T03:00") };
  let texts, tuesday;
  beforeAll(() => {
    texts = Object.fromEntries(Object.entries(moments).map(([name, now]) =>
      [name, new Map(areas.map((a) => [a.id, panel(a, now)]))]));
    tuesday = texts["Tuesday noon"];
  });

  test("no panel says undefined, null or NaN", () => {
    for (const [name, byId] of Object.entries(texts)) {
      const broken = [...byId].filter(([, text]) => /undefined|null|NaN/.test(text)).map(([id]) => id);
      expect(broken, name).toEqual([]);
    }
  });

  test("an estimate is always labelled and points to the sign, and nothing else is", () => {
    const wrong = areas.filter((a) => tuesday.get(a.id).includes("Estimate") !== Boolean(a.predicted_hours));
    expect(wrong.map((a) => a.id)).toEqual([]);
    const unsourced = areas.filter((a) => a.predicted_hours && !tuesday.get(a.id).includes("trust the sign"));
    expect(unsourced.map((a) => a.id)).toEqual([]);
  });

  test("paid parking never asks for a disc", () => {
    for (const [name, byId] of Object.entries(texts)) {
      const asked = areas.filter((a) => a.rule_type === "paid" && byId.get(a.id).includes("parking disc"));
      expect(asked.map((a) => a.id), name).toEqual([]);
    }
  });

  test("free parking under a limit in force at noon asks for a disc set to 12:00", () => {
    const limited = areas.filter((a) => a.rule_type === "free_limited" && a.status === "official"
      && a.duration_min > 0 && a.duration_min < 1440 && a.hours?.mon_fri
      && a.hours.mon_fri[0] <= 12 && 12 < a.hours.mon_fri[1] && !a.season);
    expect(limited.length).toBeGreaterThan(1000);
    expect(limited.filter((a) => !tuesday.get(a.id).includes("Set your parking disc to 12:00")).map((a) => a.id)).toEqual([]);
  });

  test("parked on Sunday night while a weekday limit is off, the disc goes to Monday's start", () => {
    const weekdayOnly = areas.filter((a) => a.rule_type === "free_limited" && a.status === "official"
      && a.duration_min > 0 && a.duration_min < 1440 && a.hours && Object.keys(a.hours).join() === "mon_fri"
      && a.hours.mon_fri[0] > 3 && !a.season);
    expect(weekdayOnly.length).toBeGreaterThan(1000);
    const sunday = texts["Sunday 03:00"];
    const pad = (h) => String(h).padStart(2, "0");
    const wrong = weekdayOnly.filter((a) => !sunday.get(a.id).includes(`Set your parking disc to ${pad(a.hours.mon_fri[0])}:00 tomorrow`)
      || !sunday.get(a.id).includes("Move your car then"));
    expect(wrong.map((a) => a.id)).toEqual([]);
  });
});
