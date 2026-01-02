import type { TransectStats } from '../types/transectStats';

// Rarity levels based on observation frequency in municipality
export interface RarityLevel {
  label: string;
  color: string;
  percentageThreshold: number; // Percentage of transects (0-100)
}

const RARITY_LEVELS: RarityLevel[] = [
  { label: 'Muito Comum', color: '#52c41a', percentageThreshold: 80 }, // >80% of transects
  { label: 'Comum', color: '#95de64', percentageThreshold: 60 }, // 60-80%
  { label: 'Pouco Comum', color: '#ffd666', percentageThreshold: 40 }, // 40-60%
  { label: 'Rara', color: '#ff9c6e', percentageThreshold: 20 }, // 20-40%
  { label: 'Muito Rara', color: '#ff4d4f', percentageThreshold: 0 }, // <20%
];

/**
 * Calculate rarity based on temporal-weighted observation frequency
 * Uses "transect-years" as the metric: if a species was observed in a transect
 * that was active for 5 years, we assume it was potentially observable across
 * those 5 monitoring seasons.
 */
export function calculateRarity(
  speciesName: string,
  municipalityTransects: TransectStats[]
): RarityLevel {
  if (municipalityTransects.length === 0) {
    return RARITY_LEVELS[RARITY_LEVELS.length - 1]; // Muito Rara if no transects
  }

  // Calculate total possible "transect-years" (monitoring seasons)
  // This is the sum of yearsActive for all transects in the municipality
  const totalTransectYears = municipalityTransects.reduce(
    (sum, t) => sum + (t.yearsActive || 0),
    0
  );

  if (totalTransectYears === 0) {
    return RARITY_LEVELS[RARITY_LEVELS.length - 1];
  }

  // Calculate "transect-years" where species was observed
  // For each transect that observed the species, count its yearsActive
  // This assumes if a species was observed in a transect, it was potentially
  // observable across all the years that transect was monitored
  const transectYearsWithSpecies = municipalityTransects
    .filter(t => t.speciesList.includes(speciesName))
    .reduce((sum, t) => sum + (t.yearsActive || 0), 0);

  // Calculate percentage of monitoring seasons where species was observed
  const percentage = (transectYearsWithSpecies / totalTransectYears) * 100;

  // Find matching rarity level
  for (const level of RARITY_LEVELS) {
    if (percentage >= level.percentageThreshold) {
      return level;
    }
  }
  return RARITY_LEVELS[RARITY_LEVELS.length - 1];
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
      if (typeof abundance === 'number' && !isNaN(abundance)) {
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
    CR: 'Criticamente Em Perigo',
    EN: 'Em Perigo',
    VU: 'Vulnerável',
    NT: 'Quase Ameaçada',
    DD: 'Dados Insuficientes',
    LC: 'Pouco Preocupante',
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
