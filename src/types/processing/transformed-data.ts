/**
 * Types for transformed and processed data
 */

import { Coordinates } from "./common";

export interface TransformedDataRow {
  transectId: string;
  date: string;
  year: number | null;
  month: number | null;
  species: string;
  count: number;
}

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
  tipologia: string;
  concelho: string;
  distrito: string;
  climaticRegion: string;
  responsavel: string;
  entidade: string;
  coordinates: Coordinates | null;
  protectedArea: string | null;
  length: number | null;
}

export interface TrendClassification {
  category: string;
  annualRateOfChange: number | null;
  rateOfChange: number;
  confidenceInterval: {
    lower: number | null;
    upper: number | null;
  };
  rateCI: {
    lower: number | null;
    upper: number | null;
  };
}

export interface DataQuality {
  site_count: number;
  total_visits: number;
  transectCount?: number;
  totalVisits?: number;
  [key: string]: unknown;
}

export interface SpeciesTrend {
  species: string;
  type: string;
  slope: number;
  yearsWithData: number[];
  annualIndices: Record<string, number>;
  trendLine: Record<string, number> | null;
  confidenceIntervals: Record<number, { ci_lower: number; ci_upper: number }>;
  trendClassification: TrendClassification | null;
  dataQuality: DataQuality;
  method: string;
}

export interface TransectInfo {
  transectId: string;
  transectName?: string;
  yearsActive?: number;
  avgVisitsPerYear?: number;
  isActive?: boolean;
}

export interface MSISubset {
  gbiByYear: Record<
    string,
    {
      gbi: number;
      dataQuality: DataQuality;
      [key: string]: unknown;
    }
  >;
  gbiTrend: unknown;
  years: number[];
}

export interface GBIData {
  metadata: {
    processingDate: string;
    baselineYear: number;
    qualityCriteria: {
      minYearsActive: number;
      minVisitsPerYear: number;
    };
    transectsUsed: TransectInfo[];
    [key: string]: unknown;
  };
  gbiByYear: Record<
    string,
    {
      gbi: number;
      dataQuality: DataQuality;
      [key: string]: unknown;
    }
  >;
  years: number[];
  gbiTrend: unknown;
  widespreadMSI?: MSISubset | null;
  specialistMSI?: MSISubset | null;
}

export interface FlightCurvesData {
  metadata: {
    processingDate: string;
    baselineYear: number;
    qualityCriteria: {
      minYearsActive: number;
      minVisitsPerYear: number;
      minCountsPerSpecies: number;
      minYearsPerSpecies: number;
    };
    transectsUsed: TransectInfo[];
    method: string;
  };
  species: Record<
    string,
    {
      collatedIndices: Record<string, number>;
      trendLine: Record<string, number> | null;
      phenologyCurves: Record<string, unknown> | null;
      regionalPhenologyCurves: Record<string, unknown> | null; // Regional flight curves by region
      dataQuality: DataQuality;
      processingInfo: unknown;
      confidenceIntervals: Record<number, { ci_lower: number; ci_upper: number }>;
      trendClassification: TrendClassification | null;
      ciExceedsThreshold: boolean;
      maxCIRange: number;
    }
  >;
  speciesList: string[];
  years: number[];
}

export interface RegionalPhenologyData {
  metadata: {
    processingDate: string;
    baselineYear: number;
    regions: string[];
    transectsByRegion: Record<string, number>;
    qualityCriteria: {
      minYearsActive: number;
      minVisitsPerYear: number;
      minCountsPerSpecies: number;
      minYearsPerSpecies: number;
      minTransectsPerRegion: number;
    };
    method: string;
  };
  species: Record<
    string,
    {
      regions: Record<
        string,
        {
          phenologyCurves: Record<string, unknown>;
          dataQuality: {
            transectCount: number;
            totalVisits: number;
            totalCounts: number;
          };
        }
      >;
    }
  >;
  speciesList: string[];
}

export interface TimelineData {
  years: number[];
  transectsByYear: Record<number, string[]>;
  butterflyFrequencyByYear: Record<
    number,
    {
      species: string;
      frequency: number;
      visitCount: number;
      totalVisits: number;
    }[]
  >;
  transectDiversityByYear: Record<
    number,
    {
      transectId: string;
      diversityCount: number;
      speciesList: string[];
    }[]
  >;
  observationsByYearDate: Record<number, Record<string, [string, string, number][]>>;
}
