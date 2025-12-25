/**
 * File paths configuration for data processing
 */

import * as path from "path";

// In Node.js/CommonJS context, __dirname is available
// The scripts directory is at the same level as raw-data and public
export const RAW_DATA_DIR = path.join(__dirname, "../../raw-data");
export const METADATA_FILE = path.join(RAW_DATA_DIR, "metadata.csv");
export const ALL_DATA_FILE = path.join(RAW_DATA_DIR, "all.csv");
export const GEOCODE_CACHE_FILE = path.join(RAW_DATA_DIR, "geocode-cache.json");
export const TEMP_RBMS_DIR = path.join(RAW_DATA_DIR, "temp-rbms");
export const OUTPUT_DIR = path.join(__dirname, "../../public/data");
export const OUTPUT_FILE = path.join(OUTPUT_DIR, "processed-transects.json");
export const TIMELINE_OUTPUT_FILE = path.join(OUTPUT_DIR, "timeline-data.json");
export const MUNICIPALITY_GEOJSON_INPUT = path.join(OUTPUT_DIR, "portugal-municipalities.geojson");
export const MUNICIPALITY_GEOJSON_OUTPUT = path.join(
  OUTPUT_DIR,
  "municipalities-species-map.geojson"
);
