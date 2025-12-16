/**
 * TypeScript interfaces for Grassland Butterfly Index (GBI) data
 */

/**
 * Represents a grassland butterfly species with its type classification
 */
export interface GrasslandSpecies {
  scientificName: string;
  type: "widespread" | "specialist";
}

/**
 * Quality criteria used for filtering transects in GBI calculation
 */
export interface QualityCriteria {
  minYearsActive: number;
  minVisitsPerYear: number;
}

/**
 * Transect information for GBI
 */
export interface TransectInfo {
  transectId: string;
  transectName: string;
}

/**
 * Confidence interval metadata
 */
export interface ConfidenceIntervalMetadata {
  method: "species_bootstrap";
  nIterations: number;
  confidenceLevel: number;
}

/**
 * Metadata about the GBI calculation
 */
export interface GBIMetadata {
  baselineYear: number;
  grasslandSpecies: GrasslandSpecies[];
  qualityCriteria: QualityCriteria;
  transectsUsed: TransectInfo[];
  calculationMethod: string;
  confidenceInterval?: ConfidenceIntervalMetadata;
}

/**
 * Data quality metrics for a specific year
 */
export interface DataQuality {
  transectCount: number;
  totalVisits: number;
  speciesWithData: number;
}

/**
 * GBI data for a single year
 */
export interface YearlyGBI {
  year: number;
  gbiValue: number;
  ci_lower: number | null;
  ci_upper: number | null;
  speciesIndices: Record<string, number>;
  dataQuality: DataQuality;
}

/**
 * Species trend data including slope and annual indices
 */
export interface SpeciesTrend {
  species: string;
  type: "widespread" | "specialist";
  slope: number;
  yearsWithData: number[];
  annualIndices: Record<number, number>;
  confidenceIntervals?: Record<number, { ci_lower: number | null; ci_upper: number | null }>;
}

/**
 * Complete GBI dataset structure
 */
export interface GBIData {
  metadata: GBIMetadata;
  gbiByYear: Record<number, YearlyGBI>;
  speciesTrends: Record<string, SpeciesTrend>;
  years: number[];
}
