/**
 * Helper utilities for rbms R library integration
 *
 * This module provides functions to:
 * - Extract and transform butterfly data for rbms
 * - Convert date formats
 * - Write CSV files
 * - Call R scripts
 * - Validate rbms output
 */

import * as fs from "fs";
import { spawn } from "child_process";
import * as cacheUtils from "./cache-utils";
import { TransformedDataRow } from "../src/types/processing";
import { MONITORING_START_MONTH, MONITORING_END_MONTH } from "../src/constants";

interface ISOWeekResult {
  year: number;
  week: number;
}

export interface VisitData {
  site_id: string;
  date: string;
  year: number;
  [key: string]: unknown; // Add index signature for compatibility
}

export interface CountData {
  site_id: string;
  date: string;
  count: number;
  [key: string]: unknown; // Add index signature for compatibility
}

interface SpeciesDataResult {
  visits: VisitData[];
  counts: CountData[];
}

export interface TransectLengthData {
  site_id: string;
  length_km: number;
  [key: string]: unknown; // Add index signature for compatibility
}

interface CallRbmsOptions {
  visitsFile?: string;
  countsFile?: string;
  outputFile?: string;
  sourceDataFiles?: string[];
  additionalFiles?: string[];
}

interface RbmsDataQuality {
  site_count: number;
  total_visits: number;
  [key: string]: unknown;
}

interface RbmsOutput {
  species: string;
  collated_indices: Record<string, number>;
  data_quality: RbmsDataQuality;
  [key: string]: unknown;
}

/**
 * Convert date from DD/MM/YYYY to YYYY-MM-DD format
 */
export function convertDateFormat(dateStr: string): string {
  if (!dateStr || typeof dateStr !== "string") {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  const parts = dateStr.split("/");
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}. Expected DD/MM/YYYY`);
  }

  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Get ISO week number and year for a date
 */
export function getISOWeek(date: Date): ISOWeekResult {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return {
    year: d.getUTCFullYear(),
    week: weekNo,
  };
}

/**
 * Parse DD/MM/YYYY date string to Date object
 */
export function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split("/");
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * Sanitize species name for use in filenames
 */
export function sanitizeFilename(speciesName: string): string {
  return speciesName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Extract and transform data for a single species, aggregated by week
 */
export function extractSpeciesData(
  allData: TransformedDataRow[],
  transectIds: string[],
  speciesName: string
): SpeciesDataResult {
  const transectSet = new Set(transectIds);
  const visitsMap = new Map<string, VisitData>(); // Key: transectId_year_week, Value: visit info (first date of week)
  const countsMap = new Map<string, CountData>(); // Key: transectId_year_week, Value: total count for week

  // First pass: Build weekly visits map from ALL data at these transects
  // Aggregate to one visit per site-week (using first monitoring date of that week)
  allData.forEach(row => {
    const month = row.month;
    if (
      !transectSet.has(row.transectId) ||
      month === null ||
      month < MONITORING_START_MONTH - 1 ||
      month > MONITORING_END_MONTH - 1
    ) {
      return; // Skip non-quality transects and out-of-season data (month is 0-indexed)
    }

    try {
      const dateObj = parseDate(row.date);
      const { year, week } = getISOWeek(dateObj);
      const visitKey = `${row.transectId}_${year}_${week}`;

      if (!visitsMap.has(visitKey)) {
        const dateYMD = convertDateFormat(row.date);
        visitsMap.set(visitKey, {
          site_id: row.transectId,
          date: dateYMD, // First date we saw this site-week
          year: year,
        });
      }
    } catch (err) {
      console.warn(`Skipping invalid date ${row.date}`);
    }
  });

  // Second pass: Build weekly counts for this specific species
  // Sum all counts within each site-week
  allData.forEach(row => {
    const month = row.month;
    if (
      row.species !== speciesName ||
      !transectSet.has(row.transectId) ||
      month === null ||
      month < MONITORING_START_MONTH - 1 ||
      month > MONITORING_END_MONTH - 1
    ) {
      return; // month is 0-indexed
    }

    const count = row.count || 0;
    if (count > 0) {
      try {
        const dateObj = parseDate(row.date);
        const { year, week } = getISOWeek(dateObj);
        const countKey = `${row.transectId}_${year}_${week}`;

        // Get the visit date for this site-week
        const visit = visitsMap.get(countKey);
        if (!visit) {
          // No visit recorded for this week (shouldn't happen)
          console.warn(`No visit found for count at ${row.transectId} week ${year}-${week}`);
          return;
        }

        // Aggregate counts by site-week
        if (countsMap.has(countKey)) {
          countsMap.get(countKey)!.count += count;
        } else {
          countsMap.set(countKey, {
            site_id: row.transectId,
            date: visit.date, // Use same date as visit
            count: count,
          });
        }
      } catch (err) {
        console.warn(`Skipping invalid date ${row.date} for species ${speciesName}`);
      }
    }
  });

  // Convert visits map to array and sort by site_id and date
  const visitsArray = Array.from(visitsMap.values()).sort((a, b) => {
    if (a.site_id !== b.site_id) return a.site_id.localeCompare(b.site_id);
    return a.date.localeCompare(b.date);
  });

  // Convert counts map to array and sort
  const countsArray = Array.from(countsMap.values()).sort((a, b) => {
    if (a.site_id !== b.site_id) return a.site_id.localeCompare(b.site_id);
    return a.date.localeCompare(b.date);
  });

  return {
    visits: visitsArray,
    counts: countsArray,
  };
}

/**
 * Write array of objects to CSV file
 */
export function writeCSV(
  filepath: string,
  data: Record<string, unknown>[],
  columns: string[]
): void {
  if (!data || data.length === 0) {
    throw new Error(`No data to write to ${filepath}`);
  }

  // Create header row
  const header = columns.join(",");

  // Create data rows
  const rows = data.map(row => {
    return columns
      .map(col => {
        const value = row[col];
        // Handle undefined/null
        if (value === undefined || value === null) return "";
        // Escape values containing commas or quotes
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(",");
  });

  // Combine and write
  const csv = [header, ...rows].join("\n");
  fs.writeFileSync(filepath, csv, "utf8");
}

/**
 * Extract transect lengths for a set of transect IDs
 * Returns lengths in kilometers (converted from meters if needed)
 *
 * @param transects - Array of transect objects with transectId and length properties
 * @param transectIds - Array of transect IDs to include
 * @returns Array of TransectLengthData with site_id and length_km
 */
export function extractTransectLengths(
  transects: Array<{ transectId: string; length?: number | null }>,
  transectIds: string[]
): TransectLengthData[] {
  const transectIdSet = new Set(transectIds);
  const lengths: TransectLengthData[] = [];

  for (const transect of transects) {
    if (!transectIdSet.has(transect.transectId)) {
      continue;
    }

    // Get length - default to 1000m (1km) if not available
    // Transect length is stored in meters in the processed data
    const lengthMeters = transect.length ?? 1000;

    // Convert to kilometers for the R script
    const lengthKm = lengthMeters / 1000;

    // Only include if length is valid (> 0)
    if (lengthKm > 0) {
      lengths.push({
        site_id: transect.transectId,
        length_km: Math.round(lengthKm * 1000) / 1000, // Round to 3 decimal places
      });
    }
  }

  return lengths;
}

/**
 * Call R script for rbms processing
 */
export function callRbms(
  rScriptPath: string,
  args: string[],
  timeout: number = 120000,
  options: CallRbmsOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Verify R script exists
    if (!fs.existsSync(rScriptPath)) {
      return reject(new Error(`R script not found: ${rScriptPath}`));
    }

    // Compute cache key and output file once (if caching enabled)
    let cacheKey: string | null = null;
    let outputFile: string | null = null;
    if (options.visitsFile && options.countsFile) {
      cacheKey = cacheUtils.generateCacheKey(
        rScriptPath,
        options.visitsFile,
        options.countsFile,
        args,
        options // Pass full options including sourceDataFiles
      );

      // Extract output file path from args (typically 3rd argument in rbms scripts)
      outputFile = options.outputFile || (args.length > 2 ? args[2] : null);

      const cachedResult = cacheUtils.getCachedResult(
        cacheKey,
        outputFile,
        options.additionalFiles || []
      );
      if (cachedResult) {
        // console.log(`    [cache hit]`);
        return resolve(cachedResult);
      }

      // Cache miss - will call R and cache the result
      // console.log(`    [cache miss]`);
    }

    // Spawn R process
    const rProcess = spawn("Rscript", [rScriptPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    // Collect stdout
    rProcess.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    // Collect stderr
    rProcess.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // Set timeout
    const timer = setTimeout(() => {
      rProcess.kill("SIGTERM");
      reject(new Error(`R script timeout after ${timeout}ms`));
    }, timeout);

    // Handle process exit
    rProcess.on("close", (code: number | null) => {
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(`R script exited with code ${code}:\n${stderr}`));
      } else {
        // Cache the result if caching is enabled (reuse previously computed cacheKey)
        if (cacheKey) {
          cacheUtils.setCachedResult(cacheKey, stdout, outputFile, options.additionalFiles || []);
        }
        resolve(stdout);
      }
    });

    // Handle process errors
    rProcess.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start R process: ${err.message}`));
    });
  });
}

