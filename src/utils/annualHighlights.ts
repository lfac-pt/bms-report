import { VALID_SPECIES } from "../constants";
import { TimelineData } from "../types/timelineData";
import { TransectStats } from "../types/transectStats";
import endangeredPT from "./endangered_pt";

export interface AnnualSpecies {
  species: string;
  individuals: number;
  transectIds: string[];
  firstDate: string;
}

export function speciesInYear(timeline: TimelineData, year: number): AnnualSpecies[] {
  const species = new Map<
    string,
    { individuals: number; transects: Set<string>; firstDate: string }
  >();
  // DD/MM/YYYY strings must be ordered chronologically rather than lexicographically.
  const dateKey = (date: string) => date.split("/").reverse().join("-");
  Object.entries(timeline.observationsByYearDate[year] || {}).forEach(([date, observations]) => {
    observations.forEach(([id, name, count]) => {
      if (count <= 0 || !VALID_SPECIES.has(name)) return;
      const item = species.get(name) || {
        individuals: 0,
        transects: new Set<string>(),
        firstDate: date,
      };
      item.individuals += count;
      item.transects.add(id);
      if (dateKey(date) < dateKey(item.firstDate)) item.firstDate = date;
      species.set(name, item);
    });
  });
  return [...species]
    .map(([name, item]) => ({
      species: name,
      individuals: item.individuals,
      transectIds: [...item.transects],
      firstDate: item.firstDate,
    }))
    .sort((a, b) => a.species.localeCompare(b.species));
}

/** Network membership is derived from visits, including those without positive species counts. */
export function annualNetwork(timeline: TimelineData, year: number, transects: TransectStats[]) {
  const seasons = new Map<string, Set<number>>();
  Object.entries(timeline.observationsByYearDate).forEach(([yearString, dates]) => {
    const season = Number(yearString);
    if (season > year) return;
    Object.values(dates).forEach(observations =>
      observations.forEach(([id]) => {
        if (!seasons.has(id)) seasons.set(id, new Set());
        seasons.get(id)!.add(season);
      })
    );
  });
  const metadata = new Map(transects.map(transect => [transect.transectId, transect]));
  const species = new Map<string, Set<string>>();
  const visits = new Map<string, Set<string>>();
  Object.entries(timeline.observationsByYearDate[year] || {}).forEach(([date, observations]) =>
    observations.forEach(([id, name, count]) => {
      if (!visits.has(id)) visits.set(id, new Set());
      visits.get(id)!.add(date);
      if (count > 0 && VALID_SPECIES.has(name)) {
        if (!species.has(id)) species.set(id, new Set());
        species.get(id)!.add(name);
      }
    })
  );
  return [...visits]
    .map(([id, dates]) => {
      const years = [...(seasons.get(id) || [])].sort((a, b) => a - b);
      return {
        id,
        metadata: metadata.get(id),
        years,
        isNew: years[0] === year,
        isVeteran: years.length >= 5,
        visits: dates.size,
        speciesCount: species.get(id)?.size || 0,
      };
    })
    .sort(
      (a, b) => b.speciesCount - a.speciesCount || b.visits - a.visits || a.id.localeCompare(b.id)
    );
}

export type NetworkTransect = ReturnType<typeof annualNetwork>[number];

export function annualHighlights(timeline: TimelineData, year: number, transects: TransectStats[]) {
  const current = speciesInYear(timeline, year);
  const previousSpecies = new Set(
    Object.keys(timeline.observationsByYearDate)
      .filter(key => Number(key) < year)
      .flatMap(key => speciesInYear(timeline, Number(key)).map(item => item.species))
  );
  const network = annualNetwork(timeline, year, transects);
  return {
    discoveries: current.filter(item => !previousSpecies.has(item.species)),
    threatened: current.filter(item => ["VU", "EN", "CR"].includes(endangeredPT[item.species])),
    network,
    newCount: network.filter(item => item.isNew).length,
    veteranCount: network.filter(item => item.isVeteran).length,
  };
}

export function compareSpeciesOnSharedTransects(
  timeline: TimelineData,
  year: number,
  species: string
) {
  const idsInYear = (season: number) =>
    new Set(
      Object.values(timeline.observationsByYearDate[season] || {})
        .flat()
        .map(([id]) => id)
    );
  const currentIds = idsInYear(year);
  const sharedIds = new Set([...idsInYear(year - 1)].filter(id => currentIds.has(id)));
  const summarize = (season: number) => {
    const visits = new Set<string>();
    let individuals = 0;
    Object.entries(timeline.observationsByYearDate[season] || {}).forEach(([date, observations]) =>
      observations.forEach(([id, name, count]) => {
        if (!sharedIds.has(id)) return;
        visits.add(`${id}:${date}`);
        if (name === species) individuals += count;
      })
    );
    return { individuals, visits: visits.size };
  };
  return { transects: sharedIds.size, current: summarize(year), previous: summarize(year - 1) };
}

export function municipalityGaps(properties: { Concelho: string; transectCount: number }[]) {
  return properties
    .filter(item => item.transectCount === 0)
    .map(item =>
      item.Concelho.toLocaleLowerCase("pt-PT")
        .replace(
          /(^|\s)(\S)/g,
          (_, space: string, letter: string) => space + letter.toLocaleUpperCase("pt-PT")
        )
        .replace(/\b(Da|De|Do|Das|Dos)\b/g, word => word.toLowerCase())
    )
    .sort((a, b) => a.localeCompare(b, "pt-PT"));
}
