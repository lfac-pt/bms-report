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
  responsavel: string;
  entidade: string;
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
