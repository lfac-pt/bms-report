/**
 * Shared constants for BMS data processing and visualization
 *
 * This file contains configuration values used across both:
 * - Data processing scripts (scripts/process-butterfly-data.js, R scripts)
 * - Frontend application (src/)
 *
 * Centralizing these values ensures consistency and makes it easier to update
 * quality criteria and baseline years.
 */

// Data quality criteria for transect filtering
export const MIN_YEARS_ACTIVE = 5;  // Minimum number of years a transect must be active
export const MIN_VISITS_PER_YEAR = 5;  // Minimum average visits per year

// R-specific quality criteria (used in rbms-collated-index.R)
export const MIN_VISITS_FOR_FLIGHT_CURVE = 3;  // Minimum visits required for GAM flight curve

// Baseline year for index normalization (all indices are normalized to this year = 100)
export const BASELINE_YEAR = 2021;

// Monitoring season definition
export const MONITORING_START_MONTH = 3;  // March (1-indexed)
export const MONITORING_END_MONTH = 9;  // September (1-indexed)

// Species-level quality criteria
export const MIN_COUNTS_PER_SPECIES = 20;  // Minimum total counts for species analysis
export const MIN_YEARS_PER_SPECIES = 3;  // Minimum years of data for species analysis

// Grassland butterfly species for GBI calculation
// Based on European Grassland Butterfly Indicator
// Source: https://www.eea.europa.eu/en/analysis/indicators/grassland-butterfly-index-in-europe-1
export const GRASSLAND_SPECIES = {
  // Widespread species (7)
  widespread: [
    "Anthocharis cardamines",
    "Coenonympha pamphilus",
    "Lasiommata megera",
    "Lycaena phlaeas",
    "Maniola jurtina",
    "Ochlodes sylvanus",
    "Polyommatus icarus",
  ],
  // Specialist species (7)
  specialist: [
    "Cupido minimus",
    "Cyaniris semiargus", // Also known as Polyommatus semiargus
    "Erynnis tages",
    "Euphydryas aurinia",
    "Lysandra bellargus",
    "Spialia sertorius",
    "Thymelicus acteon",
  ],
} as const;

export const ALL_GRASSLAND_SPECIES = [
  ...GRASSLAND_SPECIES.widespread,
  ...GRASSLAND_SPECIES.specialist,
] as const;
