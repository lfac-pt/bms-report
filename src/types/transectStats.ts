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
  responsavel: string;
  entidade: string;
  // Fuzzy coordinates for privacy (approximate location)
  coordinates: { lat: number; lon: number } | null;
}

export interface ProcessingMetadata {
  totalValidTransects: number;
  activeTransects: number;
  inactiveTransects: number;
  filteredSpeciesCount: number;
  filteredSpecies: string[];
}

export interface TransectData {
  transects: TransectStats[];
  metadata: ProcessingMetadata;
}

export type TransectStatsArray = TransectStats[];
