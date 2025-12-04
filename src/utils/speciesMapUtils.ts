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
    observations.forEach(([transectId]) => {
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
  // Note: observationsByDate contains [transectId, species] pairs
  // We need to calculate abundance from the original data
  // For now, we'll track visits where species was seen
  const speciesVisitsByTransect = new Map<string, Set<string>>();

  Object.entries(observationsByDate).forEach(([date, observations]) => {
    observations.forEach(([transectId, species]) => {
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
