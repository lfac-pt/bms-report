/**
 * Regional Grassland Butterfly Index (GBI) processor
 * Calculates GBI separately for each climatic region with sufficient data
 */

import { calculateGBI } from "./gbi-processor";
import { getQualityFilteredTransects } from "./transect-stats-processor";
import { TransectStats } from "../../src/types/processing";
import type { RegionalGBICollection, RegionalGBIData } from "../../src/types/gbiData";
import {
  MIN_TRANSECTS_FOR_REGIONAL_GBI,
  MIN_YEARS_FOR_REGIONAL_GBI,
  BASELINE_YEAR,
} from "../../src/constants";

/**
 * Calculate regional GBI for each climatic region
 */
export async function calculateRegionalGBI(
  allData: Record<string, string>[],
  transects: TransectStats[],
  baselineYear: number = BASELINE_YEAR
): Promise<RegionalGBICollection> {
  console.log("\nCalculating Regional Grassland Butterfly Index (GBI)...");

  // Step 1: Get quality transects and filter to active ones
  const qualityTransects = getQualityFilteredTransects(transects);
  const activeQualityTransects = qualityTransects.filter(t => t.isActive);

  console.log(`  Total active quality transects: ${activeQualityTransects.length}`);

  // Step 2: Group transects by climatic region
  const transectsByRegion: Record<string, TransectStats[]> = {};

  for (const transect of activeQualityTransects) {
    const region = transect.climaticRegion || "Unknown";
    if (!transectsByRegion[region]) {
      transectsByRegion[region] = [];
    }
    transectsByRegion[region].push(transect);
  }

  const regionNames = Object.keys(transectsByRegion).sort();
  console.log(`  Regions found: ${regionNames.length}`);

  regionNames.forEach(region => {
    console.log(
      `    - ${region}: ${transectsByRegion[region].length} transect${transectsByRegion[region].length !== 1 ? "s" : ""}`
    );
  });

  // Step 3: Calculate GBI for each region with sufficient data
  const regions: Record<string, RegionalGBIData> = {};

  for (const region of regionNames) {
    const regionTransects = transectsByRegion[region];
    const transectCount = regionTransects.length;

    console.log(`\n  Processing region: ${region}`);
    console.log(`    Transects: ${transectCount}`);

    // Check if region has sufficient transects
    if (transectCount < MIN_TRANSECTS_FOR_REGIONAL_GBI) {
      console.log(
        `    Skipping: insufficient transects (minimum ${MIN_TRANSECTS_FOR_REGIONAL_GBI} required)`
      );
      continue;
    }

    // Filter allData to only include observations from this region's transects
    const regionTransectIds = new Set(regionTransects.map(t => t.transectId));
    const regionalData = allData.filter(row => regionTransectIds.has(row["Transect ID"]));

    console.log(`    Filtered data: ${regionalData.length} observations`);

    // Calculate GBI for this region
    const regionalGBI = await calculateGBI(regionalData, regionTransects, baselineYear);

    if (!regionalGBI) {
      console.log(`    Skipping: GBI calculation failed`);
      continue;
    }

    // Check if we have sufficient years
    const yearsCount = regionalGBI.years.length;
    if (yearsCount < MIN_YEARS_FOR_REGIONAL_GBI) {
      console.log(
        `    Skipping: insufficient years (${yearsCount}, minimum ${MIN_YEARS_FOR_REGIONAL_GBI} required)`
      );
      continue;
    }

    // Count species included in this region's GBI
    const speciesIncluded = regionalGBI.metadata.grasslandSpecies.length;

    console.log(`    ✓ Regional GBI calculated`);
    console.log(`      - Years: ${yearsCount}`);
    console.log(`      - Species: ${speciesIncluded}`);
    console.log(
      `      - Trend: ${regionalGBI.gbiTrend?.category || "N/A"} (${(regionalGBI.gbiTrend?.pc1 || 0).toFixed(1)}%/yr)`
    );

    // Store regional data
    regions[region] = {
      region,
      transectCount,
      transectIds: regionTransects.map(t => t.transectId),
      gbiByYear: regionalGBI.gbiByYear,
      years: regionalGBI.years,
      gbiTrend: regionalGBI.gbiTrend || null,
      dataQuality: {
        sufficientData: true,
        minTransectsRequired: MIN_TRANSECTS_FOR_REGIONAL_GBI,
        minYearsRequired: MIN_YEARS_FOR_REGIONAL_GBI,
        speciesIncluded,
      },
    };
  }

  const regionsWithGBI = Object.keys(regions).length;
  console.log(`\n  ✓ Regional GBI calculation complete`);
  console.log(`    Regions processed: ${regionsWithGBI}/${regionNames.length}`);

  // Step 4: Return collection
  return {
    regions,
    metadata: {
      calculatedAt: new Date().toISOString(),
      baselineYear,
      minimumTransects: MIN_TRANSECTS_FOR_REGIONAL_GBI,
      minimumYears: MIN_YEARS_FOR_REGIONAL_GBI,
    },
  };
}
