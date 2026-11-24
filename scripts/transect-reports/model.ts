import { VALID_SPECIES } from "../../src/constants";
import endangeredPT from "../../src/utils/endangered_pt";
import { SPECIES_NAME_CORRECTIONS } from "../config/species-corrections";

export type Row = Record<string, string>;
const DAY = 86400000;

/** Count the full registered network, including routes without visits in the report year. */
export function countTransectsInMunicipality(metadata: Row[], municipality: string): number | null {
  const key = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("pt-PT");
  const target = key(municipality);
  if (!target) return null;
  const ids = new Set(
    metadata
      .filter(
        row =>
          ["Válido", "Novo"].includes((row["Situação"] || "").trim()) &&
          key(row.Concelho || "") === target
      )
      .map(row => row["Transect ID"]?.trim())
      .filter(Boolean)
  );
  return ids.size || null;
}

/** Strict UTC parsing avoids rollover dates and daylight-saving errors in visit gaps. */
export function parseDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}; expected DD/MM/YYYY`);
  const [, d, m, y] = match;
  const iso = `${y}-${m}-${d}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Invalid date: ${value}`);
  }
  return iso;
}

export function daysBetween(a: string, b: string): number {
  return (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY;
}

export interface SeasonWindow {
  start: string;
  end: string;
}

export function seasonBounds(year: number, window: SeasonWindow): [string, string] {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) throw new Error("Invalid year");
  const bounds = [window.start, window.end].map(value => {
    if (!/^\d{2}-\d{2}$/.test(value)) throw new Error("Season bounds must use MM-DD");
    const [month, day] = value.split("-");
    return parseDate(`${day}/${month}/${year}`);
  });
  if (bounds[0] > bounds[1]) throw new Error("Season start must be on or before season end");
  return bounds as [string, string];
}

export interface Observation {
  transectId: string;
  date: string;
  sampleId: string;
  species: string;
  count: number;
  status: string;
}

export interface ParsedData {
  observations: Observation[];
  duplicates: number;
  missingTransectRows: number;
}

export function parseObservations(rows: Row[]): ParsedData {
  const occurrences = new Map<string, string>();
  const observations: Observation[] = [];
  let duplicates = 0;
  let missingTransectRows = 0;
  for (const [index, row] of rows.entries()) {
    const transectId = row["Transect ID"]?.trim();
    if (!transectId) {
      missingTransectRows++;
      continue;
    }
    const date = parseDate(row.Date?.trim() || "");
    const rawCount = row["Abundance Count"]?.trim() || "";
    const count = Number(rawCount);
    if (!rawCount || !Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Observation row ${index + 2}: invalid Abundance Count`);
    }
    const entered = row["Preferred Species Name"]?.trim() || "";
    const observation = {
      transectId,
      date,
      sampleId: row["Transect Sample ID"]?.trim() || "",
      species: SPECIES_NAME_CORRECTIONS[entered] || entered,
      count,
      status: row["Record status"]?.trim() || "Unknown",
    };
    const occurrenceId = row["Occurrence ID"]?.trim();
    if (occurrenceId) {
      // Include section data so conflicting duplicated occurrence IDs cannot silently change totals.
      const signature = JSON.stringify([
        observation,
        row["Section Sample ID"],
        row["Section Code"],
      ]);
      const previous = occurrences.get(occurrenceId);
      if (previous !== undefined) {
        if (previous !== signature) throw new Error(`Conflicting Occurrence ID: ${occurrenceId}`);
        duplicates++;
        continue;
      }
      occurrences.set(occurrenceId, signature);
    }
    observations.push(observation);
  }
  return { observations, duplicates, missingTransectRows };
}

export interface Visit {
  transectId: string;
  date: string;
  sampleId: string;
  recordedBy?: string;
}

export function parseVisits(rows: Row[]): Visit[] {
  return rows.map((row, index) => {
    if (!row["Transect ID"]?.trim()) throw new Error(`Visit row ${index + 2}: missing Transect ID`);
    return {
      transectId: row["Transect ID"].trim(),
      date: parseDate(row.Date?.trim() || ""),
      sampleId: row["Transect Sample ID"]?.trim() || "",
      recordedBy: row["Recorded by"]?.trim(),
    };
  });
}

function recorderName(label: string): string {
  // The export uses "surname, given name" for individual accounts.
  const person = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;
  const parts = label.split(",").map(part => part.trim());
  if (
    parts.length === 2 &&
    parts.every(part => person.test(part) && !part.includes(" - ") && !/\s+e\s+/i.test(part))
  ) {
    return `${parts[1]} ${parts[0]}`;
  }
  return label;
}

export interface SpeciesSummary {
  name: string;
  individuals: number;
  visits: number;
  firstDate: string;
  lastDate: string;
  isNew: boolean;
  statusPT: string | null;
  weeklyMean: (number | null)[];
}

export interface WeeklyBin {
  start: string;
  end: string;
  visits: number;
}

