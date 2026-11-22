import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { booleanPointInPolygon, point, simplify, bbox } from "@turf/turf";
import { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { summarizeTimedCounts, LocatedTimedVisit } from "../src/utils/timedCounts";
import { TimedCountResults } from "../src/types/timedCounts";
import { RESULTS_YEAR } from "../src/utils/annualResults";

/** Export only municipality aggregates: never recorder names, sample IDs or point locations. */
export function processTimedCounts(root = process.cwd()) {
  const read = (file: string) =>
    fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
  const visitFile = "raw-data/timed-count-visits.csv";
  const observationFile = "raw-data/timed-count-observations.csv";
  if (![visitFile, observationFile].every(file => fs.existsSync(path.join(root, file)))) {
    console.warn("Timed-count inputs unavailable; retaining the existing timed-count summary.");
    return;
  }
  const visits: Record<string, string>[] = parse(read(visitFile), {
    columns: true,
    skip_empty_lines: true,
  });
  const observations: Record<string, string>[] = parse(read(observationFile), {
    columns: true,
    skip_empty_lines: true,
  });
  // This existing output is already reprojected to WGS84. Locate before simplifying boundaries.
  const boundaries: FeatureCollection<Polygon | MultiPolygon, { Concelho: string }> = JSON.parse(
    read("public/data/municipalities-species-map.geojson")
  );
  const indexed = boundaries.features.map(feature => ({ feature, box: bbox(feature) }));
  const located: LocatedTimedVisit[] = [];
  for (const visit of visits) {
    const match = /^\s*(?:~\s*)?([\d.]+)([NS])\s+([\d.]+)([EW])\s*$/.exec(
      visit["Sample centroid"] || ""
    );
    if (!match) continue;
    const lat = Number(match[1]) * (match[2] === "S" ? -1 : 1);
    const lon = Number(match[3]) * (match[4] === "W" ? -1 : 1);
    const municipality = indexed.find(
      ({ feature, box }) =>
        lon >= box[0] &&
        lat >= box[1] &&
        lon <= box[2] &&
        lat <= box[3] &&
        booleanPointInPolygon(point([lon, lat]), feature)
    );
    if (municipality)
      located.push({ visit, municipality: municipality.feature.properties.Concelho });
  }
  const years = [RESULTS_YEAR - 1, RESULTS_YEAR];
  const summaries = years.map(year => summarizeTimedCounts(located, observations, year));
  const transects: { transects: { concelho: string }[] } = JSON.parse(
    read("public/data/processed-transects.json")
  );
  const normalize = (value: string) =>
    value
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-PT");
  const network = new Set(transects.transects.map(item => normalize(item.concelho || "")));
  const displayGeometry = (feature: (typeof boundaries.features)[number]) => {
    try {
      return simplify(feature, { tolerance: 0.002, highQuality: true }).geometry;
    } catch {
      // Some existing rounded island rings are degenerate; preserve the source boundary.
      return feature.geometry;
    }
  };
  const output: TimedCountResults = {
    years: Object.fromEntries(years.map((year, index) => [year, summaries[index].summary])),
    municipalities: {
      type: "FeatureCollection",
      features: boundaries.features.map(feature => ({
        type: "Feature" as const,
        geometry: displayGeometry(feature),
        properties: {
          name: feature.properties.Concelho,
          hasTransect: network.has(normalize(feature.properties.Concelho)),
          visitsByYear: Object.fromEntries(
            years.map((year, index) => [
              year,
              summaries[index].municipalities[feature.properties.Concelho] || Array(7).fill(0),
            ])
          ),
        },
      })),
    },
  };
  fs.writeFileSync(path.join(root, "public/data/timed-count-results.json"), JSON.stringify(output));
  console.log("Timed counts (mainland, March–September):", JSON.stringify(output.years));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  processTimedCounts();
