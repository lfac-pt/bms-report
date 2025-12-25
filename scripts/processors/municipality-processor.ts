/**
 * Municipality GeoJSON processor
 */

import * as fs from "fs";
import * as proj4 from "proj4";
import { TransectStats, GeoJSON } from "../../src/types/processing";
import { VALID_SPECIES } from "../../src/constants";
import { MUNICIPALITY_GEOJSON_INPUT, MUNICIPALITY_GEOJSON_OUTPUT } from "../config";

/**
 * Define proj4 coordinate systems
 */
// EPSG:3763 - Portuguese Transverse Mercator (source)
proj4.default.defs(
  "EPSG:3763",
  "+proj=tmerc +lat_0=39.66825833333333 +lon_0=-8.133108333333334 +k=1 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
);
// EPSG:4326 - WGS84 (destination - standard lat/lon)
proj4.default.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

/**
 * Recursively reproject coordinates from EPSG:3763 to EPSG:4326 (WGS84)
 */
function reprojectCoordinates(coords: any): any {
  if (typeof coords[0] === "number" && coords.length === 2) {
    // It's a coordinate pair [x, y] in EPSG:3763, transform to [lon, lat] in EPSG:4326
    return proj4.default("EPSG:3763", "EPSG:4326", coords);
  }
  // It's an array of coordinates, recurse
  return coords.map((c: any) => reprojectCoordinates(c));
}

/**
 * Recursively simplify coordinates by reducing precision
 */
function simplifyCoordinates(coords: any, precision: number = 4): any {
  if (typeof coords[0] === "number") {
    // It's a coordinate pair [lon, lat]
    return coords.map((c: number) => Number(c.toFixed(precision)));
  }
  // It's an array of coordinates, recurse
  return coords.map((c: any) => simplifyCoordinates(c, precision));
}

/**
 * Process municipality GeoJSON data
 */
