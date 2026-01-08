import type { TransectStats } from "../types/transectStats";

// Rarity levels based on observation frequency in municipality
export interface RarityLevel {
  label: string;
  color: string;
  percentageThreshold: number; // Percentage of transects (0-100)
}

const RARITY_LEVELS: RarityLevel[] = [
  { label: "Muito Comum", color: "#52c41a", percentageThreshold: 80 }, // >80% of transects
  { label: "Comum", color: "#95de64", percentageThreshold: 60 }, // 60-80%
  { label: "Pouco Comum", color: "#ffd666", percentageThreshold: 40 }, // 40-60%
  { label: "Rara", color: "#ff9c6e", percentageThreshold: 20 }, // 20-40%
  { label: "Muito Rara", color: "#ff4d4f", percentageThreshold: 0 }, // <20%
];

export interface RarityData {
  level: RarityLevel;
  observedSeasons: number;
  totalSeasons: number;
  percentage: number;
}

/**
 * Calculate rarity based on actual year-by-year observations
 * Uses timeline data to count how many transect-years actually observed the species
 * compared to total transect-years in the municipality.
 */
export function calculateRarity(
  speciesName: string,
  municipalityTransects: TransectStats[],
  timelineData: any
): RarityData {
  const defaultRarity: RarityData = {
    level: RARITY_LEVELS[RARITY_LEVELS.length - 1],
    observedSeasons: 0,
    totalSeasons: 0,
    percentage: 0,
  };

  if (municipalityTransects.length === 0 || !timelineData) {
    return defaultRarity;
  }

  // Get transect IDs for this municipality
  const transectIds = new Set(municipalityTransects.map(t => t.transectId));

  // Count total transect-years and transect-years with species observations
  let totalTransectYears = 0;
  let transectYearsWithSpecies = 0;

  // Iterate through each year in the timeline
  for (const year of timelineData.years || []) {
    const yearData = timelineData.transectsByYear?.[year];
    if (!yearData) continue;

    // For each transect in this municipality
    for (const transectId of transectIds) {
      // Check if this transect was active this year
      if (yearData.includes(transectId)) {
        totalTransectYears++;

        // Check if this species was observed in this transect this year
        const yearObservations = timelineData.observationsByYearDate?.[year];
        if (yearObservations) {
          let foundSpecies = false;
          // Check all dates in this year
          for (const dateObservations of Object.values(yearObservations)) {
            for (const [obsTransectId, obsSpecies] of dateObservations as [string, string][]) {
              if (obsTransectId === transectId && obsSpecies === speciesName) {
                foundSpecies = true;
                break;
              }
            }
            if (foundSpecies) break;
          }
          if (foundSpecies) {
            transectYearsWithSpecies++;
          }
        }
      }
    }
  }

  if (totalTransectYears === 0) {
    return defaultRarity;
  }

  // Calculate percentage of transect-years where species was observed
  const percentage = (transectYearsWithSpecies / totalTransectYears) * 100;

  // Find matching rarity level
  let level = RARITY_LEVELS[RARITY_LEVELS.length - 1];
  for (const rarityLevel of RARITY_LEVELS) {
    if (percentage >= rarityLevel.percentageThreshold) {
      level = rarityLevel;
      break;
    }
  }

  return {
    level,
    observedSeasons: transectYearsWithSpecies,
    totalSeasons: totalTransectYears,
    percentage,
  };
}

// Averaged flight curve data
export interface AveragedFlightCurve {
  weeks: number[];
  averageAbundance: number[];
  yearCount: number;
}

/**
 * Average flight curves across all years for a species in a climatic region
 */
export function averageFlightCurves(
  speciesName: string,
  climaticRegion: string,
  flightCurvesData: any
): AveragedFlightCurve | null {
  const speciesData = flightCurvesData?.species?.[speciesName];
  if (!speciesData) return null;

  const regionalData = speciesData.regionalPhenologyCurves?.[climaticRegion];
  if (!regionalData?.phenologyCurves) return null;

  const curves = regionalData.phenologyCurves;
  const years = Object.keys(curves);
  if (years.length === 0) return null;

  // Get weeks from first year
  const firstYear = curves[years[0]];
  const weeks = firstYear.weeks;

  // Average abundance across all years, handling NA values
  const weeklyAverages: number[] = [];
  for (let i = 0; i < weeks.length; i++) {
    let sum = 0;
    let count = 0;

    years.forEach(year => {
      const abundance = curves[year].abundance[i];
      // Skip NA values or non-numeric values
      if (typeof abundance === "number" && !isNaN(abundance)) {
        sum += abundance;
        count++;
      }
    });

    weeklyAverages.push(count > 0 ? sum / count : 0);
  }

  return {
    weeks,
    averageAbundance: weeklyAverages,
    yearCount: years.length,
  };
}

/**
 * Get conservation status description in Portuguese
 */
export function getConservationDescription(status: string): string {
  const descriptions: Record<string, string> = {
    CR: "Criticamente Em Perigo",
    EN: "Em Perigo",
    VU: "Vulnerável",
    NT: "Quase Ameaçada",
    DD: "Dados Insuficientes",
    LC: "Pouco Preocupante",
  };
  return descriptions[status] || status;
}

// Get last year's flight curve for sparkline
export interface LastYearFlightCurve {
  weeks: number[];
  abundance: number[];
}

export function getLastYearFlightCurve(
  speciesName: string,
  climaticRegion: string,
  flightCurvesData: any
): LastYearFlightCurve | null {
  const speciesData = flightCurvesData?.species?.[speciesName];
  if (!speciesData) return null;

  const regionalData = speciesData.regionalPhenologyCurves?.[climaticRegion];
  if (!regionalData?.phenologyCurves) return null;

  const curves = regionalData.phenologyCurves;
  const years = Object.keys(curves).sort(); // Sort to get chronological order
  if (years.length === 0) return null;

  // Get the last (most recent) year
  const lastYear = years[years.length - 1];
  const lastYearData = curves[lastYear];

  return {
    weeks: lastYearData.weeks,
    abundance: lastYearData.abundance,
  };
}
