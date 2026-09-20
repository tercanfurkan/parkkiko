// Colours are colour-blind safe (Okabe-Ito) and every colour is paired with a label in the panel.
const COLOURS = {
  free_limited: "#009E73",   // green
  paid: "#0072B2",           // blue
  banned_hours: "#E69F00",   // orange
  always_banned: "#D55E00",  // vermillion
  reserved: "#CC79A7",       // purple
  unknown: "#999999",        // grey
};

export function styleFor(feature) {
  const { rule_type, status } = feature.properties;
  const uncertain = status !== "official";
  return {
    color: COLOURS[rule_type] ?? COLOURS.unknown,
    weight: 4,
    opacity: uncertain ? 0.45 : 1,      // faded means the rule is not fully known
    dashArray: uncertain ? "4 4" : null,
  };
}
