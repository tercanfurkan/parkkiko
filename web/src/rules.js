// Evaluate a parking area's rule at a given time.
// TODO: parse hours ("9-21, (9-18)"), duration, season, holidays; handle rule types.
export function evaluate(area, time) {
  if (!area.voimassaolo) return { label: "Unknown", source: "no hours in register" };
  return { label: "Not implemented", source: "official rule" };
}
