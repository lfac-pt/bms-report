/**
 * Utilities for working with protected areas (RNAP)
 */

import * as fs from "fs";
import * as path from "path";
import { isPointInGeometry } from "./utils/geo-utils";

const PROTECTED_AREAS_FILE = path.join(
  __dirname,
  "..",
  "public",
  "data",
  "protected-areas.geojson"
);

interface GeoJSONGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: [number, number][][] | [number, number][][][];
}

interface ProtectedArea {
  name: string;
  classification: string;
  geometry: GeoJSONGeometry;
}

let protectedAreas: ProtectedArea[] | null = null;

/**
 * Load protected areas data from GeoJSON file
 */
export function loadProtectedAreas(): ProtectedArea[] {
  if (protectedAreas !== null) {
    return protectedAreas;
  }

  if (!fs.existsSync(PROTECTED_AREAS_FILE)) {
    console.warn(`  Warning: Protected areas file not found at ${PROTECTED_AREAS_FILE}`);
    console.warn(`  Run 'npx tsx scripts/download-protected-areas.ts' to download the data`);
    protectedAreas = [];
    return protectedAreas;
  }

  try {
    const geojson = JSON.parse(fs.readFileSync(PROTECTED_AREAS_FILE, "utf8"));

    protectedAreas = geojson.features.map(
      (feature: {
        properties: { nome_ap: string; classifica: string };
        geometry: GeoJSONGeometry;
      }) => ({
        name: feature.properties.nome_ap,
        classification: feature.properties.classifica,
        geometry: feature.geometry,
      })
    );

    console.log(`  Loaded ${protectedAreas.length} protected areas`);
    return protectedAreas;
  } catch (error) {
    console.error(`  Error loading protected areas:`, error);
    protectedAreas = [];
    return protectedAreas;
  }
}

/**
 * Find which protected area (if any) contains the given coordinates
 * @param longitude
 * @param latitude
 * @returns Protected area name or null
 */
export function findProtectedArea(longitude: number, latitude: number): string | null {
  const areas = loadProtectedAreas();

  if (areas.length === 0) {
    return null;
  }

  for (const area of areas) {
    if (isPointInGeometry(longitude, latitude, area.geometry)) {
      return area.name;
    }
  }

  return null;
}
