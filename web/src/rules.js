// Evaluate a parking area's parsed rule at a given time.
// TODO: apply hours/duration/season windows and holidays; return a timeline, not a label.
export function evaluate(area) {
  if (area.status === "missing_hours") return { label: "Hours not published for this section." };
  if (area.status === "uncertain") return { label: "Check the sign before parking." };
  return { label: "Not implemented yet." };
}
