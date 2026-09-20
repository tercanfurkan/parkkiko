import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { styleFor } from "./style.js";
import RulePanel from "./RulePanel.jsx";

const HELSINKI = [60.1699, 24.9384];
const DATA_URL = `${import.meta.env.BASE_URL}data/parking_areas.geojson`;

export default function App() {
  const [areas, setAreas] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(DATA_URL).then((r) => r.json()).then(setAreas);
  }, []);

  const onEachFeature = (feature, layer) =>
    layer.on("click", () => setSelected(feature.properties));

  return (
    <div className="app">
      {/* preferCanvas: one canvas instead of 8,754 SVG paths, which phones cannot keep up with */}
      <MapContainer center={HELSINKI} zoom={16} className="map" preferCanvas>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        {areas && <GeoJSON data={areas} onEachFeature={onEachFeature} style={styleFor} />}
      </MapContainer>
      <RulePanel area={selected} />
    </div>
  );
}
