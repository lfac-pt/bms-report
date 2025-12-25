/**
 * Timeline data processor
 */

import { TimelineData } from "../../src/types/processing";
import { MONITORING_START_MONTH, MONITORING_END_MONTH, VALID_SPECIES } from "../../src/constants";

/**
 * Process timeline data for all transects and years
 */
export function processTimelineData(allData: Record<string, string>[]): TimelineData {
  console.log("\nProcessing timeline data...");

  const timelineData: TimelineData = {
    years: [],
    transectsByYear: {},
    butterflyFrequencyByYear: {},
    transectDiversityByYear: {},
    observationsByYearDate: {}, // For filtering butterfly frequency by transect
  };

  // Extract unique years from monitoring season (March-September)
  const yearsSet = new Set<number>();
  allData.forEach(row => {
    const date = row["Date"];
    if (!date) return;

    // Parse date DD/MM/YYYY
    const parts = date.split("/");
    if (parts.length !== 3) return;
    const year = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10);

    // Filter to monitoring season (March-September)
    if (month >= MONITORING_START_MONTH && month <= MONITORING_END_MONTH) {
      yearsSet.add(year);
    }
  });

  timelineData.years = Array.from(yearsSet).sort((a, b) => a - b);
  console.log(`  Found ${timelineData.years.length} years: ${timelineData.years.join(", ")}`);

  // Process each year
  timelineData.years.forEach(year => {
    // Filter data for this year (monitoring season only)
    const yearData = allData.filter(row => {
      const date = row["Date"];
      if (!date) return false;

      const parts = date.split("/");
      if (parts.length !== 3) return false;

      const rowYear = parseInt(parts[2], 10);
      const month = parseInt(parts[1], 10);
      const species = row["Preferred Species Name"];

      return (
        rowYear === year &&
        month >= MONITORING_START_MONTH &&
        month <= MONITORING_END_MONTH &&
        species &&
        VALID_SPECIES.has(species.trim())
      );
    });

    console.log(`  Processing year ${year}: ${yearData.length} observations`);

    // 1. Transects active this year
    const transectsThisYear = new Set<string>();
    yearData.forEach(row => {
      transectsThisYear.add(row["Transect ID"]);
    });
    timelineData.transectsByYear[year] = Array.from(transectsThisYear);

    // 2. Butterfly frequency
    const allDatesThisYear = new Set<string>();
    yearData.forEach(row => allDatesThisYear.add(row["Date"]));
    const totalVisits = allDatesThisYear.size;

    const speciesVisitsMap = new Map<string, Set<string>>();
    yearData.forEach(row => {
      const species = row["Preferred Species Name"].trim();
      if (!speciesVisitsMap.has(species)) {
        speciesVisitsMap.set(species, new Set<string>());
      }
      speciesVisitsMap.get(species)!.add(row["Date"]);
    });

    timelineData.butterflyFrequencyByYear[year] = Array.from(speciesVisitsMap.entries())
      .map(([species, dateSet]) => ({
        species,
        frequency: (dateSet.size / totalVisits) * 100,
        visitCount: dateSet.size,
        totalVisits,
      }))
      .sort((a, b) => b.frequency - a.frequency);

    // 3. Diversity per transect
    const transectSpeciesMap = new Map<string, Set<string>>();
    yearData.forEach(row => {
      const transectId = row["Transect ID"];
      const species = row["Preferred Species Name"].trim();

      if (!transectSpeciesMap.has(transectId)) {
        transectSpeciesMap.set(transectId, new Set<string>());
      }
      transectSpeciesMap.get(transectId)!.add(species);
    });

    timelineData.transectDiversityByYear[year] = Array.from(transectSpeciesMap.entries())
      .map(([transectId, speciesSet]) => ({
        transectId,
        diversityCount: speciesSet.size,
        speciesList: Array.from(speciesSet).sort(),
      }))
      .sort((a, b) => b.diversityCount - a.diversityCount);

    // 4. Store observations by date for abundance (include ALL species, not just valid ones)
    // For abundance calculations, we want to count all butterflies, not just validated species
    const yearDataAllSpecies = allData.filter(row => {
      const date = row["Date"];
      if (!date) return false;

      const parts = date.split("/");
      if (parts.length !== 3) return false;

      const rowYear = parseInt(parts[2], 10);
      const month = parseInt(parts[1], 10);
      const species = row["Preferred Species Name"];

      return (
        rowYear === year &&
        month >= MONITORING_START_MONTH &&
        month <= MONITORING_END_MONTH &&
        species
      ); // Only check that species exists, don't filter by VALID_SPECIES
    });

    const observationsByDate: Record<string, [string, string, number][]> = {};
    yearDataAllSpecies.forEach(row => {
      const date = row["Date"];
      const transectId = row["Transect ID"];
      const species = row["Preferred Species Name"].trim();
      const abundance = parseInt(row["Abundance Count"], 10) || 0;

      if (!observationsByDate[date]) {
        observationsByDate[date] = [];
      }

      // Store as compact array [transectId, species, abundance]
      observationsByDate[date].push([transectId, species, abundance]);
    });

    timelineData.observationsByYearDate[year] = observationsByDate;
  });

  console.log(`  ✓ Timeline data processed for ${timelineData.years.length} years`);
  return timelineData;
}