/**
 * Validate rbms output JSON structure and values
 */
export function validateRbmsOutput(
  output: RbmsOutput,
  speciesName: string,
  expectedYears: number[]
): RbmsOutput {
  // Check basic structure
  if (!output || typeof output !== "object") {
    throw new Error(`Invalid rbms output: not an object`);
  }

  if (output.species !== speciesName) {
    throw new Error(`Species mismatch: expected ${speciesName}, got ${output.species}`);
  }

  if (!output.collated_indices || typeof output.collated_indices !== "object") {
    throw new Error(`Missing or invalid collated_indices`);
  }

  if (!output.data_quality || typeof output.data_quality !== "object") {
    throw new Error(`Missing or invalid data_quality`);
  }

  // Check we have indices for expected years
  const indexYears = Object.keys(output.collated_indices).map(Number);
  const missingYears = expectedYears.filter(y => !indexYears.includes(y));

  if (missingYears.length > 0) {
    console.warn(`rbms output missing years for ${speciesName}: ${missingYears.join(", ")}`);
  }

  // Check index values are reasonable (0.01 to 10000)
  for (const [year, index] of Object.entries(output.collated_indices)) {
    const indexValue = parseFloat(String(index));
    if (isNaN(indexValue)) {
      throw new Error(`Invalid index value for year ${year}: ${index}`);
    }
    if (indexValue < 0.01 || indexValue > 10000) {
      console.warn(`Unusual index value for ${speciesName} year ${year}: ${indexValue}`);
    }
  }

  // Check data quality metrics
  const dq = output.data_quality;
  if (typeof dq.site_count !== "number" || dq.site_count < 0) {
    throw new Error(`Invalid data_quality.site_count: ${dq.site_count}`);
  }
  if (typeof dq.total_visits !== "number" || dq.total_visits < 0) {
    throw new Error(`Invalid data_quality.total_visits: ${dq.total_visits}`);
  }

  return output;
}
