/**
 * Transect statistics processor
 */

import { TransectStats, Coordinates, Location } from "../../src/types/processing";
import {
  MIN_YEARS_ACTIVE,
  MIN_VISITS_PER_YEAR,
  MONITORING_START_MONTH,
  MONITORING_END_MONTH,
  VALID_SPECIES,
} from "../../src/constants";
import { getYearFromDate, getMonthFromDate } from "../utils";
import { findProtectedArea } from "../protected-areas-utils";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

const TRANSECTS_METADATA_FILE = path.join(
  __dirname,
  "..",
  "..",
  "raw-data",
  "raw transects metadata.csv"
);

const CLIMATIC_REGIONS_FILE = path.join(__dirname, "..", "..", "raw-data", "climatic-regions.json");

let transectLengthMap: Map<string, number> | null = null;
let climaticRegionsMap: Record<string, string | null> | null = null;

/**
 * Load transect metadata (length information) from CSV
 */
function loadTransectMetadata(): Map<string, number> {
  if (transectLengthMap !== null) {
    return transectLengthMap;
  }

  transectLengthMap = new Map();

  if (!fs.existsSync(TRANSECTS_METADATA_FILE)) {
    console.warn(`  Warning: Transects metadata file not found at ${TRANSECTS_METADATA_FILE}`);
    return transectLengthMap;
  }

  try {
    const csvContent = fs.readFileSync(TRANSECTS_METADATA_FILE, "utf8");

    // Parse CSV with proper handling of quoted fields
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Extract Site Code and Overall Length (m) from each record
    for (const record of records) {
      const siteCode = record["Site Code"];
      const lengthStr = record["Overall Length (m)"];

      if (siteCode && lengthStr) {
        const length = parseFloat(lengthStr);
        if (!isNaN(length)) {
          transectLengthMap.set(siteCode, length);
        }
      }
    }

    console.log(`  Loaded length data for ${transectLengthMap.size} transects`);
    return transectLengthMap;
  } catch (error) {
    console.error(`  Error loading transect metadata:`, error);
    return transectLengthMap;
  }
}

/**
 * Load climatic regions for transects from JSON file
 */
function loadClimaticRegions(): Record<string, string | null> {
  if (climaticRegionsMap !== null) {
    return climaticRegionsMap;
  }

  if (!fs.existsSync(CLIMATIC_REGIONS_FILE)) {
    console.warn(`  Warning: Climatic regions file not found at ${CLIMATIC_REGIONS_FILE}`);
    climaticRegionsMap = {};
    return climaticRegionsMap;
  }

  try {
    const jsonContent = fs.readFileSync(CLIMATIC_REGIONS_FILE, "utf8");
    climaticRegionsMap = JSON.parse(jsonContent);

    const regionsWithData = Object.values(climaticRegionsMap).filter(r => r !== null).length;
    console.log(`  Loaded climatic regions for ${regionsWithData} transects`);

    return climaticRegionsMap;
  } catch (error) {
    console.error(`  Error loading climatic regions:`, error);
    climaticRegionsMap = {};
    return climaticRegionsMap;
  }
}

/**
 * Calculate statistics for a transect
 */
