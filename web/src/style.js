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

// What a space is reserved for, keyed by the register's own Finnish value. Wording lives here
// rather than in the pipeline, so changing it is a one-line edit instead of a data rebuild.
export const SPACE_TYPES = {
  "pysäyttämiskielto": "No stopping",
  "sähköpotkulauta": "Electric scooter",
  "sähköauto": "Electric car",
  "taxi": "Taxi",
  "taksi": "Taxi",
  "taxi, lataus": "Taxi, charging",
  "kuormauspaikka": "Loading zone",
  "inva": "Accessible parking",
  "matkailuliikenne": "Tourist coach",
  "cd": "Diplomatic vehicle",
  "moottoripyörä": "Motorcycle",
  "polkupyörä": "Bicycle",
  "virka-auto": "Official vehicle",
  "poliisi": "Police",
  "kirjastoauto": "Mobile library",
  "kuorma-auto": "Lorry",
  "parklet": "Parklet",
  "kaupunginkanslia": "City Executive Office",
  "valtioneuvosto": "Finnish Government",
  "henkilöauto, pakettiauto": "Car or van",
};

export function spaceLabel(tyyppi) {
  return SPACE_TYPES[(tyyppi ?? "").trim().toLowerCase()] ?? null;
}

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

// Drawn over the tapped area's own style, so its colour still says what the rule is. Only the
// weight changes: an uncertain area must stay faded and dashed when selected, or it looks official.
export const SELECTED_STYLE = { weight: 9 };

// The driver's position. Shares the paid-parking blue; index.css repeats it for the locate button.
const LOCATION_COLOUR = "#0072B2";
export const ACCURACY_STYLE = { color: LOCATION_COLOUR, weight: 1, fillOpacity: 0.12 };
export const POSITION_STYLE = { color: "#fff", weight: 2, fillColor: LOCATION_COLOUR, fillOpacity: 1 };
