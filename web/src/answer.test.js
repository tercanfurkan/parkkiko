import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { answer } from "./answer.js";
import { evaluate } from "./evaluate.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const features = read("../public/data/parking_areas.geojson").features;
const calendar = read("../public/data/holidays.json");
const area = (id) => features.find((f) => f.properties.id === id).properties;
const say = (id, local, offset = "+03:00") => {
  const a = area(id);
  return answer(a, evaluate(a, new Date(`${local}${offset}`), calendar));
};

test.each([
  [8001, "2026-10-13T14:00", "Paid until 21:00.", "Then free until 09:00 tomorrow."],
  [8001, "2026-10-13T21:00", "Park here until 09:00 tomorrow.", "Free until then, then paid."],
  [8006, "2026-10-13T14:00", "Park here for 4 hours.", "Move by 18:00."],
  [8006, "2026-10-13T18:30", "Park here until 08:00 tomorrow.", "Then a limit of 4 hours."],
  [8011, "2026-10-13T12:00", "No parking until 18:00.", "Then park here until 07:00 tomorrow."],
  [8011, "2026-10-16T19:00", "Park here until 09:00 tomorrow.", "Then no parking."],
  [8269, "2026-10-13T14:00", "Park here for 1 hour, paid.", "Move by 15:00."],
  [8139, "2026-10-13T14:00", "Check the sign.", "The register does not publish hours here."],
  [8016, "2026-10-13T14:00", "Not for you.", "Reserved: Car-sharing pickup and return."],
])("area %i at %s", (id, local, headline, detail) => {
  expect(say(id, local)).toEqual({ headline, detail });
});

test("a time two or more days ahead names the weekday", () => {
  // Friday 21:00 to Monday 09:00
  expect(say(8001, "2026-10-16T21:00").headline).toBe("Park here until 09:00 Monday.");
});

test("the look-ahead says where the calendar stops being sure", () => {
  expect(say(8001, "2026-12-22T21:00", "+02:00")).toEqual({ headline: "Park here until midnight.", detail: "Then check the sign." });
});

test("every area in the data gets a complete sentence, at any hour", () => {
  const broken = [];
  for (const hour of ["03:00", "08:30", "14:00", "20:59", "21:00", "23:30"]) {
    for (const { properties } of features) {
      const { headline, detail } = answer(properties, evaluate(properties, new Date(`2026-10-16T${hour}+03:00`), calendar));
      if (!headline || /undefined|null|NaN/.test(`${headline} ${detail ?? ""}`)) broken.push([properties.id, hour, headline, detail]);
    }
  }
  expect(broken).toEqual([]);
});
