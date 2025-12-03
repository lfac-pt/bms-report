export interface ButterflyFrequencyData {
  species: string;
  frequency: number;
  visitCount: number;
  totalVisits: number;
}

export interface TransectDiversityData {
  transectId: string;
  diversityCount: number;
  speciesList: string[];
}

export interface TimelineData {
  years: number[];
  transectsByYear: Record<number, string[]>;
  butterflyFrequencyByYear: Record<number, ButterflyFrequencyData[]>;
  transectDiversityByYear: Record<number, TransectDiversityData[]>;
  observationsByYearDate: Record<number, Record<string, [string, string][]>>; // year -> date -> [transectId, species][]
}
