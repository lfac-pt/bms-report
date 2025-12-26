/**
 * Test script to verify protected area detection
 */

import { findProtectedArea } from "./protected-areas-utils";

// Test with "ICNF PNSE Vale das Éguas" coordinates
const longitude = -7.574762686339006;
const latitude = 40.40101302739302;

console.log("Testing protected area detection...");
console.log(`Coordinates: ${latitude}, ${longitude}`);

const protectedArea = findProtectedArea(longitude, latitude);

if (protectedArea) {
  console.log(`✓ Found protected area: ${protectedArea}`);
} else {
  console.log("✗ No protected area found");
}
