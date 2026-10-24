import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { answer, clock } from "./answer.js";
import { evaluate } from "./evaluate.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const features = read("../public/data/parking_areas.geojson").features;
const calendar = read("../public/data/holidays.json");
const area = (id) => features.find((f) => f.properties.id === id).properties;
const say = (id, local, offset = "+03:00") => {
  const a = area(id);
  const now = new Date(`${local}${offset}`);
  return answer(a, evaluate(a, now, calendar), now.getTime());
};

test.each([
  [8001, "2026-10-13T14:40", "Paid parking until 21:00", "Free after that until 09:00 tomorrow"],
  [8001, "2026-10-13T21:30", "Free parking until 09:00 tomorrow", "Paid after that"],
  [8006, "2026-10-13T14:40", "Free parking, 4 hours max", "Display a parking disc. Park now and move by 18:40"],
  [8006, "2026-10-13T18:30", "Free parking until 08:00 tomorrow", "Display a parking disc. 4 hours max after that"],
  [8539, "2026-10-13T14:40", "Free parking, 24 hours max", "Park now and move by 14:40 tomorrow"],
  [8011, "2026-10-13T12:00", "No parking until 18:00", "Free after that until 07:00 tomorrow"],
  [8011, "2026-10-16T19:00", "Free parking until 09:00 tomorrow", "No parking after that"],
  [8269, "2026-10-13T14:40", "Paid parking, 1 hour max", "Park now and move by 15:40"],
  [8139, "2026-10-13T14:00", "Check the sign", "The register does not publish hours here"],
  [8016, "2026-10-13T14:00", "Not for you", "Reserved: Car-sharing pickup and return"],
])("area %i at %s", (id, local, headline, detail) => {
  expect(say(id, local)).toEqual(expect.objectContaining({ headline, detail }));
});

test.each([
  ["counts down to a deadline", 8001, "2026-10-13T14:40", { to: Date.parse("2026-10-13T21:00+03:00"), label: "left" }],
  ["counts down to when parking is allowed", 8011, "2026-10-13T12:00", { to: Date.parse("2026-10-13T18:00+03:00"), label: "Allowed in" }],
])("the countdown %s", (_, id, local, countdown) => {
  expect(say(id, local).countdown).toEqual(countdown);
});

test.each([
  ["past a day, where 'until Monday 09:00' says it better", 8001, "2026-10-16T21:00"],
  ["when nothing is counting down", 8139, "2026-10-13T14:00"],
  ["for a space that is not yours", 8016, "2026-10-13T14:00"],
  ["for a time limit, which starts when the driver leaves the car, not when they look", 8006, "2026-10-13T14:40"],
])("no countdown %s", (_, id, local) => {
  expect(say(id, local).countdown).toBeUndefined();
});

test.each([
  [11 * 3600000 + 28 * 60000 + 42999, "11:28:42"],
  [59999, "00:00:59"],
  [999, "00:00:00"],
  [-5000, "00:00:00"],
])("%i ms reads %s, rounded down, never promising time the driver does not have", (ms, text) => {
  expect(clock(ms)).toBe(text);
});

test("the look-ahead says where the calendar stops being sure", () => {
  expect(say(8001, "2026-12-22T21:00", "+02:00")).toEqual(
    expect.objectContaining({ headline: "Free parking until midnight", detail: "Check the sign after that" }),
  );
});

test("every area in the data gets a complete sentence, at any hour", () => {
  const broken = [];
  for (const hour of ["03:00", "08:30", "14:00", "20:59", "21:00", "23:30"]) {
    for (const { properties } of features) {
      const now = new Date(`2026-10-16T${hour}+03:00`);
      const { headline, detail } = answer(properties, evaluate(properties, now, calendar), now.getTime());
      if (!headline || /undefined|null|NaN/.test(`${headline} ${detail ?? ""}`)) broken.push([properties.id, hour, headline, detail]);
    }
  }
  expect(broken).toEqual([]);
});
