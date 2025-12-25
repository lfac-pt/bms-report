/**
 * Types for GeoJSON data
 */

export interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
}

export interface GeoJSON {
  type: string;
  crs?: unknown;
  features: GeoJSONFeature[];
}