export interface SeasonSummary {
  year: number;
  visits: number;
  dates: string[];
  individuals: number;
  speciesCount: number;
  meanPerVisit: number | null;
}

export interface Gap {
  from: string;
  to: string;
  days: number;
  kind: "between" | "start" | "end" | "whole-season";
}

export interface TransectReport {
  id: string;
  code: string;
  name: string;
  municipality: string;
  municipalityTransectCount: number | null;
  owner: string;
  volunteers: string[];
  entity: string;
  window: SeasonWindow;
  current: SeasonSummary;
  history: SeasonSummary[];
  species: SpeciesSummary[];
  weekly: WeeklyBin[];
  firstSeason: boolean;
  gaps: Gap[];
  monthly: { month: string; visits: number; mean: number | null; species: number }[];
  peak: { date: string; individuals: number } | null;
  quality: {
    pendingRecords: number;
    rejectedRecords: number;
    unidentifiedIndividuals: number;
    outOfWindowVisits: number;
    dateFallbacks: number;
    acceptedOnly: boolean;
    supplementalVisits: boolean;
  };
}

export function buildReport(
  metadata: Row,
  allObservations: Observation[],
  supplemental: Visit[],
  year: number,
  window: SeasonWindow,
  acceptedOnly = false,
  hasVisitFile = false,
  municipalityTransectCount: number | null = null
): TransectReport {
  const id = metadata["Transect ID"].trim();
  const observations = allObservations.filter(row => row.transectId === id);
  const supplementalVisits = supplemental.filter(row => row.transectId === id);
  const inputVisits = [...observations, ...supplementalVisits];
  const sampleDates = new Map<string, string>();
  const dateSamples = new Map<string, Set<string>>();
  for (const visit of inputVisits) {
    if (!visit.sampleId) continue;
    const previous = sampleDates.get(visit.sampleId);
    if (previous && previous !== visit.date)
      throw new Error(`Sample ${visit.sampleId} has conflicting dates`);
    sampleDates.set(visit.sampleId, visit.date);
    if (!dateSamples.has(visit.date)) dateSamples.set(visit.date, new Set());
    dateSamples.get(visit.date)!.add(visit.sampleId);
  }
  // An ID-less row on a date with one known visit belongs to that visit. Never invent an extra visit.
  const visitKey = (visit: Visit) => {
    if (visit.sampleId) return `id:${visit.sampleId}`;
    const samples = [...(dateSamples.get(visit.date) || [])];
    if (samples.length > 1)
      throw new Error(`Ambiguous ID-less visit on ${visit.date} at transect ${id}`);
    return samples.length ? `id:${samples[0]}` : `date:${visit.date}`;
  };
  const uniqueVisits = new Map(inputVisits.map(visit => [visitKey(visit), visit]));
  const boundsByYear = new Map<number, [string, string]>();
  const inSeason = (date: string, season: number) => {
    let bounds = boundsByYear.get(season);
    if (!bounds) {
      bounds = seasonBounds(season, window);
      boundsByYear.set(season, bounds);
    }
    const [start, end] = bounds;
    return date >= start && date <= end;
  };
  const included = (row: Observation) =>
    row.status.toLowerCase() !== "rejected" &&
    (!acceptedOnly || row.status.toLowerCase() === "accepted");
  const valid = (row: Observation) =>
    included(row) && VALID_SPECIES.has(row.species) && row.count > 0;
  const summarize = (season: number): SeasonSummary => {
    const visits = [...uniqueVisits.values()].filter(row => inSeason(row.date, season));
    const records = observations.filter(row => inSeason(row.date, season) && valid(row));
    const individuals = records.reduce((sum, row) => sum + row.count, 0);
    return {
      year: season,
      visits: visits.length,
      dates: [...new Set(visits.map(row => row.date))].sort(),
      individuals,
      speciesCount: new Set(records.map(row => row.species)).size,
      meanPerVisit: visits.length ? individuals / visits.length : null,
    };
  };
  const [start, end] = seasonBounds(year, window);
  const credited = (metadata["Voluntários"]?.trim() || metadata["Responsável"] || "").split(
    /[;\n]/
  );
  const recorded = supplementalVisits
    .filter(visit => inSeason(visit.date, year))
    .flatMap(visit => visit.recordedBy?.split(/[;\n]/) ?? [])
    .map(label => recorderName(label.trim()));
  const volunteers = new Map<string, string>();
  for (const label of [...credited, ...recorded]) {
    const name = label.trim().replace(/\s+/g, " ");
    const key = name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\.$/, "")
      .toLocaleLowerCase("pt-PT");
    if (key && !volunteers.has(key)) volunteers.set(key, name);
  }
  const historyYears = [...new Set(inputVisits.map(row => Number(row.date.slice(0, 4))))]
    .filter(season => season < year)
    .sort((a, b) => a - b);
  const history = historyYears.map(summarize).filter(season => season.visits > 0);
  const previousSpecies = new Set(
    observations.filter(row => row.date < `${year}-01-01` && valid(row)).map(row => row.species)
  );
  const current = summarize(year);
  const currentRecords = observations.filter(row => inSeason(row.date, year));
  const seasonVisits = [...uniqueVisits.values()].filter(row => inSeason(row.date, year));
  const weekly: WeeklyBin[] = [];
  for (
    let day = Date.parse(`${start}T00:00:00Z`);
    day <= Date.parse(`${end}T00:00:00Z`);
    day += 7 * DAY
  ) {
    const binStart = new Date(day).toISOString().slice(0, 10);
    const binEnd = new Date(Math.min(day + 6 * DAY, Date.parse(`${end}T00:00:00Z`)))
      .toISOString()
      .slice(0, 10);
    weekly.push({
      start: binStart,
      end: binEnd,
      visits: seasonVisits.filter(visit => visit.date >= binStart && visit.date <= binEnd).length,
    });
  }
  const speciesMap = new Map<string, { rows: Observation[]; visits: Set<string> }>();
  for (const row of currentRecords.filter(valid)) {
    const item = speciesMap.get(row.species) || { rows: [], visits: new Set<string>() };
    item.rows.push(row);
    item.visits.add(visitKey(row));
    speciesMap.set(row.species, item);
  }
  const firstSeason = !inputVisits.some(row => row.date < `${year}-01-01`);
  const species = [...speciesMap]
    .map(([name, item]) => {
      const dates = item.rows.map(row => row.date).sort();
      return {
        name,
        individuals: item.rows.reduce((sum, row) => sum + row.count, 0),
        visits: item.visits.size,
        firstDate: dates[0],
        lastDate: dates[dates.length - 1],
        isNew: !firstSeason && !previousSpecies.has(name),
        statusPT: endangeredPT[name] || null,
        weeklyMean: weekly.map(bin =>
          bin.visits
            ? item.rows
                .filter(row => row.date >= bin.start && row.date <= bin.end)
                .reduce((sum, row) => sum + row.count, 0) / bin.visits
            : null
        ),
      };
    })
    .sort((a, b) => b.individuals - a.individuals || a.name.localeCompare(b.name, "pt"));
  const gaps: Gap[] = [];
  const addGap = (from: string, to: string, kind: Gap["kind"]) => {
    const days = daysBetween(from, to);
    if (days > 14) gaps.push({ from, to, days, kind });
  };
  if (!current.dates.length) addGap(start, end, "whole-season");
  else {
    addGap(start, current.dates[0], "start");
    current.dates.slice(1).forEach((date, index) => addGap(current.dates[index], date, "between"));
    addGap(current.dates[current.dates.length - 1], end, "end");
  }
  const monthly = [];
  for (
    let month = Number(window.start.slice(0, 2));
    month <= Number(window.end.slice(0, 2));
    month++
  ) {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const visits = [...uniqueVisits.values()].filter(
      row => row.date.startsWith(prefix) && inSeason(row.date, year)
    );
    const records = currentRecords.filter(row => row.date.startsWith(prefix) && valid(row));
    monthly.push({
      month: prefix,
      visits: visits.length,
      mean: visits.length ? records.reduce((sum, row) => sum + row.count, 0) / visits.length : null,
      species: new Set(records.map(row => row.species)).size,
    });
  }
  const daily = current.dates
    .map(date => ({
      date,
      individuals: currentRecords
        .filter(row => row.date === date && valid(row))
        .reduce((sum, row) => sum + row.count, 0),
    }))
    .sort((a, b) => b.individuals - a.individuals || a.date.localeCompare(b.date));
  const currentVisits = [...uniqueVisits.entries()].filter(([, visit]) =>
    inSeason(visit.date, year)
  );
  return {
    id,
    code: metadata["Transect Code"] || id,
    name: metadata["Transect Name"] || id,
    municipality: metadata.Concelho || "",
    municipalityTransectCount,
    owner: metadata["Responsável"] || "",
    volunteers: [...volunteers.values()],
    entity: metadata.Entidade || "",
    window,
    current,
    history,
    species,
    weekly,
    firstSeason,
    gaps,
    monthly,
    peak: daily[0] || null,
    quality: {
      pendingRecords: currentRecords.filter(
        row => !["accepted", "rejected"].includes(row.status.toLowerCase())
      ).length,
      rejectedRecords: currentRecords.filter(row => row.status.toLowerCase() === "rejected").length,
      unidentifiedIndividuals: currentRecords
        .filter(row => included(row) && !VALID_SPECIES.has(row.species))
        .reduce((sum, row) => sum + row.count, 0),
      outOfWindowVisits: [...uniqueVisits.values()].filter(
        row => row.date.startsWith(`${year}-`) && !inSeason(row.date, year)
      ).length,
      dateFallbacks: currentVisits.filter(([key]) => key.startsWith("date:")).length,
      acceptedOnly,
      supplementalVisits: hasVisitFile,
    },
  };
}
