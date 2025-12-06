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

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Convert date from DD/MM/YYYY to YYYY-MM-DD format
 * @param {string} dateStr - Date in DD/MM/YYYY format
 * @returns {string} Date in YYYY-MM-DD format
 */
function convertDateFormat(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}. Expected DD/MM/YYYY`);
  }

  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Get ISO week number and year for a date
 * @param {Date} date - JavaScript Date object
 * @returns {Object} Object with {year, week}
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return {
    year: d.getUTCFullYear(),
    week: weekNo
  };
}

/**
 * Parse DD/MM/YYYY date string to Date object
 * @param {string} dateStr - Date in DD/MM/YYYY format
 * @returns {Date} JavaScript Date object
 */
function parseDate(dateStr) {
  const [day, month, year] = dateStr.split('/');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * Sanitize species name for use in filenames
 * @param {string} speciesName - Scientific name
 * @returns {string} Sanitized filename-safe string
 */
function sanitizeFilename(speciesName) {
  return speciesName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Extract and transform data for a single species, aggregated by week
 * @param {Array} allData - Complete butterfly observation data
 * @param {Array<string>} transectIds - List of quality filtered transect IDs
 * @param {string} speciesName - Scientific name of species
 * @returns {Object} Object with visits and counts arrays (weekly aggregated)
 */
function extractSpeciesData(allData, transectIds, speciesName) {
  const transectSet = new Set(transectIds);
  const visitsMap = new Map(); // Key: transectId_year_week, Value: visit info (first date of week)
  const countsMap = new Map(); // Key: transectId_year_week, Value: total count for week

  // First pass: Build weekly visits map from ALL data at these transects
  // Aggregate to one visit per site-week (using first monitoring date of that week)
  allData.forEach(row => {
    const month = parseInt(row.month);
    if (!transectSet.has(row.transectId) || month < 3 || month > 9) {
      return; // Skip non-quality transects and out-of-season data
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
          year: year
        });
      }
    } catch (err) {
      console.warn(`Skipping invalid date ${row.date}`);
    }
  });

  // Second pass: Build weekly counts for this specific species
  // Sum all counts within each site-week
  allData.forEach(row => {
    const month = parseInt(row.month);
    if (
      row.species !== speciesName ||
      !transectSet.has(row.transectId) ||
      month < 3 ||
      month > 9
    ) {
      return;
    }

    const count = parseInt(row.count) || 0;
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
          countsMap.get(countKey).count += count;
        } else {
          countsMap.set(countKey, {
            site_id: row.transectId,
            date: visit.date, // Use same date as visit
            count: count
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
    counts: countsArray
  };
}

/**
 * Write array of objects to CSV file
 * @param {string} filepath - Output CSV file path
 * @param {Array<Object>} data - Array of objects to write
 * @param {Array<string>} columns - Column names in desired order
 */
function writeCSV(filepath, data, columns) {
  if (!data || data.length === 0) {
    throw new Error(`No data to write to ${filepath}`);
  }

  // Create header row
  const header = columns.join(',');

  // Create data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col];
      // Handle undefined/null
      if (value === undefined || value === null) return '';
      // Escape values containing commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  // Combine and write
  const csv = [header, ...rows].join('\n');
  fs.writeFileSync(filepath, csv, 'utf8');
}

/**
 * Call R script for rbms processing
 * @param {string} rScriptPath - Path to R script
 * @param {Array<string>} args - Command line arguments for R script
 * @param {number} timeout - Timeout in milliseconds (default: 120000 = 2 minutes)
 * @returns {Promise<string>} Promise resolving to R script stdout
 */
function callRbms(rScriptPath, args, timeout = 120000) {
  return new Promise((resolve, reject) => {
    // Verify R script exists
    if (!fs.existsSync(rScriptPath)) {
      return reject(new Error(`R script not found: ${rScriptPath}`));
    }

    // Spawn R process
    const rProcess = spawn('Rscript', [rScriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Collect stdout
    rProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr
    rProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Set timeout
    const timer = setTimeout(() => {
      rProcess.kill('SIGTERM');
      reject(new Error(`R script timeout after ${timeout}ms`));
    }, timeout);

    // Handle process exit
    rProcess.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(`R script exited with code ${code}:\n${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    // Handle process errors
    rProcess.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start R process: ${err.message}`));
    });
  });
}

/**
 * Validate rbms output JSON structure and values
 * @param {Object} output - Parsed JSON from rbms R script
 * @param {string} speciesName - Expected species name
 * @param {Array<number>} expectedYears - Expected years
 * @returns {Object} Validated output
 * @throws {Error} If validation fails
 */
function validateRbmsOutput(output, speciesName, expectedYears) {
  // Check basic structure
  if (!output || typeof output !== 'object') {
    throw new Error(`Invalid rbms output: not an object`);
  }

  if (output.species !== speciesName) {
    throw new Error(`Species mismatch: expected ${speciesName}, got ${output.species}`);
  }

  if (!output.collated_indices || typeof output.collated_indices !== 'object') {
    throw new Error(`Missing or invalid collated_indices`);
  }

  if (!output.data_quality || typeof output.data_quality !== 'object') {
    throw new Error(`Missing or invalid data_quality`);
  }

  // Check we have indices for expected years
  const indexYears = Object.keys(output.collated_indices).map(Number);
  const missingYears = expectedYears.filter(y => !indexYears.includes(y));

  if (missingYears.length > 0) {
    console.warn(`rbms output missing years for ${speciesName}: ${missingYears.join(', ')}`);
  }

  // Check index values are reasonable (0.01 to 10000)
  for (const [year, index] of Object.entries(output.collated_indices)) {
    const indexValue = parseFloat(index);
    if (isNaN(indexValue)) {
      throw new Error(`Invalid index value for year ${year}: ${index}`);
    }
    if (indexValue < 0.01 || indexValue > 10000) {
      console.warn(`Unusual index value for ${speciesName} year ${year}: ${indexValue}`);
    }
  }

  // Check data quality metrics
  const dq = output.data_quality;
  if (typeof dq.site_count !== 'number' || dq.site_count < 0) {
    throw new Error(`Invalid data_quality.site_count: ${dq.site_count}`);
  }
  if (typeof dq.total_visits !== 'number' || dq.total_visits < 0) {
    throw new Error(`Invalid data_quality.total_visits: ${dq.total_visits}`);
  }
  if (typeof dq.flight_curve_r2 !== 'number' || dq.flight_curve_r2 < 0 || dq.flight_curve_r2 > 1) {
    console.warn(`Unusual flight_curve_r2 for ${speciesName}: ${dq.flight_curve_r2}`);
  }

  return output;
}

module.exports = {
  convertDateFormat,
  getISOWeek,
  parseDate,
  sanitizeFilename,
  extractSpeciesData,
  writeCSV,
  callRbms,
  validateRbmsOutput
};
