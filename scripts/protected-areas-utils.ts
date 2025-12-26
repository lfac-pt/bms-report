/**
 * Utilities for working with protected areas (RNAP)
 */

import * as fs from "fs";
import * as path from "path";

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
 * Check if a point is inside a polygon using ray-casting algorithm
 * @param point [longitude, latitude]
 * @param polygon Array of [longitude, latitude] coordinate rings
 * @returns true if point is inside polygon
 */
function pointInPolygon(point: [number, number], polygon: [number, number][][]): boolean {
  const [x, y] = point;

  // Check each ring (first is outer boundary, rest are holes)
  for (let ringIndex = 0; ringIndex < polygon.length; ringIndex++) {
    const ring = polygon[ringIndex];
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }
    }

    // For outer ring (index 0), point must be inside
    // For hole rings (index > 0), point must be outside
    if (ringIndex === 0) {
      if (!inside) return false;
    } else {
      if (inside) return false; // Point is in a hole
    }
  }

  return true;
}

/**
 * Check if a point is inside a MultiPolygon geometry
 */
function pointInMultiPolygon(
  point: [number, number],
  multiPolygon: [number, number][][][]
): boolean {
  for (const polygon of multiPolygon) {
    if (pointInPolygon(point, polygon)) {
      return true;
    }
  }
  return false;
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

  const point: [number, number] = [longitude, latitude];

  for (const area of areas) {
    const { geometry } = area;

    if (geometry.type === "Polygon") {
      if (pointInPolygon(point, geometry.coordinates)) {
        return area.name;
      }
    } else if (geometry.type === "MultiPolygon") {
      if (pointInMultiPolygon(point, geometry.coordinates)) {
        return area.name;
      }
    }
  }

  return null;
}
