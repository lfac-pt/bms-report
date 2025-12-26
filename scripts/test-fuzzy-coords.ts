/**
 * Test with actual fuzzy coordinates from processed data
 */

import { findProtectedArea } from "./protected-areas-utils";

// Fuzzy coordinates from processed data
const longitude = -7.561928448704068;
const latitude = 40.39421903541017;

console.log("Testing with fuzzy coordinates (from processed-transects.json)...");
console.log(`Transect: ICNF PNSE Vale das Éguas`);
console.log(`Coordinates: ${latitude}, ${longitude}`);

const protectedArea = findProtectedArea(longitude, latitude);

if (protectedArea) {
  console.log(`✓ Found protected area: ${protectedArea}`);
} else {
  console.log("✗ No protected area found");
}
