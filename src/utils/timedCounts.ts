import { isAnnualSpecies } from "./annualResults";
import { TimedCountYear } from "../types/timedCounts";

type ExportRow = Record<string, string>;
export interface LocatedTimedVisit {
  visit: ExportRow;
  municipality: string;
}

/** Unique samples are visits, including explicit butterfly surveys with zero sightings. */
export function summarizeTimedCounts(
  located: LocatedTimedVisit[],
  observations: ExportRow[],
  year: number
) {
  const byVisit = new Map<string, ExportRow[]>();
  for (const row of observations) {
    const id = row["Visit Sample ID"];
    const existing = byVisit.get(id) || [];
    existing.push(row);
    byVisit.set(id, existing);
  }
  const periods = Array.from({ length: 8 }, () => ({
    visits: 0,
    individuals: 0,
    species: new Set<string>(),
    accepted: new Set<string>(),
    pendingRecords: 0,
    zeroCounts: 0,
  }));
  const municipalities: Record<string, number[]> = {};
  const seen = new Set<string>();
  for (const { visit, municipality } of located) {
    const id = visit["Visit Sample ID"];
    const [day, month, dateYear] = (visit.Date || "").split("/").map(Number);
    if (
      !id ||
      seen.has(id) ||
      !municipality ||
      dateYear !== year ||
      !Number.isInteger(month) ||
      month < 3 ||
      month > 9 ||
      !day ||
      visit["Private Sample?"] !== "false"
    )
      continue;
    const rows = byVisit.get(id) || [];
    const groups = visit["Species groups"] || "";
    const butterflySurvey =
      groups
        .split(";")
        .map(group => group.trim())
        .includes("Butterflies") ||
      (!groups && rows.some(row => row["Taxon group"] === "insect - butterfly"));
    if (!butterflySurvey) continue;
    seen.add(id);
    const monthly = (municipalities[municipality] ||= Array(7).fill(0));
    monthly[month - 3]++;
    let total = 0;
    for (const row of rows) {
      const count = Number(row.Count);
      if (
        row["Private Sample?"] !== "false" ||
        row["Taxon group"] !== "insect - butterfly" ||
        !["Adult", ""].includes(row.Stage || "") ||
        !["Accepted", "Unconfirmed"].includes(row["Record status"]) ||
        !Number.isFinite(count) ||
        count <= 0
      )
        continue;
      total += count;
      const species = row["Accepted species name"];
      for (const period of [periods[0], periods[month - 2]]) {
        period.individuals += count;
        if (row["Record status"] === "Unconfirmed") period.pendingRecords++;
        if (isAnnualSpecies(species)) {
          period.species.add(species);
          if (row["Record status"] === "Accepted") period.accepted.add(species);
        }
      }
    }
    for (const period of [periods[0], periods[month - 2]]) {
      period.visits++;
      if (!total) period.zeroCounts++;
    }
  }
  const summaries = periods.map(period => ({
    visits: period.visits,
    individuals: period.individuals,
    species: period.species.size,
    acceptedSpecies: period.accepted.size,
    pendingRecords: period.pendingRecords,
    zeroCounts: period.zeroCounts,
  }));
  const summary: TimedCountYear = { ...summaries[0], months: summaries.slice(1) };
  return { summary, municipalities };
}
