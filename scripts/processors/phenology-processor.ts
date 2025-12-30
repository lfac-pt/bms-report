/**
 * Regional phenology processor
 */

import * as fs from "fs";
import * as path from "path";
import * as rbmsUtils from "../rbms-utils";
import {
  RegionalPhenologyData,
  TransectStats,
  TransformedDataRow,
} from "../../src/types/processing";
import {
  MIN_YEARS_ACTIVE,
  MIN_VISITS_PER_YEAR,
  MIN_COUNTS_PER_SPECIES,
  MIN_YEARS_PER_SPECIES,
  BASELINE_YEAR,
  VALID_SPECIES,
  MONITORING_START_MONTH,
  MONITORING_END_MONTH,
  getQualityFilteredTransects,
} from "../../src/constants";
import { ALL_DATA_FILE, METADATA_FILE, TEMP_RBMS_DIR } from "../config";

/**
 * Calculate phenology curves (weekly abundance predictions) by region using rbms
 */
export async function calculateRegionalPhenology(
  allData: Record<string, string>[],
  transects: TransectStats[],
  baselineYear: number = BASELINE_YEAR
): Promise<RegionalPhenologyData | null> {
  console.log("\nCalculating regional phenology curves using rbms...");

  // Step 1: Get quality active transects (same criteria as GBI)
  const activeQualityTransects = getQualityFilteredTransects(transects);

  console.log(
    `  Quality active transects: ${activeQualityTransects.length} (${MIN_YEARS_ACTIVE}+ years, ${MIN_VISITS_PER_YEAR}+ visits/year, active in most recent year)`
  );

  // Step 2: Group transects by BMS environmental zones
  const transectsByRegion: Record<string, TransectStats[]> = {};
  // BMS Environmental Zones present in Portugal (from EEA Environmental Stratification)
  const REGIONS = [
    "Lusitano",
    "Mediterrânico Norte",
    "Mediterrânico Sul",
    "Mediterrânico Montanhoso",
  ];

  REGIONS.forEach(region => {
    transectsByRegion[region] = activeQualityTransects.filter(t => t.climaticRegion === region);
  });

  console.log("\n  Transects by region:");
  REGIONS.forEach(region => {
    console.log(`    ${region}: ${transectsByRegion[region].length} transects`);
  });

  // Step 3: Transform data for rbms
  const transformedData: TransformedDataRow[] = allData
    .filter(row => {
      const date = row["Date"];
      if (!date) return false;

      const parts = date.split("/");
      if (parts.length !== 3) return false;

      const month = parseInt(parts[1], 10); // 1-indexed month from date string
      const year = parseInt(parts[2], 10);
      return (
        month >= MONITORING_START_MONTH && month <= MONITORING_END_MONTH && year >= baselineYear
      );
    })
    .map(row => ({
      transectId: row["Transect ID"],
      date: row["Date"],
      year: parseInt(row["Date"].split("/")[2], 10),
      month: parseInt(row["Date"].split("/")[1], 10) - 1,
      species: row["Preferred Species Name"].trim(),
      count: parseInt(row["Abundance Count"], 10) || 0,
    }));

  // Step 4: Identify species with sufficient data (using quality transects only)
  const qualityTransectIds = new Set(activeQualityTransects.map(t => t.transectId));
  const speciesCounts = new Map<string, { counts: number; years: Set<number> }>();

  transformedData.forEach(row => {
    if (!VALID_SPECIES.has(row.species)) return;
    if (!qualityTransectIds.has(row.transectId)) return; // Only count from quality transects

    if (!speciesCounts.has(row.species)) {
      speciesCounts.set(row.species, {
        counts: 0,
        years: new Set<number>(),
      });
    }

    const stats = speciesCounts.get(row.species)!;
    stats.counts += row.count;
    if (row.year) stats.years.add(row.year);
  });

  const eligibleSpecies = Array.from(speciesCounts.entries())
    .filter(([_species, stats]) => {
      return stats.counts >= MIN_COUNTS_PER_SPECIES && stats.years.size >= MIN_YEARS_PER_SPECIES;
    })
    .map(([species]) => species)
    .sort();

  console.log(
    `\n  Found ${eligibleSpecies.length} species with sufficient data (${MIN_COUNTS_PER_SPECIES}+ counts, ${MIN_YEARS_PER_SPECIES}+ years)`
  );

  // Step 5: Process each species for each region
  const regionalResults: RegionalPhenologyData["species"] = {};
  const rScriptPath = path.join(__dirname, "..", "rbms-collated-index.R");
  let totalProcessed = 0;

  for (const species of eligibleSpecies) {
    console.log(`\n  Processing: ${species}`);
    regionalResults[species] = {
      regions: {},
    };

    for (const region of REGIONS) {
      const regionTransects = transectsByRegion[region];

      if (regionTransects.length < 2) {
        console.log(`    ${region}: skipped (< 2 transects)`);
        continue;
      }

      try {
        // Extract data for this species in this region
        const regionTransectIds = regionTransects.map(t => t.transectId);
        const speciesData = rbmsUtils.extractSpeciesData(
          transformedData,
          regionTransectIds,
          species
        );

        if (speciesData.visits.length < 5 || speciesData.counts.length < 5) {
          console.log(`    ${region}: skipped (insufficient data)`);
          continue;
        }

        // Prepare temporary files
        const sanitized = rbmsUtils.sanitizeFilename(species);
        const regionSanitized = region.replace(/\s+/g, "_").toLowerCase();
        const visitsFile = path.join(TEMP_RBMS_DIR, `visits_${sanitized}_${regionSanitized}.csv`);
        const countsFile = path.join(TEMP_RBMS_DIR, `counts_${sanitized}_${regionSanitized}.csv`);
        const lengthsFile = path.join(TEMP_RBMS_DIR, `lengths_${sanitized}_${regionSanitized}.csv`);
        const outputFile = path.join(TEMP_RBMS_DIR, `output_${sanitized}_${regionSanitized}.json`);

        rbmsUtils.writeCSV(visitsFile, speciesData.visits, ["site_id", "date", "year"]);
        rbmsUtils.writeCSV(countsFile, speciesData.counts, ["site_id", "date", "count"]);

        // Create transect lengths CSV
        const transectLengths = regionTransects.map(t => ({
          site_id: t.transectId,
          length_km: t.length / 1000, // Convert meters to km
        }));
        rbmsUtils.writeCSV(lengthsFile, transectLengths, ["site_id", "length_km"]);

        const args = [
          visitsFile,
          countsFile,
          outputFile,
          species,
          baselineYear.toString(),
          lengthsFile,
        ];

        // Call rbms R script with caching
        await rbmsUtils.callRbms(rScriptPath, args, 120000, {
          visitsFile,
          countsFile,
          lengthsFile,
          sourceDataFiles: [ALL_DATA_FILE, METADATA_FILE],
        });

        // Check if R script created the output file
        if (!fs.existsSync(outputFile)) {
          throw new Error(
            "R script did not produce output file (likely insufficient data for model fitting)"
          );
        }

        // Read results
        const outputJSON = fs.readFileSync(outputFile, "utf8");
        const rbmsOutput = JSON.parse(outputJSON);

        // Store phenology curves for this region
        if (rbmsOutput.phenology_curves) {
          regionalResults[species].regions[region] = {
            phenologyCurves: rbmsOutput.phenology_curves,
            dataQuality: {
              transectCount: regionTransects.length,
              totalVisits: speciesData.visits.length,
              totalCounts: speciesData.counts.length,
            },
          };
          console.log(`    ${region}: ✓ ${Object.keys(rbmsOutput.phenology_curves).length} years`);
          totalProcessed++;
        }

        // Clean up temp files
        fs.unlinkSync(visitsFile);
        fs.unlinkSync(countsFile);
        fs.unlinkSync(lengthsFile);
        fs.unlinkSync(outputFile);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`    ${region}: failed (${errorMessage})`);
        continue;
      }
    }

    // If no regions succeeded, remove the species
    if (Object.keys(regionalResults[species].regions).length === 0) {
      delete regionalResults[species];
    }
  }

  console.log(`\n  ✓ Successfully processed ${totalProcessed} species-region combinations`);

  if (Object.keys(regionalResults).length === 0) {
    console.warn("  Warning: No regional phenology curves calculated");
    return null;
  }

  // Step 6: Compile metadata
  const metadata: RegionalPhenologyData["metadata"] = {
    processingDate: new Date().toISOString(),
    baselineYear,
    regions: REGIONS,
    transectsByRegion: Object.fromEntries(
      REGIONS.map(region => [region, transectsByRegion[region].length])
    ),
    qualityCriteria: {
      minYearsActive: MIN_YEARS_ACTIVE,
      minVisitsPerYear: MIN_VISITS_PER_YEAR,
      minCountsPerSpecies: MIN_COUNTS_PER_SPECIES,
      minYearsPerSpecies: MIN_YEARS_PER_SPECIES,
      minTransectsPerRegion: 2,
    },
    method: "rbms (GAM flight curves with regional filtering)",
  };

  return {
    metadata,
    species: regionalResults,
    speciesList: Object.keys(regionalResults).sort(),
  };
}
