import { TimelineData } from "../types/timelineData";
import { TransectStats } from "../types/transectStats";

export interface SpeciesTransectData {
  transectId: string;
  transectName: string;
  hasSpecies: boolean;
  averageAbundance: number; // Average abundance per visit for this species
  visitCount: number; // Number of visits where species was seen
  totalVisits: number; // Total visits to this transect this year
  lat: number;
  lon: number;
}

export interface MonthlyAbundance {
  month: number;
  monthName: string;
  averageAbundance: number;
  visitCount: number;
}

/**
 * Calculate species presence and abundance per transect for a given year
 */
export function calculateSpeciesPresenceByYear(
  speciesName: string,
  year: number,
  timelineData: TimelineData,
  transects: TransectStats[]
): SpeciesTransectData[] {
  const observationsByDate = timelineData.observationsByYearDate[year] || {};
  const transectsThisYear = new Set(timelineData.transectsByYear[year] || []);

  // Create a map to store data per transect
  const transectDataMap = new Map<string, {
    hasSpecies: boolean;
    totalAbundance: number;
    visitCount: number;
    totalVisits: number;
  }>();

  // Initialize all transects that were active this year
  transectsThisYear.forEach(transectId => {
    transectDataMap.set(transectId, {
      hasSpecies: false,
      totalAbundance: 0,
      visitCount: 0,
      totalVisits: 0,
    });
  });

  // Count total visits per transect
  const transectVisits = new Map<string, Set<string>>();
  Object.entries(observationsByDate).forEach(([date, observations]) => {
    observations.forEach(([transectId, , ]) => {
      if (!transectVisits.has(transectId)) {
        transectVisits.set(transectId, new Set());
      }
      transectVisits.get(transectId)!.add(date);
    });
  });

  // Set total visits for each transect
  transectVisits.forEach((dates, transectId) => {
    const data = transectDataMap.get(transectId);
    if (data) {
      data.totalVisits = dates.size;
    }
  });

  // Process observations to find species presence and count abundance
  // observationsByDate contains [transectId, species, abundance] tuples
  const speciesVisitsByTransect = new Map<string, Set<string>>();

  Object.entries(observationsByDate).forEach(([date, observations]) => {
    observations.forEach(([transectId, species, ]) => {
      if (species === speciesName) {
        const data = transectDataMap.get(transectId);
        if (data) {
          data.hasSpecies = true;
        }

        if (!speciesVisitsByTransect.has(transectId)) {
          speciesVisitsByTransect.set(transectId, new Set());
        }
        speciesVisitsByTransect.get(transectId)!.add(date);
      }
    });
  });

  // Set visit counts where species was seen
  speciesVisitsByTransect.forEach((dates, transectId) => {
    const data = transectDataMap.get(transectId);
    if (data) {
      data.visitCount = dates.size;
    }
  });

  // Convert to array with transect metadata
  const transectMap = new Map(transects.map(t => [t.transectId, t]));

  return Array.from(transectDataMap.entries())
    .map(([transectId, data]) => {
      const transect = transectMap.get(transectId);
      if (!transect || !transect.coordinates) {
        return null;
      }

      // Calculate average abundance (for now, we'll use visit frequency as a proxy)
      // A better approach would be to process actual abundance counts from raw data
      const averageAbundance = data.totalVisits > 0
        ? (data.visitCount / data.totalVisits) * 10 // Scale to make circles visible
        : 0;

      return {
        transectId,
        transectName: transect.transectName,
        hasSpecies: data.hasSpecies,
        averageAbundance,
        visitCount: data.visitCount,
        totalVisits: data.totalVisits,
        lat: transect.coordinates.lat,
        lon: transect.coordinates.lon,
      };
    })
    .filter((item): item is SpeciesTransectData => item !== null);
}

/**
 * Calculate monthly average abundance for a species at a specific transect
 */
export function calculateMonthlyAbundance(
  speciesName: string,
  transectId: string,
  year: number,
  timelineData: TimelineData
): MonthlyAbundance[] {
  const observationsByDate = timelineData.observationsByYearDate[year] || {};

  const monthNames = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  // Initialize monthly data for all months
  const monthlyData: Record<number, { totalAbundance: number; visitCount: number }> = {};
  for (let month = 1; month <= 12; month++) {
    monthlyData[month] = { totalAbundance: 0, visitCount: 0 };
  }

  // Process observations
  Object.entries(observationsByDate).forEach(([date, observations]) => {
    // Parse date DD/MM/YYYY
    const parts = date.split('/');
    if (parts.length !== 3) return;
    const month = parseInt(parts[1], 10);

    // Check if this transect was visited on this date
    let transectVisited = false;
    let speciesAbundance = 0;

    observations.forEach(([obsTransectId, species, abundance]) => {
      if (obsTransectId === transectId) {
        transectVisited = true;
        if (species === speciesName) {
          speciesAbundance += abundance;
        }
      }
    });

    // If transect was visited, count it (even if species abundance is 0)
    if (transectVisited) {
      monthlyData[month].totalAbundance += speciesAbundance;
      monthlyData[month].visitCount += 1;
    }
  });

  // Calculate averages
  return Object.entries(monthlyData)
    .map(([monthStr, data]) => {
      const month = parseInt(monthStr, 10);
      return {
        month,
        monthName: monthNames[month - 1],
        averageAbundance: data.visitCount > 0 ? data.totalAbundance / data.visitCount : 0,
        visitCount: data.visitCount,
      };
    })
    .filter(m => m.visitCount > 0); // Only include months with visits
}
