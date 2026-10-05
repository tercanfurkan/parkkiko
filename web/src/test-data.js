// The committed app data, read from disk for tests. The app itself fetches it at runtime.
import { readFileSync } from "node:fs";

export const areas = () =>
  JSON.parse(readFileSync(new URL("../public/data/parking_areas.geojson", import.meta.url))).features;
