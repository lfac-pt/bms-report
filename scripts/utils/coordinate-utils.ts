/**
 * Coordinate parsing and manipulation utilities
 */

import { Coordinates } from "../../src/types/processing";

/**
 * Parse coordinates from the Spatial Reference field
 * Handles multiple formats:
 * - "latitude, longitude" (comma-separated)
 * - "latitude longitude" (space-separated)
 * - "39.41647N 9.5088W" or "40.068639N, 8.391275W" (with N/S/E/W notation)
 */
export function parseCoordinates(spatialRef: string): Coordinates | null {
  if (!spatialRef || typeof spatialRef !== "string") return null;

  const original = spatialRef.trim();

  // Handle N/S/E/W notation (e.g., "39.41647N 9.5088W" or "40.068639N, 8.391275W")
  if (/[NSEW]/i.test(original)) {
    const match = original.match(/([\d.]+)\s*([NS])\s*,?\s*([\d.]+)\s*([EW])/i);
    if (match) {
      let lat = parseFloat(match[1]);
      let lon = parseFloat(match[3]);

      if (match[2].toUpperCase() === "S") lat = -lat;
      if (match[4].toUpperCase() === "W") lon = -lon;

      if (!isNaN(lat) && !isNaN(lon)) {
        return { lat, lon };
      }
    }
    return null;
  }

  // Try to split by comma first, then by space
  let parts: string[];
  if (original.includes(",")) {
    // Comma-separated: clean up spaces around minus sign, then split by comma
    const cleaned = original.replace(/\s*-\s*/g, "-");
    parts = cleaned.split(",").map(p => p.trim());
  } else {
    // Space-separated: split by whitespace first, then clean each part
    parts = original.trim().split(/\s+/);
  }

  if (parts.length !== 2) return null;

  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lon)) return null;

  return { lat, lon };
}

/**
 * Add random offset to coordinates for privacy (approximately 500-1000 meters)
 */
export function fuzzyCoordinates(coords: Coordinates): Coordinates | null {
  if (!coords) return null;

  // Add random offset of ~0.005 to 0.01 degrees (roughly 500-1000 meters)
  const offsetLat = (Math.random() - 0.5) * 0.015;
  const offsetLon = (Math.random() - 0.5) * 0.015;

  return {
    lat: coords.lat + offsetLat,
    lon: coords.lon + offsetLon,
  };
}
