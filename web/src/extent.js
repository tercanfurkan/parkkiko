// South-west and north-east corners of the areas in public/data/parking_areas.geojson. Leaflet
// order, [lat, lng]: GeoJSON stores longitude first. extent.test.js fails if a rebuilt file
// reaches beyond it, which would tell drivers in newly covered streets they are outside Helsinki.
export const DATA_EXTENT = [[60.14744, 24.84437], [60.27557, 25.17106]];
