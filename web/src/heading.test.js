import { describe, expect, test } from "vitest";
import { bearing, distance, nextHeading, NO_HEADING } from "./heading.js";

const SENATE_SQUARE = [60.1695, 24.9525];
// 50 m in each direction: a degree of latitude is 111.32 km, of longitude half that at 60° N
const north = [SENATE_SQUARE[0] + 50 / 111320, SENATE_SQUARE[1]];
const south = [SENATE_SQUARE[0] - 50 / 111320, SENATE_SQUARE[1]];
const cos = Math.cos((SENATE_SQUARE[0] * Math.PI) / 180);
const east = [SENATE_SQUARE[0], SENATE_SQUARE[1] + 50 / (111320 * cos)];
const west = [SENATE_SQUARE[0], SENATE_SQUARE[1] - 50 / (111320 * cos)];

const fix = (latlng, more = {}) => ({ latlng, accuracy: 5, heading: null, speed: null, ...more });

describe("bearing", () => {
  test("north, east, south and west", () => {
    expect(bearing(SENATE_SQUARE, north)).toBeCloseTo(0, 3);
    expect(bearing(SENATE_SQUARE, east)).toBeCloseTo(90, 3);
    expect(bearing(SENATE_SQUARE, south)).toBeCloseTo(180, 3);
    expect(bearing(SENATE_SQUARE, west)).toBeCloseTo(270, 3);
  });

  test("a degree of longitude counts for half as many metres at Helsinki", () => {
    expect(distance(SENATE_SQUARE, east)).toBeCloseTo(50, 1);
    // Equal steps in degrees north and east, but east is half as far: about 27°, not 45°
    const diagonal = [SENATE_SQUARE[0] + 0.001, SENATE_SQUARE[1] + 0.001];
    expect(bearing(SENATE_SQUARE, diagonal)).toBeCloseTo(26.5, 0);
  });

  test("stays in [0, 360) either side of north", () => {
    const slightlyWest = [north[0], SENATE_SQUARE[1] - 0.00001];
    const slightlyEast = [north[0], SENATE_SQUARE[1] + 0.00001];
    expect(bearing(SENATE_SQUARE, slightlyWest)).toBeGreaterThan(359);
    expect(bearing(SENATE_SQUARE, slightlyWest)).toBeLessThan(360);
    expect(bearing(SENATE_SQUARE, slightlyEast)).toBeGreaterThan(0);
    expect(bearing(SENATE_SQUARE, slightlyEast)).toBeLessThan(1);
  });
});

describe("nextHeading", () => {
  test("the first fix has no direction", () => {
    expect(nextHeading(NO_HEADING, fix(SENATE_SQUARE)).heading).toBeNull();
  });

  test("moving farther than 10 m and the accuracy gives the direction of travel", () => {
    const first = nextHeading(NO_HEADING, fix(SENATE_SQUARE));
    expect(nextHeading(first, fix(east)).heading).toBeCloseTo(90, 3);
    expect(nextHeading(first, fix(west)).heading).toBeCloseTo(270, 3);
  });

  test("jitter within the accuracy is not movement", () => {
    const first = nextHeading(NO_HEADING, fix(SENATE_SQUARE));
    const eightMetres = [SENATE_SQUARE[0] + 8 / 111320, SENATE_SQUARE[1]];
    expect(nextHeading(first, fix(eightMetres)).heading).toBeNull();   // under 10 m
    // 50 m, but the fix itself is only good to 60 m
    expect(nextHeading(first, fix(north, { accuracy: 60 })).heading).toBeNull();
  });

  test("small steps add up, because they are measured from where the last heading was", () => {
    let state = nextHeading(NO_HEADING, fix(SENATE_SQUARE));
    for (const metres of [4, 8, 12]) {
      state = nextHeading(state, fix([SENATE_SQUARE[0] + metres / 111320, SENATE_SQUARE[1]]));
    }
    expect(state.heading).toBeCloseTo(0, 3);
  });

  test("stopping keeps the last heading", () => {
    const moving = nextHeading(nextHeading(NO_HEADING, fix(SENATE_SQUARE)), fix(east));
    const stopped = nextHeading(moving, fix([east[0] + 2 / 111320, east[1]]));
    expect(stopped.heading).toBeCloseTo(90, 3);
  });

  test("the phone's own heading is used only above walking pace", () => {
    const first = nextHeading(NO_HEADING, fix(SENATE_SQUARE));
    expect(nextHeading(first, fix(SENATE_SQUARE, { heading: 200, speed: 10 })).heading).toBe(200);
    expect(nextHeading(first, fix(SENATE_SQUARE, { heading: 200, speed: 1 })).heading).toBeNull();
    // Slow, so the positions decide, not the phone's 200°
    expect(nextHeading(first, fix(east, { heading: 200, speed: 1 })).heading).toBeCloseTo(90, 3);
    // Some phones give speed but NaN or null heading
    expect(nextHeading(first, fix(SENATE_SQUARE, { heading: NaN, speed: 10 })).heading).toBeNull();
  });
});
