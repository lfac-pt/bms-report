/**
 * Main butterfly data processing script
 * Coordinates all data processing, analysis, and output generation
 */

import * as fs from "fs";
import * as path from "path";
import {
  TransectStats,
  RegionalPhenologyData,
  FilteredSpeciesData,
  SpeciesCorrection,
  Coordinates,
  Location,
} from "../src/types/processing";
import { BASELINE_YEAR, VALID_SPECIES } from "../src/constants";
import {
  readCSV,
  reverseGeocode,
  extractLocation,
  sleep,
  loadGeocodeCache,
  saveGeocodeCache,
  parseCoordinates,
  fuzzyCoordinates,
} from "./utils";
import {
  METADATA_FILE,
  ALL_DATA_FILE,
  OUTPUT_DIR,
  OUTPUT_FILE,
  TIMELINE_OUTPUT_FILE,
} from "./config";
import { SPECIES_NAME_CORRECTIONS } from "./config";
import {
  calculateTransectStats,
  calculateGBI,
  calculateAllFlightCurves,
  calculateRegionalPhenology,
  processTimelineData,
  processMunicipalityGeoJSON,
} from "./processors";

/**
 * Main processing function
 */
async function processData(): Promise<void> {
  console.log("Starting butterfly data processing...\n");

  // Read metadata
  const metadataRows = readCSV(METADATA_FILE);

  // Check for the specific transect the user is looking for
  const targetTransect = metadataRows.find(
    row => row["Transect Name"] && row["Transect Name"].includes("Baldios de São Miguel de Poiares")
  );
  if (targetTransect) {
    console.log(`\nFound target transect: ${targetTransect["Transect Name"]}`);
    console.log(`  ID: ${targetTransect["Transect ID"]}`);
    console.log(`  Situação: ${targetTransect["Situação"]}`);
  } else {
    console.log(`\nTarget transect "Baldios de São Miguel de Poiares" not found in metadata`);
  }

  // Filter for valid and new transects (trim to handle trailing spaces)
  const validTransects = metadataRows.filter(row => {
    const situacao = (row["Situação"] || "").trim();
    return situacao === "Válido" || situacao === "Novo";
  });
  console.log(
    `\nFound ${validTransects.length} valid/new transects (out of ${metadataRows.length} total)\n`
  );

  // Read all butterfly observation data
  const allData = readCSV(ALL_DATA_FILE);

  // Correct common species name typos
  let correctedRecordsCount = 0;
  const correctionDetails: Record<string, SpeciesCorrection> = {}; // Track count per correction

  allData.forEach(row => {
    const speciesName = row["Preferred Species Name"];
    if (speciesName && SPECIES_NAME_CORRECTIONS[speciesName]) {
      const correctedName = SPECIES_NAME_CORRECTIONS[speciesName];
      row["Preferred Species Name"] = correctedName;
      correctedRecordsCount++;

      // Track this correction
      if (!correctionDetails[speciesName]) {
        correctionDetails[speciesName] = {
          from: speciesName,
          to: correctedName,
          count: 0,
        };
      }
      correctionDetails[speciesName].count++;
    }
  });

  if (correctedRecordsCount > 0) {
    console.log(`\nCorrected ${correctedRecordsCount} species name typos`);
    Object.values(correctionDetails).forEach(detail => {
      console.log(
        `  ${detail.from} → ${detail.to}: ${detail.count} ${detail.count === 1 ? "record" : "records"}`
      );
    });
  }

  // Create a map of metadata by Transect ID for quick lookup
  const metadataMap: Record<string, Record<string, string>> = {};
  validTransects.forEach(row => {
    const transectId = row["Transect ID"];
    if (transectId && transectId.trim()) {
      metadataMap[transectId.trim()] = row;
    }
  });

  // Geocode transect coordinates to get Concelho and Distrito
  console.log("\nGeocoding transect coordinates...");
  const geocodeCache = loadGeocodeCache();
  const locationMap: Record<string, Location> = {};
  const coordinatesMap: Record<string, Coordinates> = {}; // Store fuzzy coordinates for privacy
  let geocodedCount = 0;
  let cachedCount = 0;
  let failedCount = 0;
  let apiCallCount = 0;
  const failedTransects: { name: string; id: string; coords?: string; reason: string }[] = [];

  for (const [transectId, metadata] of Object.entries(metadataMap)) {
    const coords = parseCoordinates(metadata["Spatial Refere"]);

    // Store fuzzy coordinates for map display (privacy protection)
    if (coords) {
      const fuzzyCoords = fuzzyCoordinates(coords);
      if (fuzzyCoords) {
        coordinatesMap[transectId] = fuzzyCoords;
      }
    }

    if (coords) {
      const cacheKey = `${coords.lat.toFixed(5)},${coords.lon.toFixed(5)}`;

      // Check cache first
      if (geocodeCache[cacheKey]) {
        locationMap[transectId] = geocodeCache[cacheKey];
        cachedCount++;
      } else {
        try {
          // Respect Nominatim's usage policy: max 1 request per second
          await sleep(1000);

          const result = await reverseGeocode(coords.lat, coords.lon);
          const location = extractLocation(result);

          if (location.concelho || location.distrito) {
            locationMap[transectId] = location;
            geocodeCache[cacheKey] = location; // Save to cache
            geocodedCount++;
            apiCallCount++;

            // Log progress every 10 API calls
            if (apiCallCount % 10 === 0) {
              console.log(`  Made ${apiCallCount} API calls...`);
            }
          } else {
            failedCount++;
            failedTransects.push({
              name: metadata["Transect Name"],
              id: transectId,
              reason: "No concelho/distrito in response",
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(
            `  Warning: Failed to geocode transect ${metadata["Transect Name"]}: ${errorMessage}`
          );
          failedCount++;
          failedTransects.push({
            name: metadata["Transect Name"],
            id: transectId,
            reason: errorMessage,
          });
        }
      }
    } else {
      failedCount++;
      failedTransects.push({
        name: metadata["Transect Name"],
        id: transectId,
        coords: metadata["Spatial Refere"],
        reason: "Invalid or missing coordinates",
      });
    }
  }

  // Save updated cache
  if (apiCallCount > 0) {
    saveGeocodeCache(geocodeCache);
    console.log(`\nCache updated with ${apiCallCount} new entries`);
  }

  console.log(
    `\nGeocoding complete: ${geocodedCount} from API, ${cachedCount} from cache, ${failedCount} failed`
  );

  if (failedTransects.length > 0) {
    console.log(`\nFailed to geocode ${failedTransects.length} transects:`);
    failedTransects.forEach(t => {
      if (t.coords) {
        console.log(`  - ${t.name} (ID: ${t.id})`);
        console.log(`    Coordinates: "${t.coords}"`);
        console.log(`    Reason: ${t.reason}`);
      } else {
        console.log(`  - ${t.name} (ID: ${t.id}) - ${t.reason}`);
      }
    });
  }

  // Track filtered species (those not in the whitelist) with record counts and total individuals
  const filteredSpeciesMap = new Map<string, FilteredSpeciesData>();
  const validTransectIds = new Set(Object.keys(metadataMap));

  // Collect all species that were filtered out from valid transects
  allData.forEach(row => {
    const transectId = row["Transect ID"];
    if (!validTransectIds.has(transectId)) return; // Skip invalid transects

    const species = row["Preferred Species Name"];
    if (!species || !species.trim()) return;

    const trimmedSpecies = species.trim();
    // Check if it's a valid binomial name but NOT in the whitelist
    if (trimmedSpecies.split(" ").length === 2 && !VALID_SPECIES.has(trimmedSpecies)) {
      const count = parseInt(row["Abundance Count"], 10) || 0;
      const existing = filteredSpeciesMap.get(trimmedSpecies) || {
        recordCount: 0,
        totalIndividuals: 0,
      };
      filteredSpeciesMap.set(trimmedSpecies, {
        recordCount: existing.recordCount + 1,
        totalIndividuals: existing.totalIndividuals + count,
      });
    }
  });

  // Calculate statistics for each valid transect
  console.log("\nCalculating statistics for each transect...");
  const results: TransectStats[] = [];
  let processedCount = 0;
  const skippedTransects: { id: string; name: string; situacao: string }[] = [];

  Object.entries(metadataMap).forEach(([transectId, metadata]) => {
    const location = locationMap[transectId] || null;
    const coords = coordinatesMap[transectId] || null;
    const stats = calculateTransectStats(transectId, allData, metadata, location, coords);
    if (stats) {
      results.push(stats);
      processedCount++;

      // Log progress every 20 transects
      if (processedCount % 20 === 0) {
        console.log(`  Processed ${processedCount} transects...`);
      }
    } else {
      skippedTransects.push({
        id: transectId,
        name: metadata["Transect Name"] || "Unknown",
        situacao: metadata["Situação"] || "Unknown",
      });
    }
  });

  console.log(`\nSuccessfully calculated statistics for ${results.length} transects`);

  // Determine the most recent year across all transects
  const mostRecentYear =
    results.length > 0
      ? Math.max(...results.map(t => t.lastMonitoringYear || 0).filter(y => y > 0))
      : null;

  // Update isActive flag based on most recent year
  if (mostRecentYear) {
    results.forEach(transect => {
      transect.isActive = transect.lastMonitoringYear === mostRecentYear;
    });
    console.log(`Most recent monitoring year: ${mostRecentYear}`);
    console.log(
      `Active transects (monitored in ${mostRecentYear}): ${results.filter(t => t.isActive).length}`
    );
  }

  if (skippedTransects.length > 0) {
    console.log(`\nSkipped ${skippedTransects.length} transects (no valid observation data):`);
    skippedTransects.forEach(t => {
      console.log(`  - ${t.name} (ID: ${t.id}, Situação: ${t.situacao})`);
    });
  }

  // Sort by transect name
  results.sort((a, b) => a.transectName.localeCompare(b.transectName));

  // Prepare filtered species list with record counts and total individuals
  const filteredSpeciesList = Array.from(filteredSpeciesMap.entries())
    .map(([species, data]) => ({
      species,
      recordCount: data.recordCount,
      totalIndividuals: data.totalIndividuals,
    }))
    .sort((a, b) => a.species.localeCompare(b.species));

  // Calculate total butterflies with valid species only
  const totalButterfliesValidSpecies = results.reduce((sum, t) => sum + t.totalAbundance, 0);

  // Calculate total butterflies including all species (even invalid ones)
  const totalButterfliesAllSpecies = allData.reduce((sum, row) => {
    const count = parseInt(row["Abundance Count"], 10);
    return sum + (isNaN(count) ? 0 : count);
  }, 0);

  // Create output object with transects and metadata
  const output = {
    transects: results,
    metadata: {
      totalValidTransects: results.length,
      activeTransects: results.filter(t => t.isActive).length,
      inactiveTransects: results.filter(t => !t.isActive).length,
      filteredSpeciesCount: filteredSpeciesList.length,
      filteredSpecies: filteredSpeciesList,
      totalButterfliesValidSpecies,
      totalButterfliesAllSpecies,
      correctedRecords: correctedRecordsCount,
      corrections: Object.values(correctionDetails),
    },
  };

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write to JSON file
  console.log(`\nWriting results to ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");

  // Process and save timeline data
  const timelineData = processTimelineData(allData);
  console.log(`\nWriting timeline data to ${TIMELINE_OUTPUT_FILE}...`);
  fs.writeFileSync(TIMELINE_OUTPUT_FILE, JSON.stringify(timelineData, null, 2), "utf-8");
  console.log(
    `Timeline data saved (${(fs.statSync(TIMELINE_OUTPUT_FILE).size / 1024).toFixed(2)} KB)`
  );

  // Calculate and save GBI data
  const gbiData = await calculateGBI(allData, results, BASELINE_YEAR);

  // Calculate and save flight curves for all species
  const flightCurvesData = await calculateAllFlightCurves(allData, results, BASELINE_YEAR);

  // Calculate and save regional phenology curves (skip if --skip-regional flag is set)
  const skipRegional = process.argv.includes("--skip-regional");
  let phenologyData: RegionalPhenologyData | null = null;

  if (skipRegional) {
    console.log("\n⏭️  Skipping regional phenology curves (--skip-regional flag set)");
  } else {
    phenologyData = await calculateRegionalPhenology(allData, results, BASELINE_YEAR);
  }

  // Write GBI data to file
  if (gbiData) {
    const GBI_OUTPUT_FILE = path.join(OUTPUT_DIR, "gbi-data.json");
    console.log(`\nWriting GBI data to ${GBI_OUTPUT_FILE}...`);
    fs.writeFileSync(GBI_OUTPUT_FILE, JSON.stringify(gbiData, null, 2), "utf-8");
    console.log(`GBI data saved (${(fs.statSync(GBI_OUTPUT_FILE).size / 1024).toFixed(2)} KB)`);
  } else {
    console.warn("\nWarning: GBI calculation failed or returned no data");
  }

  // Write flight curves data to file
  if (flightCurvesData) {
    const FLIGHT_CURVES_OUTPUT_FILE = path.join(OUTPUT_DIR, "flight-curves-data.json");
    console.log(`\nWriting flight curves data to ${FLIGHT_CURVES_OUTPUT_FILE}...`);
    fs.writeFileSync(FLIGHT_CURVES_OUTPUT_FILE, JSON.stringify(flightCurvesData, null, 2), "utf-8");
    console.log(
      `Flight curves data saved (${(fs.statSync(FLIGHT_CURVES_OUTPUT_FILE).size / 1024).toFixed(2)} KB)`
    );
    console.log(`  - Species with flight curves: ${flightCurvesData.speciesList.length}`);
  } else {
    console.warn("\nWarning: Flight curves calculation failed or returned no data");
  }

  // Write phenology data to file
  if (phenologyData) {
    const PHENOLOGY_OUTPUT_FILE = path.join(OUTPUT_DIR, "phenology-curves-data.json");
    console.log(`\nWriting regional phenology data to ${PHENOLOGY_OUTPUT_FILE}...`);
    fs.writeFileSync(PHENOLOGY_OUTPUT_FILE, JSON.stringify(phenologyData, null, 2), "utf-8");
    console.log(
      `Phenology data saved (${(fs.statSync(PHENOLOGY_OUTPUT_FILE).size / 1024).toFixed(2)} KB)`
    );
    console.log(`  - Species with regional phenology: ${phenologyData.speciesList.length}`);
  } else {
    console.warn("\nWarning: Regional phenology calculation failed or returned no data");
  }

  // Process municipality species map
  processMunicipalityGeoJSON(results, allData);

  console.log("\n✓ Processing complete!");
  console.log(`\nSummary:`);
  console.log(`  - Total valid transects: ${results.length}`);
  console.log(`  - Active transects: ${results.filter(t => t.isActive).length}`);
  console.log(`  - Inactive transects: ${results.filter(t => !t.isActive).length}`);
  console.log(`  - Filtered species: ${filteredSpeciesList.length}`);
  console.log(`  - Output file: ${OUTPUT_FILE}`);
  console.log(`  - File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
}

// Run the script
try {
  processData();
} catch (error) {
  const errorMessage = error instanceof Error ? error : String(error);
  console.error("\n❌ Error processing data:", errorMessage);
  process.exit(1);
}
