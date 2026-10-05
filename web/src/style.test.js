import { describe, expect, test } from "vitest";
import { RULE_TYPES, SELECTED_STYLE, spaceLabel, styleFor } from "./style.js";
import { areas } from "./test-data.js";

const features = areas();

// What the map draws: Leaflet merges the selected style over the area's own.
const look = (properties, selected) => {
  const style = styleFor({ properties });
  return selected ? { ...style, ...SELECTED_STYLE } : style;
};

describe("an area whose rule is not fully known never looks like the city's rule", () => {
  // "predicted" is not in the data yet. It stands for the hours the learning task will estimate,
  // which must never look official either.
  const statuses = [...new Set(features.map((f) => f.properties.status)), "predicted"]
    .filter((s) => s !== "official");

  for (const status of statuses) {
    for (const selected of [false, true]) {
      test(`${status}${selected ? ", selected" : ""}`, () => {
        const official = look({ rule_type: "paid", status: "official" }, selected);
        const shown = look({ rule_type: "paid", status }, selected);
        expect(shown.dashArray).toBeTruthy();
        expect(shown.opacity).toBeLessThan(official.opacity);
      });
    }
  }
});

test("every rule type in the data has its own colour and label", () => {
  const missing = new Set(features.map((f) => f.properties.rule_type).filter((t) => !RULE_TYPES[t]));
  expect([...missing]).toEqual([]);
});

describe("every reserved space says who it is reserved for", () => {
  const reserved = features.filter((f) => f.properties.rule_type === "reserved");

  test("when the register gives a space type, the app has a label for it", () => {
    // The labels copy the backend's list in pipeline/rules.py. A space type the city adds there
    // would show as a bare "Reserved space", and a driver could not tell a taxi bay from a loading zone.
    const unlabelled = new Set(
      reserved.filter((f) => f.properties.tyyppi && !spaceLabel(f.properties.tyyppi)).map((f) => f.properties.tyyppi),
    );
    expect([...unlabelled]).toEqual([]);
  });

  // Known gap, in Open questions in docs/TODO.md: the car-sharing bays (class 11) are reserved by
  // their class, which the app's file does not carry, so they show as a bare "Reserved space".
  // This passes while the gap exists. When the backend exports the class, it fails: drop .fails
  // and give RulePanel the class label.
  test.fails("when it gives none, the app still knows who the space is for", () => {
    expect(reserved.filter((f) => !f.properties.tyyppi)).toEqual([]);
  });
});
