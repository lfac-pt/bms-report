/**
 * Extract climatic regions from EEA Environmental Zones raster for each transect
 */

import * as fs from "fs";
import * as path from "path";
import { fromFile } from "geotiff";
import proj4 from "proj4";

// Environmental zones mapping (from README.md and raster metadata)
// Translated to Portuguese and acronyms removed
const ENVIRONMENTAL_ZONES: Record<number, string> = {
  1: "Alpino Norte",
  2: "Boreal",
  3: "Nemoral",
  4: "Atlântico Norte",
  5: "Alpino Sul",
  6: "Continental",
  7: "Atlântico Central",
  8: "Panónico",
  9: "Lusitano",
  10: "Anatólico",
  11: "Mediterrânico Montanhoso",
  12: "Mediterrânico Norte",
  13: "Mediterrânico Sul",
  14: "Macaronésia",
  15: "Ártico",
};

// Define projections
// WGS84 (standard lat/lon)
const WGS84 = "EPSG:4326";
// ETRS89-extended / LAEA Europe (European LAEA projection used by EEA)
const EPSG3035 =
  "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs";

// Configure proj4
proj4.defs("EPSG:3035", EPSG3035);

interface TransectCoordinate {
  transectId: string;
  latitude: number;
  longitude: number;
}

/**
 * Convert WGS84 coordinates to EPSG:3035
 */
function convertToEPSG3035(lat: number, lon: number): [number, number] {
  const [x, y] = proj4(WGS84, "EPSG:3035", [lon, lat]);
  return [x, y];
}

/**
 * Extract climatic region for a single coordinate
 */
async function extractClimaticRegion(
  image: any,
  lat: number,
  lon: number
): Promise<string | null> {
  try {
    // Convert to EPSG:3035
    const [x, y] = convertToEPSG3035(lat, lon);

    // Get raster metadata
    const bbox = image.getBoundingBox();
    const [originX, originY] = image.getOrigin();
    const [resX, resY] = image.getResolution();

    // Check if point is within raster bounds
    if (x < bbox[0] || x > bbox[2] || y < bbox[1] || y > bbox[3]) {
      console.log(`  Coordinate (${lat}, ${lon}) is outside raster bounds`);
      return null;
    }

    // Convert geographic coordinates to pixel coordinates
    const pixelX = Math.floor((x - originX) / resX);
    const pixelY = Math.floor((originY - y) / Math.abs(resY));

    // Read pixel value at this location (1x1 window)
    const rasters = await image.readRasters({
      window: [pixelX, pixelY, pixelX + 1, pixelY + 1],
    });

    const zoneCode = rasters[0][0]; // First band, first pixel

    // Look up zone name
    if (zoneCode in ENVIRONMENTAL_ZONES) {
      return ENVIRONMENTAL_ZONES[zoneCode];
    } else if (zoneCode === 0 || zoneCode === 255) {
      // 0 or 255 typically indicates no data
      console.log(`  No environmental zone data at (${lat}, ${lon})`);
      return null;
    } else {
      console.log(`  Unknown zone code ${zoneCode} at (${lat}, ${lon})`);
      return null;
    }
  } catch (error) {
    console.error(`  Error extracting climatic region for (${lat}, ${lon}):`, error);
    return null;
  }
}

/**
 * Load transect coordinates from processed data
 */
function loadTransectCoordinates(processedDataPath: string): TransectCoordinate[] {
  const data = JSON.parse(fs.readFileSync(processedDataPath, "utf8"));

  return data.transects.map((t: any) => ({
    transectId: t.transectId,
    latitude: t.coordinates.lat,
    longitude: t.coordinates.lon,
  }));
}

/**
 * Main function
 */
export async function extractClimaticRegions(): Promise<Record<string, string | null>> {
  console.log("Extracting climatic regions from EEA Environmental Zones raster...\n");

  // Paths
  const rasterPath = path.join(
    __dirname,
    "..",
    "raw-data",
    "environmental-zones",
    "eea_r_3035_1_km_env-zones_p_2018_v01_r00.tif"
  );
  const processedDataPath = path.join(
    __dirname,
    "..",
    "public",
    "data",
    "processed-transects.json"
  );

  // Check if files exist
  if (!fs.existsSync(rasterPath)) {
    throw new Error(`Environmental zones raster not found: ${rasterPath}`);
  }
  if (!fs.existsSync(processedDataPath)) {
    throw new Error(`Processed transects file not found: ${processedDataPath}`);
  }

  // Load raster
  console.log("Loading environmental zones raster...");
  const tiff = await fromFile(rasterPath);
  const image = await tiff.getImage();
  console.log(`  Raster size: ${image.getWidth()}x${image.getHeight()}`);
  console.log(`  Bounding box: ${image.getBoundingBox()}`);
  console.log(`  Resolution: ${image.getResolution()}\n`);

  // Load transect coordinates
  console.log("Loading transect coordinates...");
  const transects = loadTransectCoordinates(processedDataPath);
  console.log(`  Found ${transects.length} transects\n`);

  // Extract climatic region for each transect
  console.log("Extracting climatic regions...");
  const climaticRegions: Record<string, string | null> = {};

  for (const transect of transects) {
    const region = await extractClimaticRegion(
      image,
      transect.latitude,
      transect.longitude
    );
    climaticRegions[transect.transectId] = region;

    if (region) {
      console.log(`  ${transect.transectId}: ${region}`);
    }
  }

  // Summary
  const regionsWithData = Object.values(climaticRegions).filter(r => r !== null).length;
  console.log(`\n✓ Extracted climatic regions for ${regionsWithData}/${transects.length} transects`);

  // Count by region
  const regionCounts: Record<string, number> = {};
  Object.values(climaticRegions).forEach(region => {
    if (region) {
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    }
  });

  console.log("\nClimatic regions distribution:");
  Object.entries(regionCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([region, count]) => {
      console.log(`  ${region}: ${count}`);
    });

  return climaticRegions;
}

// Run if called directly
if (require.main === module) {
  extractClimaticRegions()
    .then(regions => {
      const outputPath = path.join(__dirname, "..", "raw-data", "climatic-regions.json");
      fs.writeFileSync(outputPath, JSON.stringify(regions, null, 2));
      console.log(`\nClimatic regions saved to ${outputPath}`);
    })
    .catch(error => {
      console.error("Error:", error);
      process.exit(1);
    });
}
