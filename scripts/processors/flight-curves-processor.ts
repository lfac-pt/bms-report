/**
 * Flight curves processor
 */

import * as fs from "fs";
import * as path from "path";
import * as rbmsUtils from "../rbms-utils";
import {
  FlightCurvesData,
  TransectStats,
  TransformedDataRow,
  TrendClassification,
} from "../../src/types/processing";
import {
  MIN_YEARS_ACTIVE,
  MIN_VISITS_PER_YEAR,
  MIN_COUNTS_PER_SPECIES,
  MIN_YEARS_PER_SPECIES,
  BASELINE_YEAR,
  MONITORING_START_MONTH,
  MONITORING_END_MONTH,
  VALID_SPECIES,
} from "../../src/constants";

// Minimum detection rate (5%) to calculate confidence intervals
// Species with lower detection rates produce unreliable CI estimates
const MIN_DETECTION_RATE = 0.05;
import { getYearFromDate, getMonthFromDate } from "../utils";
import { ALL_DATA_FILE, METADATA_FILE, TEMP_RBMS_DIR } from "../config";
import { getQualityFilteredTransects } from "./transect-stats-processor";

/**
 * Calculate flight curves for all species with sufficient data using rbms
 */
export async function calculateAllFlightCurves(
  allData: Record<string, string>[],
  transects: TransectStats[],
  baselineYear: number = BASELINE_YEAR
): Promise<FlightCurvesData | null> {
  console.log("\nCalculating flight curves for all species using rbms...");

  // Step 1: Use same quality transect filtering as GBI
  const qualityTransects = getQualityFilteredTransects(transects);
  const activeQualityTransects = qualityTransects.filter(t => t.isActive);
  const qualityTransectIds = activeQualityTransects.map(t => t.transectId);

  console.log(
    `  Quality transects: ${qualityTransects.length} (${MIN_YEARS_ACTIVE}+ years, ${MIN_VISITS_PER_YEAR}+ visits/year)`
  );
  console.log(`  Active in most recent year: ${activeQualityTransects.length}`);

  if (activeQualityTransects.length === 0) {
    console.warn("  Warning: No active quality transects found");
    return null;
  }

  // Step 2: Prepare temporary directory for rbms data exchange
  if (!fs.existsSync(TEMP_RBMS_DIR)) {
    fs.mkdirSync(TEMP_RBMS_DIR, { recursive: true });
  }

  // Step 3: Transform data for rbms
  const transformedData: TransformedDataRow[] = allData
    .filter(row => {
      const month = getMonthFromDate(row["Date"]);
      return (
        month !== null && month >= MONITORING_START_MONTH - 1 && month <= MONITORING_END_MONTH - 1
      ); // Monitoring season (0-indexed)
    })
    .map(row => ({
      transectId: row["Transect ID"],
      date: row["Date"],
      year: getYearFromDate(row["Date"]),
      month: getMonthFromDate(row["Date"]),
      species: row["Preferred Species Name"],
      count: parseInt(row["Abundance Count"]) || 0,
    }))
    .filter(row => row.year !== null && row.year >= baselineYear);

  console.log(`  Transformed ${transformedData.length} observations for rbms`);

  // Get all years
  const allYears = Array.from(
    new Set(transformedData.map(row => row.year).filter((y): y is number => y !== null))
  ).sort((a, b) => a - b);
  console.log(`  Years with data: ${allYears.join(", ")}`);

  if (allYears.length < 3) {
    console.warn(`  Warning: Insufficient years of data: ${allYears.length}`);
    return null;
  }

  // Step 4: Get all species with sufficient data
  const speciesCounts = new Map<
    string,
    { observations: number; counts: number; years: Set<number> }
  >();
  transformedData.forEach(row => {
    if (!qualityTransectIds.includes(row.transectId)) return;

    const current = speciesCounts.get(row.species) || {
      observations: 0,
      counts: 0,
      years: new Set<number>(),
    };
    current.observations++;
    if (row.count > 0) current.counts++;
    if (row.year) current.years.add(row.year);
    speciesCounts.set(row.species, current);
  });

  // Filter to species with sufficient data AND in the whitelist
  const eligibleSpecies = Array.from(speciesCounts.entries())
    .filter(([species, stats]) => {
      return (
        VALID_SPECIES.has(species) &&
        stats.counts >= MIN_COUNTS_PER_SPECIES &&
        stats.years.size >= MIN_YEARS_PER_SPECIES
      ); // Minimum counts and years for species analysis
    })
    .map(([species]) => species)
    .sort();

  console.log(
    `  Found ${eligibleSpecies.length} species in whitelist with sufficient data (${MIN_COUNTS_PER_SPECIES}+ counts, ${MIN_YEARS_PER_SPECIES}+ years)`
  );

  // Step 5: Process each species with rbms
  const speciesResults: FlightCurvesData["species"] = {};
  const rScriptPath = path.join(__dirname, "..", "rbms-collated-index.R");
  let successCount = 0;

  for (const species of eligibleSpecies) {
    try {
      // Extract data for this species
      const speciesData = rbmsUtils.extractSpeciesData(
        transformedData,
        qualityTransectIds,
        species
      );

      if (speciesData.visits.length < 5 || speciesData.counts.length < 5) {
        continue; // Skip silently
      }

      // Prepare temporary files
      const sanitized = rbmsUtils.sanitizeFilename(species);
      const visitsFile = path.join(TEMP_RBMS_DIR, `visits_${sanitized}.csv`);
      const countsFile = path.join(TEMP_RBMS_DIR, `counts_${sanitized}.csv`);
      const outputFile = path.join(TEMP_RBMS_DIR, `output_${sanitized}.json`);

      rbmsUtils.writeCSV(visitsFile, speciesData.visits, ["site_id", "date", "year"]);
      rbmsUtils.writeCSV(countsFile, speciesData.counts, ["site_id", "date", "count"]);

      const args = [visitsFile, countsFile, outputFile, species, baselineYear.toString()];

      // Call rbms R script with caching
      await rbmsUtils.callRbms(rScriptPath, args, 120000, {
        visitsFile,
        countsFile,
        sourceDataFiles: [ALL_DATA_FILE, METADATA_FILE],
      });

      // Check if R script created the output file
      if (!fs.existsSync(outputFile)) {
        throw new Error(
          "R script did not produce output file (likely insufficient data for model fitting)"
        );
      }

      // Read and validate results
      const outputJSON = fs.readFileSync(outputFile, "utf8");
      const rbmsOutput = JSON.parse(outputJSON);
      rbmsUtils.validateRbmsOutput(rbmsOutput, species, allYears);

      // Calculate detection rate (total counts / total visits)
      const totalCounts = rbmsOutput.data_quality?.total_counts || 0;
      const totalVisits = rbmsOutput.data_quality?.total_visits || 1;
      const detectionRate = totalCounts / totalVisits;

      // Extract confidence intervals from rbms bootstrap
      // Skip CI for species with very low detection rates (< 5%) as they produce unreliable estimates
      const confidenceIntervals: Record<number, { ci_lower: number; ci_upper: number }> = {};
      let ciSkippedDueToLowDetection = false;

      if (detectionRate >= MIN_DETECTION_RATE) {
        if (
          rbmsOutput.confidence_intervals &&
          Object.keys(rbmsOutput.confidence_intervals).length > 0
        ) {
          for (const [year, ci] of Object.entries(rbmsOutput.confidence_intervals)) {
            confidenceIntervals[parseInt(year)] = {
              ci_lower: (ci as any).ci_lower,
              ci_upper: (ci as any).ci_upper,
            };
          }
        }
      } else {
        ciSkippedDueToLowDetection = true;
        console.log(
          `    Skipping CI calculation for ${species}: detection rate ${(detectionRate * 100).toFixed(2)}% < ${(MIN_DETECTION_RATE * 100).toFixed(0)}%`
        );
      }

      // Extract trend classification from rbms output
      const trendStats = rbmsOutput.trend_statistics || {};
      let trendClassification: TrendClassification | null = null;

      if (trendStats.trend_class) {
        trendClassification = {
          category: trendStats.trend_class,
          annualRateOfChange: trendStats.pc1 || null,
          rateOfChange: trendStats.rate || 1.0,
          confidenceInterval: {
            lower: trendStats.pc1_ci_lower || null,
            upper: trendStats.pc1_ci_upper || null,
          },
          rateCI: {
            lower: trendStats.rate_ci_lower || null,
            upper: trendStats.rate_ci_upper || null,
          },
        };
      }

      // Calculate species-specific data quality metrics
      const speciesTransects = new Set(speciesData.counts.map(c => c.site_id));
      const speciesObservations = speciesData.counts.reduce((sum, c) => sum + c.count, 0);

      // Store results
      speciesResults[species] = {
        collatedIndices: rbmsOutput.collated_indices,
        trendLine: rbmsOutput.trend_line || null,
        phenologyCurves: rbmsOutput.phenology_curves || null,
        dataQuality: {
          ...rbmsOutput.data_quality,
          // Species-specific metrics (overriding totals)
          transectCount: speciesTransects.size,
          visitsWithObservations: speciesData.counts.length,
          speciesObservations: speciesObservations,
          detectionRate: detectionRate,
        },
        processingInfo: rbmsOutput.processing_info,
        confidenceIntervals: confidenceIntervals,
        trendClassification: trendClassification,
        ciSkippedDueToLowDetection: ciSkippedDueToLowDetection,
      };

      successCount++;

      // Clean up temp files
      fs.unlinkSync(visitsFile);
      fs.unlinkSync(countsFile);
      fs.unlinkSync(outputFile);
    } catch (error) {
      // Skip species that fail - don't log to keep output clean
      continue;
    }
  }

  console.log(`  ✓ Successfully processed ${successCount}/${eligibleSpecies.length} species`);

  if (successCount === 0) {
    console.warn("  Warning: No species successfully processed");
    return null;
  }

  // Step 6: Compile metadata
  const transectsUsedList = activeQualityTransects
    .map(t => ({
      transectId: t.transectId,
      transectName: t.transectName,
    }))
    .sort((a, b) => a.transectName.localeCompare(b.transectName));

  const metadata: FlightCurvesData["metadata"] = {
    processingDate: new Date().toISOString(),
    baselineYear,
    qualityCriteria: {
      minYearsActive: MIN_YEARS_ACTIVE,
      minVisitsPerYear: MIN_VISITS_PER_YEAR,
      minCountsPerSpecies: MIN_COUNTS_PER_SPECIES,
      minYearsPerSpecies: MIN_YEARS_PER_SPECIES,
    },
    transectsUsed: transectsUsedList,
    method: "rbms (GAM flight curves + GLM collated indices)",
  };

  return {
    metadata,
    species: speciesResults,
    speciesList: Object.keys(speciesResults).sort(),
    years: allYears,
  };
}