export function calculateTransectStats(
  transectId: string,
  allData: Record<string, string>[],
  metadata: Record<string, string>,
  location: Location | null = null,
  coords: Coordinates | null = null
): TransectStats | null {
  // Filter data for this transect AND only include valid species
  const transectData = allData.filter(row => {
    if (row["Transect ID"] !== transectId) return false;

    const species = row["Preferred Species Name"];
    if (!species || !species.trim()) return false;

    // Only include records for species in the whitelist
    return VALID_SPECIES.has(species.trim());
  });

  if (transectData.length === 0) {
    return null;
  }

  // Get unique species (using Preferred Species Name)
  // All species are already filtered by the whitelist, so just count unique ones
  const speciesSet = new Set<string>();
  transectData.forEach(row => {
    const species = row["Preferred Species Name"];
    if (species && species.trim()) {
      speciesSet.add(species.trim());
    }
  });

  // Get unique dates and years
  const datesSet = new Set<string>();
  transectData.forEach(row => {
    const date = row["Date"];
    if (date && date.trim()) {
      datesSet.add(date.trim());
    }
  });

  // Calculate years active and first monitoring year using only monitoring season data
  // Monitoring season is March-September (months MONITORING_START_MONTH-1 to MONITORING_END_MONTH-1 in 0-indexed)
  const monitoringSeasonData = transectData.filter(row => {
    const month = getMonthFromDate(row["Date"]);
    return (
      month !== null && month >= MONITORING_START_MONTH - 1 && month <= MONITORING_END_MONTH - 1
    );
  });

  const monitoringYearsSet = new Set<number>();
  monitoringSeasonData.forEach(row => {
    const year = getYearFromDate(row["Date"]);
    if (year) {
      monitoringYearsSet.add(year);
    }
  });

  // Calculate total abundance
  let totalAbundance = 0;
  transectData.forEach(row => {
    const abundance = parseInt(row["Abundance Count"], 10);
    if (!isNaN(abundance)) {
      totalAbundance += abundance;
    }
  });

  // Calculate statistics
  const totalSpecies = speciesSet.size;
  const totalVisits = datesSet.size;
  const yearsActive = monitoringYearsSet.size;
  const firstMonitoringYear = monitoringYearsSet.size > 0 ? Math.min(...monitoringYearsSet) : null;
  const lastMonitoringYear = monitoringYearsSet.size > 0 ? Math.max(...monitoringYearsSet) : null;
  const avgVisitsPerYear = yearsActive > 0 ? totalVisits / yearsActive : 0;
  const avgButterfliesPerVisit = totalVisits > 0 ? totalAbundance / totalVisits : 0;

  // Note: isActive will be determined later based on the most recent year across all transects

  // Check if transect is inside a protected area
  let protectedArea: string | null = null;
  if (coords && coords.lat !== null && coords.lon !== null) {
    protectedArea = findProtectedArea(coords.lon, coords.lat);
  }

  // Get transect length from metadata
  const lengthMap = loadTransectMetadata();
  const transectCode = metadata["Transect Code"] || "";
  const length = lengthMap.get(transectCode) || null;

  // Get climatic region from BMS environmental zones
  const climaticRegionsMap = loadClimaticRegions();
  const climaticRegion = climaticRegionsMap[transectId] || null;

  return {
    transectId: transectId,
    transectCode: metadata["Transect Code"] || "",
    transectName: metadata["Transect Name"] || "",
    isActive: false, // Will be updated based on most recent year
    totalSpecies,
    totalVisits,
    totalAbundance,
    avgVisitsPerYear: Math.round(avgVisitsPerYear * 10) / 10, // Round to 1 decimal
    avgButterfliesPerVisit: Math.round(avgButterfliesPerVisit * 10) / 10, // Round to 1 decimal
    yearsActive,
    firstMonitoringYear,
    lastMonitoringYear,
    // List of species observed in this transect
    speciesList: [...speciesSet].sort(),
    // Additional metadata
    tipologia: metadata["Tipologia"] || "",
    concelho: location ? location.concelho : metadata["Concelho"] || "",
    distrito: location ? location.distrito : "",
    climaticRegion: climaticRegion || "Desconhecido",
    responsavel: metadata["Responsável"] || "",
    entidade: metadata["Entidade"] || "",
    // Fuzzy coordinates for privacy (approximate location only)
    coordinates: coords,
    // Protected area (if transect is inside one)
    protectedArea: protectedArea,
    // Transect length in meters
    length: length,
  };
}

/**
 * Filter transects based on quality criteria for GBI
 * Criteria: MIN_YEARS_ACTIVE years active, MIN_VISITS_PER_YEAR visits per year average
 */
export function getQualityFilteredTransects(transects: TransectStats[]): TransectStats[] {
  return transects.filter(
    t => t.yearsActive >= MIN_YEARS_ACTIVE && t.avgVisitsPerYear >= MIN_VISITS_PER_YEAR
  );
}
