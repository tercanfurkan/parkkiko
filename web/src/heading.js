// Which way the driver is going, from the phone's location fixes. Pure, so it is tested
// without a phone; the app keeps the state between fixes.

const METRES_PER_DEGREE = 111320;
const WALKING_PACE = 2;   // m/s; below it the phone's own heading is mostly noise
const MIN_MOVE = 10;      // metres; less than this between fixes is not a direction

// [east, north] metres from a to b, both [lat, lng]. Flat-earth is fine over the tens of metres
// between fixes, but a degree of longitude is only cos(latitude) as long, about half at Helsinki.
export function offset(a, b) {
  const cos = Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  return [(b[1] - a[1]) * METRES_PER_DEGREE * cos, (b[0] - a[0]) * METRES_PER_DEGREE];
}

export function distance(a, b) {
  return Math.hypot(...offset(a, b));
}

// Degrees clockwise from north, in [0, 360)
export function bearing(a, b) {
  const [east, north] = offset(a, b);
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

export const NO_HEADING = { heading: null, from: null };

// The next state after a fix { latlng, accuracy, heading, speed }. `from` is the position the
// last heading was measured from. When the driver stops, the last heading stays: the moment
// they stop is when they look for a strip, and the car should not turn under them then.
export function nextHeading(state, fix) {
  if (Number.isFinite(fix.heading) && fix.speed > WALKING_PACE) {
    return { heading: fix.heading, from: fix.latlng };
  }
  if (!state.from) return { ...state, from: fix.latlng };
  // GPS jitter moves a standing phone by up to its accuracy, so only farther than that is movement
  if (distance(state.from, fix.latlng) <= Math.max(MIN_MOVE, fix.accuracy)) return state;
  return { heading: bearing(state.from, fix.latlng), from: fix.latlng };
}
