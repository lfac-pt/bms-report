import { bbox, booleanPointInPolygon, point } from "@turf/turf";
import proj4 from "proj4";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { parseCoordinates } from "../utils/coordinate-utils";
import { Row } from "./model";

export type MunicipalityBoundaries = FeatureCollection<
  Polygon | MultiPolygon,
  { Concelho: string }
> & {
  crs?: { properties?: { name?: string } };
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-PT");
const displayName = (value: string) =>
  value
    .toLocaleLowerCase("pt-PT")
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase("pt-PT")
    )
    .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, word => word.toLowerCase());
const TM06 =
  "+proj=tmerc +lat_0=39.66825833333333 +lon_0=-8.133108333333334 +k=1 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs";

/** Verify municipalities against boundaries; never treat a settlement or park label as a municipality. */
export function resolveMunicipalities(rows: Row[], boundaries: MunicipalityBoundaries) {
  if (boundaries.type !== "FeatureCollection" || !Array.isArray(boundaries.features))
    throw new Error("Invalid municipality boundary collection");
  const crs = boundaries.crs?.properties?.name || "EPSG:4326";
  if (!/(3763|4326|CRS84)$/.test(crs))
    throw new Error(`Unsupported municipality boundary CRS: ${crs}`);
  const features = boundaries.features
    .filter(
      feature =>
        ["Polygon", "MultiPolygon"].includes(feature.geometry?.type) &&
        typeof feature.properties?.Concelho === "string"
    )
    .map(feature => ({
      feature,
      name: displayName(feature.properties.Concelho),
      box: bbox(feature),
    }));
  if (!features.length) throw new Error("No usable municipality boundaries");
  const transform = /3763$/.test(crs) ? proj4("EPSG:4326", TM06) : null;
  if (
    !transform &&
    features.some(
      ({ box }) =>
        Math.abs(box[0]) > 180 ||
        Math.abs(box[2]) > 180 ||
        Math.abs(box[1]) > 90 ||
        Math.abs(box[3]) > 90
    )
  )
    throw new Error("Projected municipality boundaries must declare their CRS");
  const officialNames = new Map(features.map(item => [normalize(item.name), item.name]));
  const diagnostics: {
    id: string;
    name: string;
    original: string;
    municipality: string;
    source: "boundary" | "metadata" | "unresolved";
  }[] = [];
  const metadata = rows.map(row => {
    if (!["Válido", "Novo"].includes((row["Situação"] || "").trim())) return row;
    const original = row.Concelho || "";
    const coordinates = parseCoordinates(row["Spatial Refere"] || "");
    let municipality = "";
    let source: "boundary" | "metadata" | "unresolved" = "unresolved";
    if (
      coordinates &&
      Number.isFinite(coordinates.lat) &&
      Number.isFinite(coordinates.lon) &&
      Math.abs(coordinates.lat) <= 90 &&
      Math.abs(coordinates.lon) <= 180
    ) {
      const location = transform
        ? transform.forward([coordinates.lon, coordinates.lat])
        : [coordinates.lon, coordinates.lat];
      const hits = features.filter(
        ({ feature, box }) =>
          location[0] >= box[0] &&
          location[0] <= box[2] &&
          location[1] >= box[1] &&
          location[1] <= box[3] &&
          booleanPointInPolygon(point(location), feature)
      );
      if (hits.length === 1) {
        municipality = hits[0].name;
        source = "boundary";
      }
    } else {
      municipality = officialNames.get(normalize(original)) || "";
      if (municipality) source = "metadata";
    }
    diagnostics.push({
      id: row["Transect ID"],
      name: row["Transect Name"],
      original,
      municipality,
      source,
    });
    return { ...row, Concelho: municipality };
  });
  return {
    metadata,
    diagnostics,
    complete: diagnostics.every(item => item.source !== "unresolved"),
  };
}
