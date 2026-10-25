import { useMemo } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";
import { CAR_STYLE } from "./style.js";

const WIDTH = 18;
const HEIGHT = 32;   // about a car's length at zoom 19

// A car seen from above, nose up. Inline, so there is no image file to load or cache.
const CAR_SVG = `<svg viewBox="0 0 18 32" width="${WIDTH}" height="${HEIGHT}" style="display: block" aria-hidden="true">
  <rect x="1.5" y="1.5" width="15" height="29" rx="6" fill="${CAR_STYLE.fill}" stroke="${CAR_STYLE.outline}" stroke-width="2"/>
  <path d="M4.5 10.5 Q9 7.5 13.5 10.5 L12.5 14 H5.5 Z" fill="${CAR_STYLE.outline}"/>
  <path d="M5.5 24 H12.5 L13 26.5 Q9 28 5 26.5 Z" fill="${CAR_STYLE.outline}" opacity="0.8"/>
</svg>`;

// Points along bearing, in degrees clockwise from north; up until one is known. Rotating the
// inner element, because Leaflet positions the icon itself with a transform of its own.
function carIcon(bearing) {
  return L.divIcon({
    className: "car",
    html: `<div style="transform: rotate(${bearing}deg)">${CAR_SVG}</div>`,
    iconSize: [WIDTH, HEIGHT],
    iconAnchor: [WIDTH / 2, HEIGHT / 2],
  });
}

// Not interactive, so a tap on the car reaches the parking strip under it
export default function CarMarker({ latlng, bearing }) {
  const rounded = Math.round(bearing ?? 0) % 360;
  const icon = useMemo(() => carIcon(rounded), [rounded]);
  return <Marker position={latlng} icon={icon} interactive={false} keyboard={false} />;
}
