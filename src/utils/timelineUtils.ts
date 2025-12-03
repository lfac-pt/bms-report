import {
  TimelineData,
  ButterflyFrequencyData,
  TransectDiversityData,
} from "../types/timelineData";
import { TransectStats } from "../types/transectStats";

export interface TransectsPerYearData {
  year: number;
  transectCount: number;
}

export interface EnrichedTransectDiversityData extends TransectDiversityData {
  transectName: string;
  concelho: string;
  distrito: string;
}

/**
 * Filter pre-processed timeline data to only include selected transects
 */
export function filterTimelineByTransects(
  timelineData: TimelineData,
  filteredTransects: TransectStats[]
): {
  years: number[];
  transectsPerYear: TransectsPerYearData[];
  butterflyFrequencyByYear: Record<number, ButterflyFrequencyData[]>;
  transectDiversityByYear: Record<number, EnrichedTransectDiversityData[]>;
} {
  const transectIdSet = new Set(filteredTransects.map((t) => t.transectId));
  const metadataMap = new Map(
    filteredTransects.map((t) => [t.transectId, t])
  );

  // Filter years to only those with matching transects
  const relevantYears = timelineData.years.filter((year) => {
    const transectsThisYear = timelineData.transectsByYear[year] || [];
    return transectsThisYear.some((id) => transectIdSet.has(id));
  });

  // Count transects per year (only filtered ones)
  const transectsPerYear = relevantYears.map((year) => {
    const transectsThisYear = timelineData.transectsByYear[year] || [];
    const filteredCount = transectsThisYear.filter((id) =>
      transectIdSet.has(id)
    ).length;
    return { year, transectCount: filteredCount };
  });

  // Filter butterfly frequency - keep data as-is for now
  // Note: This shows global frequency across all transects for the filtered years
  const butterflyFrequencyByYear: Record<number, ButterflyFrequencyData[]> =
    {};
  relevantYears.forEach((year) => {
    butterflyFrequencyByYear[year] =
      timelineData.butterflyFrequencyByYear[year] || [];
  });

  // Filter and enrich diversity data
  const transectDiversityByYear: Record<
    number,
    EnrichedTransectDiversityData[]
  > = {};
  relevantYears.forEach((year) => {
    const diversityThisYear =
      timelineData.transectDiversityByYear[year] || [];
    transectDiversityByYear[year] = diversityThisYear
      .filter((d) => transectIdSet.has(d.transectId))
      .map((d) => {
        const metadata = metadataMap.get(d.transectId);
        return {
          ...d,
          transectName: metadata?.transectName || d.transectId,
          concelho: metadata?.concelho || "N/A",
          distrito: metadata?.distrito || "N/A",
        };
      })
      .sort((a, b) => b.diversityCount - a.diversityCount)
      .slice(0, 5); // Top 5
  });

  return {
    years: relevantYears,
    transectsPerYear,
    butterflyFrequencyByYear,
    transectDiversityByYear,
  };
}
