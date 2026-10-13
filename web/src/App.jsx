import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Circle, CircleMarker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { styleFor, SELECTED_STYLE, ACCURACY_STYLE, POSITION_STYLE } from "./style.js";
import RulePanel from "./RulePanel.jsx";
import { DATA_EXTENT } from "./extent.js";

const HELSINKI = [60.1699, 24.9384];
const DATA_URL = `${import.meta.env.BASE_URL}data/parking_areas.geojson`;
const CALENDAR_URL = `${import.meta.env.BASE_URL}data/holidays.json`;

const CITY_ZOOM = 12;       // the whole register fits on a phone screen
const STREET_ZOOM = 17;     // individual street sections are tappable
const MIN_RULES_ZOOM = 15;   // below this the areas are a smear of colour, so they are hidden

// Padded by a tenth of the span (1.4 km N-S, 1.8 km E-W). A position outside it would land on a
// map with no rules, so we stay on the city view and say why instead.
const DATA_BOUNDS = L.latLngBounds(DATA_EXTENT).pad(0.1);

// One canvas instead of 8,754 SVG paths, which phones cannot keep up with. The tolerance widens
// the tap target: a parking strip is a few metres wide, a few pixels at street zoom.
const RENDERER = L.canvas({ tolerance: 8 });

const NOTICES = {
  finding: "Finding your location…",
  outside: "You seem to be outside Helsinki. We only have Helsinki's street parking rules.",
  denied: "Location is off. Zoom in on the map, or allow location in your browser settings.",
  failed: "Could not find your location. Zoom in on the map instead.",
};

function MapEvents({ onZoom, onEmptyClick }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()), click: onEmptyClick });
  return null;
}

export default function App() {
  const [map, setMap] = useState(null);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [areas, setAreas] = useState(null);
  const [selected, setSelected] = useState(null);
  const [position, setPosition] = useState(null);
  const [notice, setNotice] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const layersRef = useRef(null);
  const selectedLayer = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    fetch(DATA_URL).then((r) => r.json()).then(setAreas);
    fetch(CALENDAR_URL).then((r) => r.json()).then(setCalendar);
  }, []);

  // The answer is for this minute, so keep it current while it is on screen: 20:59 becomes 21:00
  useEffect(() => {
    if (!selected) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [selected]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setNotice(NOTICES.failed);
    setNotice(NOTICES.finding);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latlng = [coords.latitude, coords.longitude];
        if (!DATA_BOUNDS.contains(latlng)) {
          setPosition(null);
          return setNotice(NOTICES.outside);
        }
        setPosition({ latlng, accuracy: coords.accuracy });
        setNotice(null);
        map.flyTo(latlng, STREET_ZOOM);
      },
      // A denied permission is not asked again by the browser, so say where to change it
      (err) => setNotice(err.code === err.PERMISSION_DENIED ? NOTICES.denied : NOTICES.failed),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [map]);

  useEffect(() => {
    if (map) locate();
  }, [map, locate]);

  const deselect = () => {
    if (selectedLayer.current) layersRef.current?.resetStyle(selectedLayer.current);
    selectedLayer.current = null;
    setSelected(null);
  };

  // One listener on the layer group rather than one per area, so mounting it binds 1 handler, not 8,754
  const onAreaClick = (e) => {
    L.DomEvent.stopPropagation(e);   // a tap on an area is not a tap on empty map
    const layer = e.propagatedFrom;
    if (selectedLayer.current) layersRef.current.resetStyle(selectedLayer.current);
    layer.setStyle(SELECTED_STYLE);
    selectedLayer.current = layer;
    setSelected(layer.feature.properties);
  };

  // The panel grows over the bottom of the map, so pan the tapped area clear of it
  useEffect(() => {
    if (!selected || !selectedLayer.current) return;
    const covered = sheetRef.current.offsetHeight - sheetRef.current.parentElement.offsetHeight;
    // The strip's southern end, so all of it clears the panel, not just its middle
    const bounds = selectedLayer.current.getBounds();
    map.panInside([bounds.getSouth(), bounds.getCenter().lng], { paddingTopLeft: [0, 24], paddingBottomRight: [0, covered + 24] });
  }, [selected, map]);

  const onZoom = (zoom) => {
    const nowZoomedIn = zoom >= MIN_RULES_ZOOM;
    setZoomedIn(nowZoomedIn);
    if (!nowZoomedIn) deselect();   // the areas unmount, and the selected one with them
  };

  const showAreas = areas && zoomedIn;

  return (
    <div className="app">
      <div className="map-wrap">
        <MapContainer center={HELSINKI} zoom={CITY_ZOOM} className="map" renderer={RENDERER} ref={setMap}>
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />
          <MapEvents onZoom={onZoom} onEmptyClick={deselect} />
          {showAreas && <GeoJSON ref={layersRef} data={areas} eventHandlers={{ click: onAreaClick }} style={styleFor} />}
          {position && (
            <>
              <Circle center={position.latlng} radius={position.accuracy} pathOptions={ACCURACY_STYLE} interactive={false} />
              <CircleMarker center={position.latlng} radius={7} pathOptions={POSITION_STYLE} interactive={false} />
            </>
          )}
        </MapContainer>
        {notice && (
          <button className="notice" onClick={() => setNotice(null)}>
            {notice}
          </button>
        )}
      </div>
      {/* The slot keeps the collapsed panel's height in the layout; the sheet grows up from it over the map */}
      <div className="sheet-slot">
        <div className="sheet" ref={sheetRef}>
          <button className="locate" onClick={locate} aria-label="Show my location" title="Show my location">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M21 3 3 10.5l7.5 3 3 7.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
          <RulePanel area={selected} zoomedIn={zoomedIn} calendar={calendar} now={now} onClose={deselect} />
        </div>
      </div>
    </div>
  );
}