export function processMunicipalityGeoJSON(
  transects: TransectStats[],
  allData: Record<string, string>[]
): void {
  console.log("\n=== Processing municipality species map ===");

  // Check if input GeoJSON exists
  if (!fs.existsSync(MUNICIPALITY_GEOJSON_INPUT)) {
    console.warn(`Warning: Municipality GeoJSON not found at ${MUNICIPALITY_GEOJSON_INPUT}`);
    console.warn("Skipping municipality map generation.");
    return;
  }

  // Aggregate species by municipality and month
  console.log("Aggregating species by municipality and month...");
  const municipalityData: Record<
    string,
    {
      originalName: string;
      speciesSet: Set<string>;
      monthlySpecies: Record<number, Set<string>>;
      transectCount: number;
      transects: { name: string; isActive: boolean; firstMonitoringYear: number | null }[];
    }
  > = {};

  // Build a map of transect ID to municipality name
  const transectToMunicipality: Record<
    string,
    {
      normalizedName: string;
      originalName: string;
      transectName: string;
      isActive: boolean;
      firstMonitoringYear: number | null;
    }
  > = {};

  transects.forEach(transect => {
    if (transect.concelho) {
      const normalizedName = transect.concelho
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      transectToMunicipality[transect.transectId] = {
        normalizedName,
        originalName: transect.concelho,
        transectName: transect.transectName,
        isActive: transect.isActive,
        firstMonitoringYear: transect.firstMonitoringYear,
      };
    }
  });

  // Initialize municipality data with monthly breakdowns
  Object.values(transectToMunicipality).forEach(
    ({ normalizedName, originalName, transectName, isActive, firstMonitoringYear }) => {
      if (!municipalityData[normalizedName]) {
        municipalityData[normalizedName] = {
          originalName,
          speciesSet: new Set<string>(),
          monthlySpecies: {}, // { 1: Set(), 2: Set(), ... 12: Set() }
          transectCount: 0,
          transects: [],
        };
        // Initialize monthly sets
        for (let month = 1; month <= 12; month++) {
          municipalityData[normalizedName].monthlySpecies[month] = new Set<string>();
        }
      }

      // Avoid duplicate transects
      const transectExists = municipalityData[normalizedName].transects.some(
        t => t.name === transectName
      );
      if (!transectExists) {
        municipalityData[normalizedName].transects.push({
          name: transectName,
          isActive,
          firstMonitoringYear,
        });
        municipalityData[normalizedName].transectCount++;
      }
    }
  );

  // Aggregate species from observations
  allData.forEach(row => {
    const transectId = row["Transect ID"];
    const species = row["Preferred Species Name"];
    const dateStr = row["Date"]; // Format: DD/MM/YYYY

    if (!species || !species.trim()) return;

    const trimmedSpecies = species.trim();
    if (!VALID_SPECIES.has(trimmedSpecies)) return;

    if (!transectId || !dateStr) return;

    const municipalityInfo = transectToMunicipality[transectId];
    if (!municipalityInfo) return;

    const { normalizedName } = municipalityInfo;

    // Parse month from date (DD/MM/YYYY)
    const dateParts = dateStr.split("/");
    if (dateParts.length === 3) {
      const month = parseInt(dateParts[1], 10);

      if (month >= 1 && month <= 12) {
        // Add to overall species set
        municipalityData[normalizedName].speciesSet.add(species);
        // Add to month-specific set
        municipalityData[normalizedName].monthlySpecies[month].add(species);
      }
    }
  });

  console.log(`  - Found ${Object.keys(municipalityData).length} municipalities with data`);

  // Load the GeoJSON
  console.log("Loading municipality GeoJSON...");
  let geoJSONContent = fs.readFileSync(MUNICIPALITY_GEOJSON_INPUT, "utf-8");
  // Strip BOM if present
  if (geoJSONContent.charCodeAt(0) === 0xfeff) {
    geoJSONContent = geoJSONContent.substring(1);
  }
  const geoJSON: GeoJSON = JSON.parse(geoJSONContent);

  // Remove CRS definition since we're converting to standard WGS84
  delete geoJSON.crs;

  // Process each feature
  console.log("Adding species data to GeoJSON features...");
  let municipalitiesWithData = 0;
  let municipalitiesWithoutData = 0;

  geoJSON.features = geoJSON.features.map(feature => {
    const concelhoName = feature.properties.Concelho as string;
    const normalizedName = concelhoName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

    const data = municipalityData[normalizedName];

    if (data) {
      // Convert monthly species Sets to counts and arrays
      const monthlySpeciesCount: Record<number, number> = {};
      const monthlySpeciesLists: Record<number, string[]> = {};
      for (let month = 1; month <= 12; month++) {
        monthlySpeciesCount[month] = data.monthlySpecies[month].size;
        monthlySpeciesLists[month] = Array.from(data.monthlySpecies[month]);
      }

      // Calculate earliest monitoring year from active transects
      const activeTransectsYears = data.transects
        .filter(t => t.isActive && t.firstMonitoringYear)
        .map(t => t.firstMonitoringYear!);
      const monitoringSinceYear =
        activeTransectsYears.length > 0 ? Math.min(...activeTransectsYears) : null;

      feature.properties = {
        Concelho: concelhoName,
        speciesCount: data.speciesSet.size,
        transectCount: data.transectCount,
        transects: data.transects,
        monthlySpeciesCount, // { 1: 5, 2: 8, ... 12: 3 }
        monthlySpeciesLists, // { 1: ["Species A", "Species B"], 2: [...], ... 12: [...] }
        species: Array.from(data.speciesSet), // Array of species names
        monitoringSinceYear, // Earliest year from active transects
      };
      municipalitiesWithData++;
    } else {
      // Initialize empty monthly data
      const monthlySpeciesCount: Record<number, number> = {};
      const monthlySpeciesLists: Record<number, string[]> = {};
      for (let month = 1; month <= 12; month++) {
        monthlySpeciesCount[month] = 0;
        monthlySpeciesLists[month] = [];
      }

      feature.properties = {
        Concelho: concelhoName,
        speciesCount: 0,
        transectCount: 0,
        transects: [],
        monthlySpeciesCount,
        monthlySpeciesLists,
        species: [],
      };
      municipalitiesWithoutData++;
    }

    // Reproject from EPSG:3763 to EPSG:4326 (WGS84 lat/lon for Leaflet)
    // Then simplify geometry by reducing coordinate precision to 4 decimal places
    if (feature.geometry && feature.geometry.coordinates) {
      feature.geometry.coordinates = reprojectCoordinates(feature.geometry.coordinates);
      feature.geometry.coordinates = simplifyCoordinates(feature.geometry.coordinates);
    }

    return feature;
  });

  console.log(`  - Municipalities with data: ${municipalitiesWithData}`);
  console.log(`  - Municipalities without data: ${municipalitiesWithoutData}`);

  // Write output (compact format to minimize file size)
  console.log(`Writing municipality species map to ${MUNICIPALITY_GEOJSON_OUTPUT}...`);
  fs.writeFileSync(MUNICIPALITY_GEOJSON_OUTPUT, JSON.stringify(geoJSON), "utf-8");

  const outputSize = fs.statSync(MUNICIPALITY_GEOJSON_OUTPUT).size;
  const inputSize = fs.statSync(MUNICIPALITY_GEOJSON_INPUT).size;
  const compressionRatio = ((1 - outputSize / inputSize) * 100).toFixed(1);

  console.log(`  ✓ Municipality species map saved`);
  console.log(`    Input size: ${(inputSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`    Output size: ${(outputSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`    Compression: ${compressionRatio}%`);
}
