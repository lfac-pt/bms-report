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

  // Recalculate butterfly frequency for filtered transects
  const butterflyFrequencyByYear: Record<number, ButterflyFrequencyData[]> = {};
  relevantYears.forEach((year) => {
    const observationsByDate = timelineData.observationsByYearDate[year] || {};

    // Get all dates that have observations from the filtered transects
    const relevantDates = new Set<string>();
    Object.entries(observationsByDate).forEach(([date, observations]) => {
      // Check if any observation on this date is from a filtered transect
      const hasFilteredTransect = observations.some(([transectId]) =>
        transectIdSet.has(transectId)
      );
      if (hasFilteredTransect) {
        relevantDates.add(date);
      }
    });

    const totalVisits = relevantDates.size;

    // Count species frequency across filtered transects and dates
    const speciesVisitsMap = new Map<string, Set<string>>();
    Object.entries(observationsByDate).forEach(([date, observations]) => {
      if (!relevantDates.has(date)) return;

      // For this date, collect species from filtered transects only
      observations.forEach(([transectId, species]) => {
        if (!transectIdSet.has(transectId)) return;

        if (!speciesVisitsMap.has(species)) {
          speciesVisitsMap.set(species, new Set());
        }
        speciesVisitsMap.get(species)!.add(date);
      });
    });

    // Calculate frequency for each species
    butterflyFrequencyByYear[year] = Array.from(speciesVisitsMap.entries())
      .map(([species, dateSet]) => ({
        species,
        frequency: (dateSet.size / totalVisits) * 100,
        visitCount: dateSet.size,
        totalVisits
      }))
      .sort((a, b) => b.frequency - a.frequency);
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
