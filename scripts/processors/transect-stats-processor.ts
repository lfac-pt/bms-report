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
import { getClimaticRegion } from "../config";

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
    climaticRegion: getClimaticRegion(location ? location.distrito : ""),
    responsavel: metadata["Responsável"] || "",
    entidade: metadata["Entidade"] || "",
    // Fuzzy coordinates for privacy (approximate location only)
    coordinates: coords,
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
