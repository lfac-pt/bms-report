import { Dataset, ButterflyRecord } from "../types/dataset";
import { NocturnalDataset } from "../types/nocturnalDataset";

/**
 * Adapts a nocturnal butterfly dataset to the diurnal dataset format
 * This allows us to reuse all existing logic with minimal changes
 * Only includes records with "Record substatus" === "Correct"
 */
export function adaptNocturnalDataset(nocturnalData: NocturnalDataset): Dataset {
  // Filter to only include records with substatus "Correct"
  const correctRecords = nocturnalData.filter(record => record["Record substatus"] === "Correct");

  return correctRecords.map((record): ButterflyRecord => {
    // Calculate total abundance from inside and outside counts
    const countInside =
      typeof record["Count inside"] === "number"
        ? record["Count inside"]
        : parseInt(record["Count inside"] || "0", 10);

    const countOutside =
      typeof record["Count outside"] === "number"
        ? record["Count outside"]
        : parseInt(record["Count outside"] || "0", 10);

    const totalAbundance =
      (isNaN(countInside) ? 0 : countInside) + (isNaN(countOutside) ? 0 : countOutside);

    return {
      "Transect Sample ID": record["Sample ID"],
      "Section Sample ID": record["Sample ID"], // Use same as transect since no sections
      "Transect ID": record.Location, // Use Location as transect identifier
      "Occurrence ID": record["Occurrence ID"],
      "Section Name": "", // No sections in nocturnal dataset
      Date: record.Date, // Keep original DD/MM/YYYY format
      "Species Name (entered)": record["Accepted species name"],
      "Preferred Species Name": record["Accepted species name"],
      "Taxon Group": "Lepidoptera", // Default for all moths
      "Walk % Sun": "",
      "Walk % Cloud": "",
      "Section % Sun": "",
      "Section % Cloud": "",
      Reliability: record["Verification status"],
      "Abundance count": totalAbundance,
      "Record status": record["Record status"],
      "Record substatus": record["Record substatus"],
      Comments: record.Comments,
      "Occurrence comment": record["Occurrence comment"],
      Family: record.Family, // Preserve family information for nocturnal butterflies
    };
  });
}

export type DatasetType = "diurnal" | "nocturnal";
