import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { RULE_TYPES, SELECTED_STYLE, reservedFor, spaceLabel, styleFor } from "./style.js";

const features = JSON.parse(readFileSync(new URL("../public/data/parking_areas.geojson", import.meta.url))).features;
const reserved = features.filter((f) => f.properties.rule_type === "reserved");

// What the map draws: Leaflet merges the selected style over the area's own.
const look = (status, selected) => ({ ...styleFor({ properties: { rule_type: "paid", status } }), ...(selected && SELECTED_STYLE) });

// Estimates keep the status missing_hours, so they are dashed with it: never the city's rule
const notOfficial = [...new Set(features.map((f) => f.properties.status))].filter((s) => s !== "official");

test.each(notOfficial.flatMap((s) => [[s, false], [s, true]]))(
  "a %s area never looks like the city's rule (selected: %s)",
  (status, selected) => {
    const shown = look(status, selected);
    expect(shown.dashArray).toBeTruthy();
    expect(shown.opacity).toBeLessThan(look("official", selected).opacity);
  },
);

test("every rule type in the data has its own colour and label", () => {
  expect(features.map((f) => f.properties.rule_type).filter((t) => !RULE_TYPES[t])).toEqual([]);
});

test("every space type the register gives a reserved area has a label", () => {
  // The labels copy the backend's list in pipeline/rules.py. A space type the city adds there
  // would show as a bare "Reserved space", and a driver could not tell a taxi bay from a loading zone.
  const unlabelled = reserved.filter((f) => f.properties.tyyppi && !spaceLabel(f.properties.tyyppi));
  expect([...new Set(unlabelled.map((f) => f.properties.tyyppi))]).toEqual([]);
});

test("every reserved area says who it is for", () => {
  expect(reserved.filter((f) => !reservedFor(f.properties)).map((f) => f.properties.id)).toEqual([]);
});
