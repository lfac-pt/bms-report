/**
 * CSV parsing utilities
 */

import * as fs from "fs";
import * as Papa from "papaparse";

/**
 * Read and parse a CSV file
 */
export function readCSV(filePath: string): Record<string, string>[] {
  console.log(`Reading ${filePath}...`);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const result = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep everything as strings initially
  });

  if (result.errors.length > 0) {
    console.warn(`Warnings while parsing ${filePath}:`, result.errors);
  }

  console.log(`  Loaded ${result.data.length} rows`);
  return result.data;
}
