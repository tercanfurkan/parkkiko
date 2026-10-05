import { expect, test } from "vitest";
import { DATA_EXTENT } from "./extent.js";
import { areas } from "./test-data.js";

test("every area lies inside the extent the app treats as Helsinki", () => {
  // Fails when a rebuilt data file reaches beyond DATA_EXTENT. Left alone, a driver standing in a
  // newly covered street would be told they are outside Helsinki. Also fails if the corners are
  // written [lng, lat]: GeoJSON stores longitude first and Leaflet expects latitude first.
  const [[south, west], [north, east]] = DATA_EXTENT;
  const outside = [];
  for (const { properties, geometry } of areas()) {
    for (const [lng, lat] of geometry.coordinates.flat(2)) {
      if (lat < south || lat > north || lng < west || lng > east) outside.push(properties.id);
    }
  }
  expect([...new Set(outside)]).toEqual([]);
});
