import { FeatureCollection, MultiPolygon, Polygon } from "geojson";

export interface TimedCountSummary {
  visits: number;
  individuals: number;
  species: number;
  acceptedSpecies: number;
  pendingRecords: number;
  zeroCounts: number;
}
export interface TimedCountYear extends TimedCountSummary {
  months: TimedCountSummary[];
}
export interface TimedCountMunicipality {
  name: string;
  hasTransect: boolean;
  visitsByYear: Record<string, number[]>;
}
export interface TimedCountResults {
  years: Record<string, TimedCountYear>;
  municipalities: FeatureCollection<Polygon | MultiPolygon, TimedCountMunicipality>;
}
