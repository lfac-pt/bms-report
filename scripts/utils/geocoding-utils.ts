/**
 * Geocoding utilities
 */

import * as fs from "fs";
import * as https from "https";
import { GeocodeCache, Location } from "../../src/types/processing";
import { NominatimResponse } from "../../src/types/processing";
import { GEOCODE_CACHE_FILE } from "../config";
import { LOCALITY_TO_CONCELHO } from "../config";

/**
 * Reverse geocode coordinates to get location information using Nominatim
 */
export function reverseGeocode(lat: number, lon: number): Promise<NominatimResponse> {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;

    const options = {
      headers: {
        "User-Agent": "BMS-Portugal-Report/1.0",
      },
    };

    https
      .get(url, options, res => {
        let data = "";

        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });

        res.on("end", () => {
          try {
            const result: NominatimResponse = JSON.parse(data);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", (error: Error) => {
        reject(error);
      });
  });
}

/**
 * Extract Concelho and Distrito from Nominatim response
 */
export function extractLocation(nominatimResponse: NominatimResponse): Location {
  if (!nominatimResponse || !nominatimResponse.address) {
    return { concelho: "", distrito: "" };
  }

  const addr = nominatimResponse.address;

  // Try municipality first, then fallback to city/town/village
  let concelho = addr.municipality || addr.city || addr.town || addr.village || "";

  // Check if this is a known locality that should be mapped to a different concelho
  if (LOCALITY_TO_CONCELHO[concelho]) {
    concelho = LOCALITY_TO_CONCELHO[concelho];
  }

  // Distrito is in county field for Portugal
  const distrito = addr.county || "";

  return { concelho, distrito };
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load geocode cache from file
 */
export function loadGeocodeCache(): GeocodeCache {
  try {
    if (fs.existsSync(GEOCODE_CACHE_FILE)) {
      const cacheData = fs.readFileSync(GEOCODE_CACHE_FILE, "utf-8");
      return JSON.parse(cacheData);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("Warning: Failed to load geocode cache:", errorMessage);
  }
  return {};
}

/**
 * Save geocode cache to file
 */
export function saveGeocodeCache(cache: GeocodeCache): void {
  try {
    fs.writeFileSync(GEOCODE_CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("Warning: Failed to save geocode cache:", errorMessage);
  }
}
