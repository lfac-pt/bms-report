/**
 * Shared geospatial utility functions using Turf.js
 */

import * as turf from "@turf/turf";

/**
 * Check if a point is inside a polygon or multipolygon geometry
 * Uses Turf.js for robust, well-tested geometric calculations
 *
 * @param longitude - Point longitude
 * @param latitude - Point latitude
 * @param geometry - GeoJSON geometry (Polygon or MultiPolygon)
 * @returns true if point is inside the geometry
 */
export function isPointInGeometry(
  longitude: number,
  latitude: number,
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: [number, number][][] | [number, number][][][];
  }
): boolean {
  try {
    const point = turf.point([longitude, latitude]);

    if (geometry.type === "Polygon") {
      const poly = turf.polygon(geometry.coordinates as [number, number][][]);
      return turf.booleanPointInPolygon(point, poly);
    } else if (geometry.type === "MultiPolygon") {
      const multiPoly = turf.multiPolygon(geometry.coordinates as [number, number][][][]);
      return turf.booleanPointInPolygon(point, multiPoly);
    }

    return false;
  } catch (error) {
    // If there's any error with the geometry (e.g., degenerate polygons), return false
    console.warn("Error checking point in geometry:", error);
    return false;
  }
}
