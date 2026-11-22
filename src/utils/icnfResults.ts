import { TimelineData } from "../types/timelineData";
import { AnnualTransect } from "../data/madeiraTransects";
import { annualHighlights, annualNetwork } from "./annualHighlights";
import { scopeResultsTimeline, summarizeYear } from "./annualResults";

export function icnfIdentification(transect: AnnualTransect): "entity" | "name" | null {
  const entity = transect.entidade.trim().toUpperCase();
  if (entity === "ICNF") return "entity";
  // Use the name only when institutional metadata is missing, never overrule another entity.
  if (["", "#N/A", "N/A"].includes(entity) && /\bICNF\b/i.test(transect.transectName))
    return "name";
  return null;
}

export function icnfResults(timeline: TimelineData, transects: AnnualTransect[], year: number) {
  const metadata = transects.filter(transect => icnfIdentification(transect));
  const scoped = scopeResultsTimeline(
    timeline,
    new Set(metadata.map(transect => transect.transectId))
  );
  const network = annualNetwork(scoped, year, metadata);
  return {
    timeline: scoped,
    network,
    current: summarizeYear(scoped, year),
    previous: summarizeYear(scoped, year - 1),
    nameMatches: network.filter(
      item => item.metadata && icnfIdentification(item.metadata) === "name"
    ).length,
    highlights: annualHighlights(scoped, year, metadata),
  };
}
