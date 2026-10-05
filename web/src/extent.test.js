import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { DATA_EXTENT } from "./extent.js";

const features = JSON.parse(readFileSync(new URL("../public/data/parking_areas.geojson", import.meta.url))).features;

test("every area lies inside the extent the app treats as Helsinki", () => {
  const [[south, west], [north, east]] = DATA_EXTENT;
  const outside = features.filter((f) =>
    f.geometry.coordinates.flat(2).some(([lng, lat]) => lat < south || lat > north || lng < west || lng > east),
  );
  expect(outside.map((f) => f.properties.id)).toEqual([]);
});
