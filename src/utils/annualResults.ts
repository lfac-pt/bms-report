import { TimelineData } from "../types/timelineData";
import { VALID_SPECIES } from "../constants";

export const RESULTS_YEAR = 2026;
export const WAVE_SPECIES = "Vanessa cardui";
export const MONTH_NAMES = ["Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set"];

export function summarizeYear(timeline: TimelineData, year: number) {
  const dates = timeline.observationsByYearDate[year];
  if (!dates || Object.keys(dates).length === 0) return null;
  const species = new Set<string>();
  const transects = new Set<string>();
  const visits = new Set<string>();
  let individuals = 0;
  Object.entries(dates).forEach(([date, observations]) => {
    observations.forEach(([id, name, count]) => {
      transects.add(id);
      visits.add(`${id}:${date}`);
      if (count > 0 && VALID_SPECIES.has(name)) species.add(name);
      individuals += count;
    });
  });
  return { species: species.size, individuals, visits: visits.size, transects: transects.size };
}

// Keep the original timeline structure so the existing species-map calculations can be reused.
export function timelineForMonth(
  timeline: TimelineData,
  year: number,
  month: number
): TimelineData {
  return {
    ...timeline,
    observationsByYearDate: {
      [year]: Object.fromEntries(
        Object.entries(timeline.observationsByYearDate[year] || {}).filter(
          ([date]) => Number(date.split("/")[1]) === month
        )
      ),
    },
  };
}

export function monthlySpeciesAbundance(
  timeline: TimelineData,
  year: number,
  speciesName = WAVE_SPECIES
): number[] {
  return MONTH_NAMES.map((_, index) =>
    Object.values(timelineForMonth(timeline, year, index + 3).observationsByYearDate[year])
      .flat()
      .reduce((sum, [, species, count]) => sum + (species === speciesName ? count : 0), 0)
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Seven-day observation windows covering March through September, inclusive. */
export function monitoringWeeks(year: number) {
  const seasonEnd = Date.UTC(year, 8, 30);
  const weeks = [];
  for (let start = Date.UTC(year, 2, 1); start <= seasonEnd; start += 7 * DAY_MS) {
    const end = Math.min(start + 6 * DAY_MS, seasonEnd);
    const format = (date: number) =>
      new Date(date).toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "UTC",
      });
    weeks.push({ start, end, label: `${format(start)} – ${format(end)}` });
  }
  return weeks;
}

export function timelineForWeek(
  timeline: TimelineData,
  year: number,
  weekIndex: number
): TimelineData {
  const week = monitoringWeeks(year)[weekIndex];
  return {
    ...timeline,
    observationsByYearDate: {
      [year]: Object.fromEntries(
        Object.entries(timeline.observationsByYearDate[year] || {}).filter(([date]) => {
          const [day, month, dateYear] = date.split("/").map(Number);
          const timestamp = Date.UTC(dateYear, month - 1, day);
          return week && timestamp >= week.start && timestamp <= week.end;
        })
      ),
    },
  };
}

/** Count effort across all observations, including visits without the focal species. */
export function summarizeSpeciesPeriod(
  timeline: TimelineData,
  year: number,
  speciesName = WAVE_SPECIES
) {
  const visited = new Set<string>();
  const visits = new Set<string>();
  const counts = new Map<string, number>();
  let individuals = 0;
  Object.entries(timeline.observationsByYearDate[year] || {}).forEach(([date, observations]) => {
    observations.forEach(([id, species, count]) => {
      visited.add(id);
      visits.add(`${id}:${date}`);
      if (species === speciesName) {
        counts.set(id, (counts.get(id) || 0) + count);
        individuals += count;
      }
    });
  });
  return { visited, visits: visits.size, counts, individuals };
}

/** Apply the same transect eligibility as the processed mainland overview to every year. */
export function mainlandResultsTimeline(
  timeline: TimelineData,
  transectIds: Set<string>
): TimelineData {
  const observationsByYearDate: TimelineData["observationsByYearDate"] = {};
  const transectsByYear: TimelineData["transectsByYear"] = {};
  const butterflyFrequencyByYear: TimelineData["butterflyFrequencyByYear"] = {};
  const transectDiversityByYear: TimelineData["transectDiversityByYear"] = {};

  for (const [yearString, dates] of Object.entries(timeline.observationsByYearDate)) {
    const year = Number(yearString);
    const filteredDates = Object.fromEntries(
      Object.entries(dates)
        .map(
          ([date, observations]) =>
            [date, observations.filter(([id]) => transectIds.has(id))] as const
        )
        .filter(([, observations]) => observations.length > 0)
    );
    if (!Object.keys(filteredDates).length) continue;
    observationsByYearDate[year] = filteredDates;
    const ids = new Set<string>();
    const speciesDates = new Map<string, Set<string>>();
    const transectSpecies = new Map<string, Set<string>>();
    Object.entries(filteredDates).forEach(([date, observations]) =>
      observations.forEach(([id, species, count]) => {
        ids.add(id);
        if (count <= 0 || !VALID_SPECIES.has(species)) return;
        if (!speciesDates.has(species)) speciesDates.set(species, new Set());
        speciesDates.get(species)!.add(date);
        if (!transectSpecies.has(id)) transectSpecies.set(id, new Set());
        transectSpecies.get(id)!.add(species);
      })
    );
    transectsByYear[year] = [...ids];
    const totalVisits = Object.keys(filteredDates).length;
    // Preserve the timeline's existing date-based frequency convention.
    butterflyFrequencyByYear[year] = [...speciesDates]
      .map(([species, visits]) => ({
        species,
        frequency: (visits.size / totalVisits) * 100,
        visitCount: visits.size,
        totalVisits,
      }))
      .sort((a, b) => b.frequency - a.frequency);
    transectDiversityByYear[year] = [...transectSpecies]
      .map(([transectId, species]) => ({
        transectId,
        diversityCount: species.size,
        speciesList: [...species].sort(),
      }))
      .sort((a, b) => b.diversityCount - a.diversityCount);
  }
  return {
    years: Object.keys(observationsByYearDate)
      .map(Number)
      .sort((a, b) => a - b),
    observationsByYearDate,
    transectsByYear,
    butterflyFrequencyByYear,
    transectDiversityByYear,
  };
}
