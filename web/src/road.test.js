import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { nearestStrip, roadAxis, roadBearing } from "./road.js";

const features = JSON.parse(readFileSync(new URL("../public/data/parking_areas.geojson", import.meta.url))).features;
const area = (id) => features.find((f) => f.properties.id === id);

// Real strips, their orientation read off their corners:
// 8763 spans 0.00045° of latitude (50 m) and 0.00007° of longitude (4 m): north-south
// 8133 spans 0.0006° of longitude (34 m) and 0.00006° of latitude (7 m): east-west
// 9727 runs 0.00062° east and 0.00031° north. In degrees that is 63° from north, but a degree of
// longitude is half as long here, so in metres both legs are about 34 m: 45°
const ON_8763 = [60.175345, 24.952135];
const ON_8133 = [60.17316, 24.95003];
const ON_9727 = [60.19642, 24.95767];
const OPEN_SEA = [60.155, 24.97];   // south of Kaivopuisto, inside the data's extent

const fix = (latlng, heading, accuracy = 10) => ({ latlng, heading, accuracy });

describe("roadAxis", () => {
  test("a strip's longest edge gives the road's axis", () => {
    expect(roadAxis(area(8763))).toBeCloseTo(178, 0);   // north-south, slightly west of north
    expect(roadAxis(area(8133))).toBeCloseTo(88, 0);    // east-west
    expect(roadAxis(area(9727))).toBeCloseTo(45, 0);    // measured in metres, not degrees
  });
});

describe("nearestStrip", () => {
  test("finds the strip the driver is on", () => {
    expect(nearestStrip(features, ON_8763).properties.id).toBe(8763);
    expect(nearestStrip(features, ON_8133).properties.id).toBe(8133);
    expect(nearestStrip(features, ON_9727).properties.id).toBe(9727);
  });

  test("nothing within 25 m gives no strip", () => {
    expect(nearestStrip(features, OPEN_SEA)).toBeNull();
  });
});

describe("roadBearing", () => {
  test("follows the road in the direction the driver is going, both ways", () => {
    expect(roadBearing(features, fix(ON_8763, 10))).toBeCloseTo(358, 0);    // heading north
    expect(roadBearing(features, fix(ON_8763, 170))).toBeCloseTo(178, 0);   // heading south
    expect(roadBearing(features, fix(ON_8133, 80))).toBeCloseTo(88, 0);     // heading east
    expect(roadBearing(features, fix(ON_8133, 290))).toBeCloseTo(268, 0);   // heading west
    expect(roadBearing(features, fix(ON_9727, 20))).toBeCloseTo(45, 0);
    expect(roadBearing(features, fix(ON_9727, 200))).toBeCloseTo(225, 0);
  });

  test("north either side of 0/360 picks the northward direction", () => {
    expect(roadBearing(features, fix(ON_8763, 350))).toBeCloseTo(358, 0);
    expect(roadBearing(features, fix(ON_8763, 5))).toBeCloseTo(358, 0);
  });

  test("no road when there is no heading, no strip near, or a rough fix", () => {
    expect(roadBearing(features, fix(ON_8133, null))).toBeNull();
    expect(roadBearing(features, fix(OPEN_SEA, 90))).toBeNull();
    expect(roadBearing(features, fix(ON_8133, 90, 30))).toBeNull();
    expect(roadBearing(null, fix(ON_8133, 90))).toBeNull();   // the data has not loaded yet
  });
});
