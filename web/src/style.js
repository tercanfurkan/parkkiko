// One vocabulary for the rule types: colour for the map, label for the panel.
// Colours are Okabe-Ito (colour-blind safe) and every colour is paired with its label in the UI.
export const RULE_TYPES = {
  free_limited:  { label: "Free, time limited", colour: "#009E73" },
  paid:          { label: "Paid parking",       colour: "#0072B2" },
  banned_hours:  { label: "Banned at times",    colour: "#E69F00" },
  always_banned: { label: "No parking",         colour: "#D55E00" },
  reserved:      { label: "Reserved space",     colour: "#CC79A7" },
  unknown:       { label: "Unknown",            colour: "#999999" },
};

export function styleFor(feature) {
  const { rule_type, status } = feature.properties;
  const uncertain = status !== "official";
  return {
    color: (RULE_TYPES[rule_type] ?? RULE_TYPES.unknown).colour,
    weight: 4,
    opacity: uncertain ? 0.45 : 1,      // faded and dashed means the rule is not fully known
    dashArray: uncertain ? "4 4" : null,
  };
}
