import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { styleFor, SELECTED_STYLE, ACCURACY_STYLE } from "./style.js";
import CarMarker from "./CarMarker.jsx";
import RulePanel from "./RulePanel.jsx";
import About from "./About.jsx";
import { addReminder, loadStay, restoreNotification, saveStay } from "./notify.js";
import { evaluate } from "./evaluate.js";
import { stayFor } from "./reminder.js";
import { clockTime } from "./answer.js";
import { DATA_EXTENT } from "./extent.js";
import { nextHeading, NO_HEADING } from "./heading.js";

const HELSINKI = [60.1699, 24.9384];
const DATA_URL = `${import.meta.env.BASE_URL}data/parking_areas.geojson`;
const CALENDAR_URL = `${import.meta.env.BASE_URL}data/holidays.json`;

const CITY_ZOOM = 12;       // the whole register fits on a phone screen
const STREET_ZOOM = 17;     // individual street sections are tappable
const LOCATED_ZOOM = 19;    // about 56 m across a phone: the strips around the driver, a few metres wide each
const MAX_ZOOM = 20;        // past OpenStreetMap's last tile level, to tap between two close strips
const TILE_ZOOM = 19;       // OpenStreetMap's last tile level; above it the tiles are scaled up
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

function MapEvents({ onZoom, onEmptyClick, onDrag }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()), click: onEmptyClick, dragstart: onDrag });
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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [stay, setStay] = useState(loadStay);
  const [now, setNow] = useState(() => new Date());
  const layersRef = useRef(null);
  const selectedLayer = useRef(null);
  const sheetRef = useRef(null);
  const watchId = useRef(null);
  const wantLocation = useRef(false);   // false after a denial, so showing the tab again does not retry
  const positionRef = useRef(null);
  const headingRef = useRef(NO_HEADING);
  const following = useRef(true);       // the map pans with the car until the driver looks elsewhere
  const flyOnFix = useRef(true);        // the first fix flies to the driver; later ones only pan
  const flying = useRef(false);
  const shownNotice = useRef(null);

  useEffect(() => {
    fetch(DATA_URL).then((r) => r.json()).then(setAreas);
    fetch(CALENDAR_URL).then((r) => r.json()).then(setCalendar);
    restoreNotification();   // a reminder set before a reload
  }, []);

  // The answer is for this minute, so keep it current while it is on screen: 20:59 becomes 21:00
  useEffect(() => {
    if (!selected) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [selected]);

  // A fix arrives about once a second, so show a notice only when it changes: one the driver
  // dismissed must not come back with the next fix
  const showNotice = useCallback((key) => {
    if (shownNotice.current === key) return;
    shownNotice.current = key;
    setNotice(key ? NOTICES[key] : null);
  }, []);

  const flyToDriver = useCallback((latlng) => {
    flying.current = true;   // a pan on the next fix would cut the flight short
    map.once("moveend", () => { flying.current = false; });
    map.flyTo(latlng, LOCATED_ZOOM);
  }, [map]);

  const stopWatch = useCallback(() => {
    if (watchId.current === null) return;
    navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  // The phone pushes fixes as the driver moves, so there is no timer polling for them
  const startWatch = useCallback(() => {
    if (watchId.current !== null || document.hidden) return;
    headingRef.current = { ...headingRef.current, from: null };   // where the driver was before a pause is not a direction
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const latlng = [coords.latitude, coords.longitude];
        if (!DATA_BOUNDS.contains(latlng)) {
          setPosition((positionRef.current = null));
          return showNotice("outside");
        }
        const { accuracy, heading, speed } = coords;
        headingRef.current = nextHeading(headingRef.current, { latlng, accuracy, heading, speed });
        setPosition((positionRef.current = { latlng, accuracy, heading: headingRef.current.heading }));
        showNotice(null);
        if (flyOnFix.current) {
          flyOnFix.current = false;
          flyToDriver(latlng);
        } else if (following.current && !flying.current) {
          map.panTo(latlng);   // pan, not zoom: the driver may have pinched to the zoom they want
        }
      },
      (err) => {
        // A phone standing still may send no new fix before the timeout; the last one still holds
        if (err.code === err.TIMEOUT && positionRef.current) return;
        // A denied permission is not asked again by the browser, so say where to change it
        if (err.code !== err.PERMISSION_DENIED) return showNotice("failed");
        stopWatch();
        wantLocation.current = false;
        showNotice("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [map, flyToDriver, stopWatch, showNotice]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setNotice(NOTICES.failed);
    wantLocation.current = true;
    following.current = true;
    shownNotice.current = undefined;   // a notice dismissed earlier may be shown again
    if (positionRef.current) {
      flyToDriver(positionRef.current.latlng);
    } else {
      flyOnFix.current = true;
      showNotice("finding");
    }
    startWatch();
  }, [flyToDriver, startWatch, showNotice]);

  // Stop the GPS while the tab is hidden, for the battery, and start it again when it is back
  useEffect(() => {
    if (!map) return;
    locate();
    const onVisibility = () => (document.hidden ? stopWatch() : wantLocation.current && startWatch());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopWatch();
    };
  }, [map, locate, startWatch, stopWatch]);

  // Looking at another part of the map: stop pulling it back to the car
  const stopFollowing = () => { following.current = false; };

  const deselect = () => {
    if (selectedLayer.current) layersRef.current?.resetStyle(selectedLayer.current);
    selectedLayer.current = null;
    setSelected(null);
  };

  // One listener on the layer group rather than one per area, so mounting it binds 1 handler, not 8,754
  const onAreaClick = (e) => {
    L.DomEvent.stopPropagation(e);   // a tap on an area is not a tap on empty map
    stopFollowing();
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

  // Highlight the selected area once its layer exists: after opening a stay from the bar the map
  // is still flying there, and the areas mount only when it arrives at street zoom
  useEffect(() => {
    if (!selected || selectedLayer.current || !layersRef.current) return;
    layersRef.current.eachLayer((layer) => {
      if (layer.feature.properties.id !== selected.id) return;
      layer.setStyle(SELECTED_STYLE);
      selectedLayer.current = layer;
    });
  }, [selected, showAreas]);

  // The limit runs from this tap, so evaluate again now rather than reuse the panel's minute
  const startParking = (area) => {
    const started = stayFor(area, evaluate(area, new Date(), calendar));
    if (!started) return;
    saveStay(started);
    setStay(started);
    const deadlineText = clockTime(started.deadline);
    addReminder(started, { detail: `Parked. Move by ${deadlineText}`, deadlineText });
  };

  const openStay = () => {
    const feature = areas?.features.find((f) => f.properties.id === stay.areaId);
    if (!feature) return;
    deselect();
    stopFollowing();   // the parked car may be far from the driver
    map.flyTo(L.geoJSON(feature).getBounds().getCenter(), STREET_ZOOM);
    setSelected(feature.properties);
  };

  return (
    <div className="app">
      <div className="map-wrap">
        <MapContainer center={HELSINKI} zoom={CITY_ZOOM} className="map" renderer={RENDERER} maxZoom={MAX_ZOOM} ref={setMap}>
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
            maxZoom={MAX_ZOOM}
            maxNativeZoom={TILE_ZOOM}
          />
          <MapEvents onZoom={onZoom} onEmptyClick={deselect} onDrag={stopFollowing} />
          {showAreas && <GeoJSON ref={layersRef} data={areas} eventHandlers={{ click: onAreaClick }} style={styleFor} />}
          {position && (
            <>
              <Circle center={position.latlng} radius={position.accuracy} pathOptions={ACCURACY_STYLE} interactive={false} />
              <CarMarker latlng={position.latlng} bearing={position.heading} />
            </>
          )}
        </MapContainer>
        {notice && (
          <button className="notice" onClick={() => setNotice(null)}>
            {notice}
          </button>
        )}
        <button className="about-button" onClick={() => setAboutOpen(true)} aria-label="About Parkkiko" title="About Parkkiko">i</button>
      </div>
      {/* The slot keeps the collapsed panel's height in the layout; the sheet grows up from it over the map */}
      <div className="sheet-slot">
        <div className="sheet" ref={sheetRef}>
          <button className="locate" onClick={locate} aria-label="Show my location" title="Show my location">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M21 3 3 10.5l7.5 3 3 7.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
          <RulePanel
            area={selected} zoomedIn={zoomedIn} calendar={calendar} now={now} onClose={deselect}
            stay={stay} onStart={startParking} onOpenStay={openStay}
          />
        </div>
      </div>
      {aboutOpen && <About onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
