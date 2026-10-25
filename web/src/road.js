// Which way the road runs where the driver is, from the parking strips themselves: each is a thin
// rectangle along the kerb, so its longest edge lies along the road. Pure, like heading.js.
import { offset } from "./heading.js";

const NEAR = 25;       // metres; farther than this the strip may be on another street
const GOOD_FIX = 30;   // metres of accuracy; worse, and the nearest strip is a guess
const METRES_PER_DEGREE = 111320;

// Each strip's bounding box, worked out once per data set: a fix comes about once a second, and
// a box test rules out nearly all of the 8,754 strips before any edge is measured
const boxCache = new WeakMap();

function boxesFor(features) {
  let boxes = boxCache.get(features);
  if (boxes) return boxes;
  boxes = features.map((feature) => {
    const points = feature.geometry.coordinates.flat(2);
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    return { feature, south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lngs), east: Math.max(...lngs) };
  });
  boxCache.set(features, boxes);
  return boxes;
}

// The outer rings' edges as [from, to] in [lat, lng]; holes do not run along the kerb
function edges(feature) {
  return feature.geometry.coordinates.flatMap(([ring]) =>
    ring.slice(1).map((p, i) => [[ring[i][1], ring[i][0]], [p[1], p[0]]]),
  );
}

// Metres from the point to the nearest edge. A point inside a strip is at most half its width,
// a metre or two, from an edge, which is close enough to not need an inside test.
function distanceTo(feature, latlng) {
  let nearest = Infinity;
  for (const [from, to] of edges(feature)) {
    const [ax, ay] = offset(latlng, from);
    const [bx, by] = offset(latlng, to);
    const [dx, dy] = [bx - ax, by - ay];
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    nearest = Math.min(nearest, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return nearest;
}

// The nearest strip within NEAR metres, or null
export function nearestStrip(features, latlng) {
  const [lat, lng] = latlng;
  const dLat = NEAR / METRES_PER_DEGREE;
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);   // a degree of longitude is about half as long here
  let best = null;
  let bestDistance = NEAR;
  for (const box of boxesFor(features)) {
    if (lat < box.south - dLat || lat > box.north + dLat || lng < box.west - dLng || lng > box.east + dLng) continue;
    const d = distanceTo(box.feature, latlng);
    if (d <= bestDistance) [best, bestDistance] = [box.feature, d];
  }
  return best;
}

// The strip's long axis, in degrees clockwise from north, in [0, 180): one of the road's two directions
export function roadAxis(feature) {
  let longest = 0;
  let axis = null;
  for (const [from, to] of edges(feature)) {
    const [east, north] = offset(from, to);
    const length = Math.hypot(east, north);
    if (length <= longest) continue;
    longest = length;
    axis = (((Math.atan2(east, north) * 180) / Math.PI) % 180 + 180) % 180;
  }
  return axis;
}

// The road's direction the driver is going along, or null when there is no heading, no strip
// near, or a fix too rough to tell which strip is near; the car then shows the plain heading
export function roadBearing(features, { latlng, accuracy, heading }) {
  if (heading == null || !features || !(accuracy < GOOD_FIX)) return null;
  const strip = nearestStrip(features, latlng);
  if (!strip) return null;
  const axis = roadAxis(strip);
  // Of the axis's two directions, the one within 90° of the heading
  const apart = Math.abs((((heading - axis) % 360) + 540) % 360 - 180);
  return apart <= 90 ? axis : axis + 180;
}
