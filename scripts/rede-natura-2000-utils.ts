/**
 * Utilities for working with Rede Natura 2000 sites
 */

import * as fs from "fs";
import * as path from "path";
import { isPointInGeometry } from "./utils/geo-utils";

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

  for (const site of sites) {
    if (isPointInGeometry(longitude, latitude, site.geometry)) {
      return site.name;
    }
  }

  return null;
}
