/**
 * Common types for data processing
 */

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Location {
  concelho: string;
  distrito: string;
}

export interface GeocodeCache {
  [key: string]: Location;
}

export interface SpeciesCorrection {
  from: string;
  to: string;
  count: number;
}

export interface FilteredSpeciesData {
  recordCount: number;
  totalIndividuals: number;
}
