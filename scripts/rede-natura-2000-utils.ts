/**
 * Utilities for working with Rede Natura 2000 sites
 */

import * as fs from "fs";
import * as path from "path";

const REDE_NATURA_2000_FILE = path.join(
  __dirname,
  "..",
  "public",
  "data",
  "rede-natura-2000.geojson"
);

interface GeoJSONGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: [number, number][][] | [number, number][][][];
}

interface RedeNatura2000Site {
  name: string;
  code: string;
  classification: string;
  geometry: GeoJSONGeometry;
}

let redeNatura2000Sites: RedeNatura2000Site[] | null = null;

/**
 * Load Rede Natura 2000 sites data from GeoJSON file
 */
export function loadRedeNatura2000Sites(): RedeNatura2000Site[] {
  if (redeNatura2000Sites !== null) {
    return redeNatura2000Sites;
  }

  if (!fs.existsSync(REDE_NATURA_2000_FILE)) {
    console.warn(`  Warning: Rede Natura 2000 file not found at ${REDE_NATURA_2000_FILE}`);
    console.warn(`  Run 'npx tsx scripts/download-rede-natura-2000.ts' to download the data`);
    redeNatura2000Sites = [];
    return redeNatura2000Sites;
  }

  try {
    const geojson = JSON.parse(fs.readFileSync(REDE_NATURA_2000_FILE, "utf8"));

    redeNatura2000Sites = geojson.features.map(
      (feature: {
        properties: { nome_ac: string; codigo_ac: string; classifica: string };
        geometry: GeoJSONGeometry;
      }) => ({
        name: feature.properties.nome_ac,
        code: feature.properties.codigo_ac,
        classification: feature.properties.classifica,
        geometry: feature.geometry,
      })
    );

    console.log(`  Loaded ${redeNatura2000Sites.length} Rede Natura 2000 sites`);
    return redeNatura2000Sites;
  } catch (error) {
    console.error(`  Error loading Rede Natura 2000 sites:`, error);
    redeNatura2000Sites = [];
    return redeNatura2000Sites;
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
 * Find which Rede Natura 2000 site (if any) contains the given coordinates
 * @param longitude
 * @param latitude
 * @returns Rede Natura 2000 site name or null
 */
export function findRedeNatura2000Site(longitude: number, latitude: number): string | null {
  const sites = loadRedeNatura2000Sites();

  if (sites.length === 0) {
    return null;
  }

  const point: [number, number] = [longitude, latitude];

  for (const site of sites) {
    const { geometry } = site;

    if (geometry.type === "Polygon") {
      if (pointInPolygon(point, geometry.coordinates)) {
        return site.name;
      }
    } else if (geometry.type === "MultiPolygon") {
      if (pointInMultiPolygon(point, geometry.coordinates)) {
        return site.name;
      }
    }
  }

  return null;
}
