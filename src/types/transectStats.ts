export interface TransectStats {
  transectId: string;
  transectCode: string;
  transectName: string;
  isActive: boolean;
  totalSpecies: number;
  totalVisits: number;
  totalAbundance: number;
  avgVisitsPerYear: number;
  avgButterfliesPerVisit: number;
  yearsActive: number;
  firstMonitoringYear: number | null;
  lastMonitoringYear: number | null;
  speciesList: string[];
  // Additional metadata
  tipologia: string;
  concelho: string;
  distrito: string;
  climaticRegion: string;
  responsavel: string;
  entidade: string;
  // Fuzzy coordinates for privacy (approximate location)
  coordinates: { lat: number; lon: number } | null;
  // Protected area (if transect is inside one)
  protectedArea: string | null;
  // Rede Natura 2000 site (if transect is inside one)
  redeNatura2000Site: string | null;
  // Transect length in meters
  length: number | null;
}

export interface FilteredSpeciesEntry {
  species: string;
  recordCount: number;
  totalIndividuals: number;
}

export interface SpeciesCorrection {
  from: string;
  to: string;
  count: number;
}

export interface ProcessingMetadata {
  totalValidTransects: number;
  activeTransects: number;
  inactiveTransects: number;
  filteredSpeciesCount: number;
  filteredSpecies: FilteredSpeciesEntry[];
  totalButterfliesValidSpecies: number;
  totalButterfliesAllSpecies: number;
  correctedRecords?: number;
  corrections?: SpeciesCorrection[];
}

export interface TransectData {
  transects: TransectStats[];
  metadata: ProcessingMetadata;
}

export type TransectStatsArray = TransectStats[];
