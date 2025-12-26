/**
 * Download Portuguese protected areas (RNAP) data from ICNF WFS service
 * Source: https://dados.gov.pt/en/datasets/rede-nacional-de-areas-protegidas-rnap/
 */

/* eslint-env node */

import * as fs from "fs";
import * as path from "path";

const WFS_URL = "https://si.icnf.pt/wfs/rnap";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "protected-areas.geojson");

async function downloadProtectedAreas() {
  console.log("Downloading Portuguese protected areas (RNAP) from ICNF WFS service...");

  try {
    // Construct WFS GetFeature request for GeoJSON output
    // eslint-disable-next-line no-undef
    const params = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeName: "BDG:rnap", // Rede Nacional de Áreas Protegidas layer
      outputFormat: "application/json", // Request GeoJSON
      srsName: "EPSG:4326", // WGS84 coordinate system
    });

    const url = `${WFS_URL}?${params.toString()}`;
    console.log(`  Fetching from: ${url}`);

    // eslint-disable-next-line no-undef
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const geojson = await response.json();

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Save to public/data directory (accessible by both server-side and client-side code)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(geojson, null, 2));

    const featureCount = geojson.features?.length || 0;
    console.log(`  ✓ Downloaded ${featureCount} protected areas`);
    console.log(`  ✓ Saved to: ${OUTPUT_FILE}`);

    return geojson;
  } catch (error) {
    console.error("  ✗ Error downloading protected areas:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  downloadProtectedAreas()
    .then(() => {
      console.log("\n✓ Protected areas download complete!");
      process.exit(0);
    })
    .catch(err => {
      console.error("\n✗ Failed to download protected areas:", err);
      process.exit(1);
    });
}

export { downloadProtectedAreas };
