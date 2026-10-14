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
  [8001, "2026-10-13T14:40", "Paid parking until 21:00", "6 h 20 min left. Free after that until 09:00 tomorrow"],
  [8001, "2026-10-13T21:30", "Free parking until 09:00 tomorrow", "11 h 30 min left. Paid after that"],
  [8006, "2026-10-13T14:40", "Free parking, 4 hours max", "Until 18:40, then move your car"],
  [8006, "2026-10-13T18:30", "Free parking until 08:00 tomorrow", "13 h 30 min left. 4 hours max after that"],
  [8011, "2026-10-13T12:00", "No parking until 18:00", "Allowed in 6 h. Free after that until 07:00 tomorrow"],
  [8011, "2026-10-13T17:00", "No parking until 18:00", "Allowed in 1 h. Free after that until 07:00 tomorrow"],
  [8011, "2026-10-16T19:00", "Free parking until 09:00 tomorrow", "14 h left. No parking after that"],
  [8269, "2026-10-13T14:40", "Paid parking, 1 hour max", "Until 15:40, then move your car"],
  [8139, "2026-10-13T14:00", "Check the sign", "The register does not publish hours here"],
  [8016, "2026-10-13T14:00", "Not for you", "Reserved: Car-sharing pickup and return"],
])("area %i at %s", (id, local, headline, detail) => {
  expect(say(id, local)).toEqual({ headline, detail });
});

test("past a day the countdown is left out and the weekday named", () => {
  // Friday 21:00 to Monday 09:00 is 60 hours: "until Monday 09:00" says it better
  expect(say(8001, "2026-10-16T21:00")).toEqual({ headline: "Free parking until Monday 09:00", detail: "Paid after that" });
});

test("the countdown rounds down, never promising time the driver does not have", () => {
  // At 14:40:59 there are 6 h 19 min 1 s left before 21:00: say 6 h 19 min, not 6 h 20 min
  const a = area(8001);
  expect(answer(a, evaluate(a, new Date("2026-10-13T14:40:59+03:00"), calendar)).detail).toMatch(/^6 h 19 min left/);
});

test("the look-ahead says where the calendar stops being sure", () => {
  expect(say(8001, "2026-12-22T21:00", "+02:00")).toEqual({ headline: "Free parking until midnight", detail: "3 h left. Check the sign after that" });
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
