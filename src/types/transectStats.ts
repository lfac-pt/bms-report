export interface TransectStats {
  transectId: string;
  transectCode: string;
  transectName: string;
  isActive: boolean;
  totalSpecies: number;
  totalVisits: number;
  avgVisitsPerYear: number;
  avgButterfliesPerVisit: number;
  yearsActive: number;
  firstMonitoringYear: number | null;
  speciesList: string[];
  // Additional metadata
  tipologia: string;
  concelho: string;
  responsavel: string;
  entidade: string;
}

export type TransectStatsArray = TransectStats[];
