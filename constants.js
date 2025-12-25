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
const MIN_YEARS_ACTIVE = 5;  // Minimum number of years a transect must be active
const MIN_VISITS_PER_YEAR = 5;  // Minimum average visits per year

// R-specific quality criteria (used in rbms-collated-index.R)
const MIN_VISITS_FOR_FLIGHT_CURVE = 3;  // Minimum visits required for GAM flight curve

// Baseline year for index normalization (all indices are normalized to this year = 100)
const BASELINE_YEAR = 2021;

// Monitoring season definition
const MONITORING_START_MONTH = 3;  // March (1-indexed)
const MONITORING_END_MONTH = 9;  // September (1-indexed)

// Species-level quality criteria
const MIN_COUNTS_PER_SPECIES = 20;  // Minimum total counts for species analysis
const MIN_YEARS_PER_SPECIES = 3;  // Minimum years of data for species analysis

// Grassland butterfly species for GBI calculation
// Based on European Grassland Butterfly Indicator
// Source: https://www.eea.europa.eu/en/analysis/indicators/grassland-butterfly-index-in-europe-1
const GRASSLAND_SPECIES = {
  // Widespread species (7)
  widespread: new Set([
    'Anthocharis cardamines',
    'Coenonympha pamphilus',
    'Lasiommata megera',
    'Lycaena phlaeas',
    'Maniola jurtina',
    'Ochlodes sylvanus',
    'Polyommatus icarus',
  ]),
  // Specialist species (7)
  specialist: new Set([
    'Cupido minimus',
    'Cyaniris semiargus', // Also known as Polyommatus semiargus
    'Erynnis tages',
    'Euphydryas aurinia',
    'Lysandra bellargus',
    'Spialia sertorius',
    'Thymelicus acteon',
  ])
};

// Get all grassland species as a single set
const ALL_GRASSLAND_SPECIES = new Set([
  ...GRASSLAND_SPECIES.widespread,
  ...GRASSLAND_SPECIES.specialist
]);

// For CommonJS (Node.js scripts)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MIN_YEARS_ACTIVE,
    MIN_VISITS_PER_YEAR,
    MIN_VISITS_FOR_FLIGHT_CURVE,
    BASELINE_YEAR,
    MONITORING_START_MONTH,
    MONITORING_END_MONTH,
    MIN_COUNTS_PER_SPECIES,
    MIN_YEARS_PER_SPECIES,
    GRASSLAND_SPECIES,
    ALL_GRASSLAND_SPECIES,
  };
}

// For ES modules (TypeScript/React)
export {
  MIN_YEARS_ACTIVE,
  MIN_VISITS_PER_YEAR,
  MIN_VISITS_FOR_FLIGHT_CURVE,
  BASELINE_YEAR,
  MONITORING_START_MONTH,
  MONITORING_END_MONTH,
  MIN_COUNTS_PER_SPECIES,
  MIN_YEARS_PER_SPECIES,
  GRASSLAND_SPECIES,
  ALL_GRASSLAND_SPECIES,
};
