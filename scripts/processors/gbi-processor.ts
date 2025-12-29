/**
 * Grassland Butterfly Index (GBI) processor
 */

import * as fs from "fs";
import * as path from "path";
import * as rbmsUtils from "../rbms-utils";
import {
  TransectStats,
  GBIData,
  SpeciesTrend,
  TrendClassification,
  TransformedDataRow,
} from "../../src/types/processing";
import {
  MIN_YEARS_ACTIVE,
  MIN_VISITS_PER_YEAR,
  BASELINE_YEAR,
  MONITORING_START_MONTH,
  MONITORING_END_MONTH,
  ALL_GRASSLAND_SPECIES,
  GRASSLAND_SPECIES,
} from "../../src/constants";
import { getYearFromDate, getMonthFromDate } from "../utils";
import { ALL_DATA_FILE, METADATA_FILE, TEMP_RBMS_DIR } from "../config";
import { getQualityFilteredTransects } from "./transect-stats-processor";

/**
 * Main GBI calculation function
 */
export async function calculateGBI(
  allData: Record<string, string>[],
  transects: TransectStats[],
  baselineYear: number = BASELINE_YEAR
): Promise<GBIData | null> {
  console.log("\nCalculating Grassland Butterfly Index (GBI) using rbms...");

  // Step 1: Filter quality transects
  const qualityTransects = getQualityFilteredTransects(transects);

  // Filter to only include transects active in the most recent year
  const activeQualityTransects = qualityTransects.filter(t => t.isActive);
  const qualityTransectIds = activeQualityTransects.map(t => t.transectId);

  console.log(
    `  Quality transects: ${qualityTransects.length} (${MIN_YEARS_ACTIVE}+ years, ${MIN_VISITS_PER_YEAR}+ visits/year)`
  );
  console.log(`  Active in most recent year: ${activeQualityTransects.length}`);

  if (activeQualityTransects.length === 0) {
    console.warn("  Warning: No active quality transects found for GBI calculation");
    return null;
  }

  // Step 2: Prepare temporary directory for rbms data exchange
  if (!fs.existsSync(TEMP_RBMS_DIR)) {
    fs.mkdirSync(TEMP_RBMS_DIR, { recursive: true });
  }

  // Step 3: Transform data for rbms
  // rbms expects: transectId, date (YYYY-MM-DD), year, species, count
  const transformedData: TransformedDataRow[] = allData
    .filter(row => {
      const month = getMonthFromDate(row["Date"]);
      return (
        month !== null && month >= MONITORING_START_MONTH - 1 && month <= MONITORING_END_MONTH - 1
      ); // Monitoring season (0-indexed)
    })
    .map(row => ({
      transectId: row["Transect ID"],
      date: row["Date"], // Still in DD/MM/YYYY, will convert per-species
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

  // Step 4: Process each grassland species with rbms
  const speciesTrends: Record<string, SpeciesTrend> = {};
  const allSpecies = Array.from(ALL_GRASSLAND_SPECIES);
  const rScriptPath = path.join(__dirname, "..", "rbms-collated-index.R");

  console.log(`  Processing ${allSpecies.length} grassland species with rbms...`);

  // Step 4b: Extract and write transect lengths for normalization (REQUIRED)
  // This follows BMS technical report methodology for standardizing to 1-km transects
  const transectLengths = rbmsUtils.extractTransectLengths(transects, qualityTransectIds);
  const transectLengthsFile = path.join(TEMP_RBMS_DIR, "transect_lengths.csv");

  if (transectLengths.length === 0) {
    throw new Error("No transect lengths available - cannot calculate normalized indices");
  }

  rbmsUtils.writeCSV(transectLengthsFile, transectLengths, ["site_id", "length_km"]);
  console.log(`  Transect lengths extracted: ${transectLengths.length} transects`);
  console.log(
    `  Length range: ${Math.min(...transectLengths.map(t => t.length_km)).toFixed(2)} - ${Math.max(...transectLengths.map(t => t.length_km)).toFixed(2)} km`
  );

  // Step 4c: Extract and write site regions for GBI calculation (REQUIRED)
  // The R script uses regional flight curves for imputation within the GBI calculation
  const siteRegionsFile = rbmsUtils.prepareSiteRegionsFile(
    activeQualityTransects,
    qualityTransectIds,
    TEMP_RBMS_DIR
  );

  // Debug: Check what species we actually have in the data
  const speciesInData = new Set(transformedData.map(row => row.species));
  console.log(`  Species found in data (${speciesInData.size}):`);
  console.log(`  All species: ${Array.from(speciesInData).sort().join(", ")}`);
  console.log(`  Grassland species in data:`);
  Array.from(speciesInData)
    .sort()
    .forEach(sp => {
      if (ALL_GRASSLAND_SPECIES.has(sp)) {
        const count = transformedData.filter(r => r.species === sp).length;
        console.log(`    - ${sp}: ${count} observations`);
      }
    });

  // Check first few rows of transformedData
  console.log(`  Sample transformed data (first 3 rows):`);
  transformedData.slice(0, 3).forEach(row => {
    console.log(`    ${JSON.stringify(row)}`);
  });

  for (const species of allSpecies) {
    try {
      console.log(`\n  Processing: ${species}`);

      // Extract data for this species
      const speciesData = rbmsUtils.extractSpeciesData(
        transformedData,
        qualityTransectIds,
        species
      );

      console.log(
        `    Found: ${speciesData.visits.length} visits, ${speciesData.counts.length} counts`
      );

      if (speciesData.visits.length < 5) {
        console.log(`    Skipping: insufficient visits (${speciesData.visits.length})`);
        continue;
      }

      if (speciesData.counts.length < 5) {
        console.log(`    Skipping: insufficient counts (${speciesData.counts.length})`);
        continue;
      }

      // Create safe filename
      const speciesSafe = rbmsUtils.sanitizeFilename(species);

      // Write CSV files
      const visitsFile = path.join(TEMP_RBMS_DIR, `visits_${speciesSafe}.csv`);
      const countsFile = path.join(TEMP_RBMS_DIR, `counts_${speciesSafe}.csv`);
      const outputFile = path.join(TEMP_RBMS_DIR, `output_${speciesSafe}.json`);

      rbmsUtils.writeCSV(visitsFile, speciesData.visits, ["site_id", "date", "year"]);
      rbmsUtils.writeCSV(countsFile, speciesData.counts, ["site_id", "date", "count"]);

      console.log(`    Visits: ${speciesData.visits.length}, Counts: ${speciesData.counts.length}`);

      // Call R script with extended timeout (2 minutes per species)
      // Transect lengths and site regions files are REQUIRED
      const args = [
        visitsFile,
        countsFile,
        outputFile,
        species,
        baselineYear.toString(),
        transectLengthsFile,
        siteRegionsFile, // Regional flight curves
      ];

      // Calculate bootstrap RDS file path for caching
      const bootstrapDir = path.join(__dirname, "..", "..", ".cache", "rbms", "bootstrap");
      const bootstrapFile = path.join(bootstrapDir, `${speciesSafe}_boot.rds`);

      try {
        await rbmsUtils.callRbms(rScriptPath, args, 120000, {
          visitsFile,
          countsFile,
          sourceDataFiles: [ALL_DATA_FILE, METADATA_FILE],
          additionalFiles: [bootstrapFile], // Cache the bootstrap RDS file
        }); // 2 minute timeout with caching

        // Read and validate results
        if (!fs.existsSync(outputFile)) {
          throw new Error("R script did not produce output file");
        }

        const outputJSON = fs.readFileSync(outputFile, "utf8");
        const rbmsOutput = JSON.parse(outputJSON);

        // Validate output
        rbmsUtils.validateRbmsOutput(rbmsOutput, species, allYears);

        // Check if we got valid indices
        if (Object.keys(rbmsOutput.collated_indices).length < 3) {
          throw new Error(
            `Insufficient years with rbms indices: ${Object.keys(rbmsOutput.collated_indices).length}`
          );
        }

        // Store species trend
        const speciesType = GRASSLAND_SPECIES.widespread.has(species) ? "widespread" : "specialist";
        const yearsWithData = Object.keys(rbmsOutput.collated_indices).map(Number);

        // Calculate slope from indices (log-linear regression for metadata)
        const indices = yearsWithData.map(year => rbmsOutput.collated_indices[year]);
        const years = yearsWithData.map(year => year - baselineYear);
        const logIndices = indices.map(idx => Math.log(idx));
        const n = years.length;
        const sumX = years.reduce((a, b) => a + b, 0);
        const sumY = logIndices.reduce((a, b) => a + b, 0);
        const sumXY = years.reduce((sum, x, i) => sum + x * logIndices[i], 0);
        const sumX2 = years.reduce((sum, x) => sum + x * x, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        // Extract rbms-calculated bootstrap confidence intervals
        let confidenceIntervals: Record<number, { ci_lower: number; ci_upper: number }> = {};
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
          console.log(`    ✓ rbms bootstrap CIs: ${Object.keys(confidenceIntervals).length} years`);
        } else {
          console.log(`    ⚠ No bootstrap CIs available from rbms`);
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
          console.log(`    ✓ Trend: ${trendStats.trend_class} (${trendStats.pc1?.toFixed(1)}%/yr)`);
        }

        speciesTrends[species] = {
          species,
          type: speciesType,
          slope: slope,
          yearsWithData,
          annualIndices: rbmsOutput.collated_indices,
          trendLine: rbmsOutput.trend_line || null,
          confidenceIntervals: confidenceIntervals,
          trendClassification: trendClassification,
          dataQuality: rbmsOutput.data_quality,
          method: "rbms",
        };

        console.log(`    ✓ rbms success: ${yearsWithData.length} years`);

        // Clean up temp files
        try {
          fs.unlinkSync(visitsFile);
          fs.unlinkSync(countsFile);
          fs.unlinkSync(outputFile);
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
      } catch (rbmsError) {
        const errorMessage =
          rbmsError instanceof Error ? rbmsError.message.split("\n")[0] : String(rbmsError);
        console.log(`    rbms failed: ${errorMessage}`);
        console.log(`    Species excluded from GBI`);
        continue;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`    Error: ${errorMessage}`);
      continue;
    }
  }

  const speciesWithTrends = Object.keys(speciesTrends);
  console.log(
    `\n  Species successfully processed: ${speciesWithTrends.length}/${allSpecies.length}`
  );

  // Clean up transect lengths file after processing all species
  try {
    fs.unlinkSync(transectLengthsFile);
  } catch (cleanupErr) {
    // Ignore cleanup errors
  }

  if (speciesWithTrends.length === 0) {
    console.warn("  Warning: No species trends calculated");
    return null;
  }

  // Step 5: Calculate GBI using R script with proper MSI methodology
  console.log("\n  Calculating GBI using Multi-Species Indicator (MSI) methodology...");

  // Prepare species metadata for R script
  const grasslandSpeciesList = speciesWithTrends.map(species => ({
    scientificName: species,
    type: GRASSLAND_SPECIES.widespread.has(species) ? "widespread" : "specialist",
  }));

  const widespreadSpecies = grasslandSpeciesList.filter(s => s.type === "widespread");
  const specialistSpecies = grasslandSpeciesList.filter(s => s.type === "specialist");

  console.log(`  Grassland species breakdown:`);
  console.log(`    Total: ${grasslandSpeciesList.length}`);
  console.log(`    Widespread: ${widespreadSpecies.length}`);
  console.log(`    Specialist: ${specialistSpecies.length}`);

  const transectsUsedList = activeQualityTransects.map(t => ({
    transectId: t.transectId,
    yearsActive: t.yearsActive,
    avgVisitsPerYear: Math.round(t.avgVisitsPerYear * 10) / 10,
    isActive: t.isActive,
  }));

  // Prepare paths
  const bootstrapDir = path.join(__dirname, "..", "..", ".cache", "rbms", "bootstrap");
  const gbiRScript = path.join(__dirname, "..", "calculate-gbi.R");

  // Helper function to calculate MSI for a species subset
  async function calculateMSI(
    speciesList: typeof grasslandSpeciesList,
    outputSuffix: string,
    label: string
  ) {
    if (speciesList.length === 0) {
      console.log(`  Skipping ${label} MSI: no species`);
      return null;
    }

    const speciesMetadata = {
      grasslandSpecies: speciesList,
      qualityCriteria: {
        minYearsActive: MIN_YEARS_ACTIVE,
        minVisitsPerYear: MIN_VISITS_PER_YEAR,
      },
      transectsUsed: transectsUsedList,
    };

    const metadataFile = path.join(TEMP_RBMS_DIR, `species_metadata_${outputSuffix}.json`);
    const outputFile = path.join(TEMP_RBMS_DIR, `gbi_${outputSuffix}.json`);

    fs.writeFileSync(metadataFile, JSON.stringify(speciesMetadata, null, 2));

    console.log(`\n  Calculating ${label} MSI (${speciesList.length} species)...`);

    try {
      await rbmsUtils.callRbms(
        gbiRScript,
        [bootstrapDir, outputFile, baselineYear.toString(), metadataFile],
        120000 // 2 minute timeout
      );

      if (!fs.existsSync(outputFile)) {
        throw new Error("R script did not produce output file");
      }

      const msiData = JSON.parse(fs.readFileSync(outputFile, "utf8"));
      console.log(`  ✓ ${label} MSI calculated for ${Object.keys(msiData.gbiByYear).length} years`);

      // Clean up temp files
      try {
        fs.unlinkSync(metadataFile);
        fs.unlinkSync(outputFile);
      } catch (err) {
        // Ignore cleanup errors
      }

      return msiData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ ${label} MSI failed: ${errorMessage}`);
      // Clean up temp files on error
      try {
        fs.unlinkSync(metadataFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      } catch (err) {
        // Ignore cleanup errors
      }
      return null;
    }
  }

  try {
    // Calculate overall GBI (all grassland species)
    const overallGBI = await calculateMSI(grasslandSpeciesList, "overall", "Overall GBI");

    // Calculate widespread species MSI
    const widespreadMSI = await calculateMSI(widespreadSpecies, "widespread", "Widespread");

    // Calculate specialist species MSI
    const specialistMSI = await calculateMSI(specialistSpecies, "specialist", "Specialist");

    if (!overallGBI) {
      throw new Error("Overall GBI calculation failed");
    }

    const gbiByYear = overallGBI.gbiByYear;
    console.log(`\n  ✓ All MSI calculations complete`);

    // Add data quality metrics (transect/visit counts per year) to overall GBI
    allYears.forEach(year => {
      if (gbiByYear[year]) {
        const yearData = transformedData.filter(row => row.year === year);
        const transectsThisYear = new Set(yearData.map(row => row.transectId));
        const datesThisYear = new Set(yearData.map(row => row.date));

        // Merge with existing dataQuality from R script
        gbiByYear[year].dataQuality = {
          ...gbiByYear[year].dataQuality,
          transectCount: transectsThisYear.size,
          totalVisits: datesThisYear.size,
        };
      }
    });

    // Step 6: Return GBI data with separate MSI indexes
    return {
      metadata: overallGBI.metadata,
      gbiByYear,
      years: allYears,
      gbiTrend: overallGBI.gbiTrend,
      // Add separate MSI indexes for widespread and specialist species
      widespreadMSI: widespreadMSI
        ? {
            gbiByYear: widespreadMSI.gbiByYear,
            gbiTrend: widespreadMSI.gbiTrend,
            years: widespreadMSI.years,
          }
        : null,
      specialistMSI: specialistMSI
        ? {
            gbiByYear: specialistMSI.gbiByYear,
            gbiTrend: specialistMSI.gbiTrend,
            years: specialistMSI.years,
          }
        : null,
    };
  } catch (gbiError) {
    const errorMessage = gbiError instanceof Error ? gbiError.message : String(gbiError);
    console.error(`  Error calculating GBI with R script: ${errorMessage}`);
    console.error(`  Falling back to null result`);
    return null;
  }
}
