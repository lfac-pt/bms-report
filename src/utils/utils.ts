import { Dataset } from "../types/dataset";
import endangeredSpeciesEurope from "./endangered_eu";
import endangeredSpeciesPT from "./endangered_pt";
import {
  getYearFromDateString,
  getMonthFromDateString,
  formatDatePortuguese,
  isDateBefore,
} from "./fastDateParser";

export function filterDataset(
  dataset: Dataset,
  targetYear: number | null,
  targetTransect: string | null,
  targetSection: string | null
): Dataset {
  return dataset.filter(entry => {
    const entryYear = getYearFromDateString(entry.Date);

    return (
      (!targetYear || entryYear === targetYear) &&
      (!targetTransect || entry["Transect ID"] === targetTransect) &&
      (!targetSection || targetSection === entry["Section Name"])
    );
  });
}

export function getAllSpecies(dataset: Dataset): string[] {
  const speciesSet = new Set<string>();

  for (const entry of dataset) {
    const species = entry["Preferred Species Name"];

    if (species.split(" ").length === 2) {
      speciesSet.add(species);
    }
  }

  return [...speciesSet];
}

export function getDiversityTotal(dataset: Dataset): number {
  return getAllSpecies(dataset).length;
}

export function getDiversityTotalWithGenus(dataset: Dataset): number {
  let species = new Set<string>();

  for (const entry of dataset) {
    species.add(entry["Preferred Species Name"]);
  }

  for (const sp of species) {
    const isSingleWord = sp.split(" ").length === 1;
    const isFamily = sp.endsWith("ae");
    const hasSpeciesInSet = Array.from(species).find(setSp => {
      return setSp.split(" ").length === 2 && setSp.includes(sp);
    });
    const shouldBeCounted = !isSingleWord || (isSingleWord && !isFamily && !hasSpeciesInSet);

    if (!shouldBeCounted) {
      species.delete(sp);
    }
  }

  return species.size;
}

export function getVisitsCount(dataset: Dataset): number {
  const dates = new Set<string>();

  for (const entry of dataset) {
    dates.add(entry.Date);
  }

  return dates.size;
}

export const LABELS_MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
export const SERIES_COLORS = [
  "#ea5545",
  "#27aeef",
  "#f46a9b",
  "#bdcf32",
  "#ef9b20",
  "#b33dc6",
  "#edbf33",
  "#87bc45",
  "#ede15b",
];

function abundancyPerMonthAllSpecies(
  dataset: Dataset,
  year: number,
  targetTransect: string | null,
  targetSpecies: string[],
  targetSection: string | null
): number[] {
  let abundancyPerMonth = LABELS_MONTHS.map(() => 0);
  const visitsPerMonthSets = LABELS_MONTHS.map(() => new Set<string>());
  const filteredDataset = filterDataset(dataset, year, targetTransect, targetSection);

  for (const entry of filteredDataset) {
    const monthIndex = getMonthFromDateString(entry.Date);

    if (targetSpecies.length === 0 || targetSpecies.includes(entry["Preferred Species Name"])) {
      visitsPerMonthSets[monthIndex].add(entry.Date);

      abundancyPerMonth[monthIndex] += entry["Abundance count"];
    }
  }

  const visitsPerMonth = visitsPerMonthSets.map(set => set.size);

  return abundancyPerMonth.map((count, index) => {
    return count / visitsPerMonth[index];
  });
}

export function getAbundancyPerMonthForSpecies(
  dataset: Dataset,
  targetSpecies: string[],
  yearsList: number[],
  targetTransect: string | null,
  targetSection: string | null
) {
  return {
    labels: LABELS_MONTHS,
    datasets: yearsList.map((year, index) => {
      return {
        label: year.toString(),
        data: abundancyPerMonthAllSpecies(
          dataset,
          year,
          targetTransect,
          targetSpecies,
          targetSection
        ),
        backgroundColor: SERIES_COLORS[index],
      };
    }),
  };
}

export function getAvgAbundancy(dataset: Dataset): string {
  let abundancyPerMonth = LABELS_MONTHS.map(() => 0);
  const visitsPerMonthSets = LABELS_MONTHS.map(() => new Set<string>());

  for (const entry of dataset) {
    const monthIndex = getMonthFromDateString(entry.Date);

    visitsPerMonthSets[monthIndex].add(entry.Date);

    abundancyPerMonth[monthIndex] += entry["Abundance count"];
  }

  const visitsPerMonth = visitsPerMonthSets.map(set => set.size);

  const avgAbundancyPerMonth = abundancyPerMonth
    .map((count, index) => {
      return count / visitsPerMonth[index];
    })
    .filter(num => num >= 0);

  return (
    avgAbundancyPerMonth.reduce((memo, num) => memo + num, 0) / avgAbundancyPerMonth.length
  ).toFixed(1);
}

export function getTransectFirstObservationDate(dataset: Dataset): string | null {
  let earliestDateString: string | null = null;
  for (const entry of dataset) {
    const dateString = entry.Date;
    if (!earliestDateString || isDateBefore(dateString, earliestDateString)) {
      earliestDateString = dateString;
    }
  }

  return earliestDateString ? formatDatePortuguese(earliestDateString) : null;
}

export function getTransectYearsOfOperation(dataset: Dataset): number {
  // Count unique monitoring seasons (years with March-September records)
  const filteredDataset = dataset.filter(entry => {
    // Only include records during monitoring season (March-September)
    const month = getMonthFromDateString(entry.Date);
    const inMonitoringSeason = month >= 2 && month <= 8;

    return inMonitoringSeason;
  });

  const seasonsSet = new Set<number>();
  for (const entry of filteredDataset) {
    const year = getYearFromDateString(entry.Date);
    seasonsSet.add(year);
  }

  return seasonsSet.size;
}

export function getAverageVisitsPerYear(dataset: Dataset): number {
  // Only count visits during monitoring season (March-September)
  const filteredDataset = dataset.filter(entry => {
    // Only include records during monitoring season
    const month = getMonthFromDateString(entry.Date);
    const inMonitoringSeason = month >= 2 && month <= 8;

    return inMonitoringSeason;
  });

  const totalVisits = getVisitsCount(filteredDataset);
  const seasonsCount = getTransectYearsOfOperation(dataset);

  return seasonsCount > 0 ? totalVisits / seasonsCount : 0;
}

export function getNewSpeciesCount(dataset: Dataset, targetYear: number): number {
  // Get all species from target year (all records, not just monitoring season)
  const currentYearDataset = dataset.filter(entry => {
    const year = getYearFromDateString(entry.Date);
    return year === targetYear;
  });
  const currentYearSpecies = new Set(getAllSpecies(currentYearDataset));

  // Get all species from all previous years (all records, not just monitoring season)
  const previousYearsSpecies = new Set<string>();
  const previousYearsDataset = dataset.filter(entry => {
    const year = getYearFromDateString(entry.Date);
    return year < targetYear;
  });

  for (const species of getAllSpecies(previousYearsDataset)) {
    previousYearsSpecies.add(species);
  }

  // Count species in current year that are not in any previous year (all-time new species)
  let newSpeciesCount = 0;
  for (const species of currentYearSpecies) {
    if (!previousYearsSpecies.has(species)) {
      newSpeciesCount++;
    }
  }

  return newSpeciesCount;
}

export function getAverageAbundancyForYear(
  dataset: Dataset,
  targetYear: number,
  targetTransect: string | null,
  targetSection: string | null
): number {
  const filteredDataset = filterDataset(dataset, targetYear, targetTransect, targetSection);
  const avgAbundancy = getAvgAbundancy(filteredDataset);
  return parseFloat(avgAbundancy);
}

export function getMostFrequentSpecies(
  dataset: Dataset,
  targetYear: number,
  targetTransect: string | null,
  targetSection: string | null
): { species: string; frequency: number } | null {
  const filteredDataset = filterDataset(dataset, targetYear, targetTransect, targetSection);
  const allSpecies = getAllSpecies(filteredDataset);
  const totalVisits = getVisitsCount(filteredDataset);

  if (totalVisits === 0 || allSpecies.length === 0) return null;

  let maxFrequency = 0;
  let mostFrequentSpecies = "";

  for (const species of allSpecies) {
    const visitsWithSpecies = new Set<string>();

    for (const entry of filteredDataset) {
      if (entry["Preferred Species Name"] === species) {
        visitsWithSpecies.add(entry.Date);
      }
    }

    const frequency = (visitsWithSpecies.size / totalVisits) * 100;

    if (frequency > maxFrequency) {
      maxFrequency = frequency;
      mostFrequentSpecies = species;
    }
  }

  return { species: mostFrequentSpecies, frequency: maxFrequency };
}

export function getMostAbundantSpecies(
  dataset: Dataset,
  targetYear: number,
  targetTransect: string | null,
  targetSection: string | null
): { species: string; abundance: number } | null {
  const filteredDataset = filterDataset(dataset, targetYear, targetTransect, targetSection);
  const allSpecies = getAllSpecies(filteredDataset);

  if (allSpecies.length === 0) return null;

  let maxAbundance = 0;
  let mostAbundantSpecies = "";

  for (const species of allSpecies) {
    let totalCount = 0;

    for (const entry of filteredDataset) {
      if (entry["Preferred Species Name"] === species) {
        totalCount += entry["Abundance count"];
      }
    }

    if (totalCount > maxAbundance) {
      maxAbundance = totalCount;
      mostAbundantSpecies = species;
    }
  }

  return { species: mostAbundantSpecies, abundance: maxAbundance };
}

export function getBestMonthForFrequency(
  dataset: Dataset,
  targetYear: number,
  targetTransect: string | null,
  targetSection: string | null
): { month: string; speciesCount: number } | null {
  const filteredDataset = filterDataset(dataset, targetYear, targetTransect, targetSection);

  if (filteredDataset.length === 0) return null;

  const speciesPerMonth = LABELS_MONTHS.map(() => new Set<string>());

  for (const entry of filteredDataset) {
    const monthIndex = getMonthFromDateString(entry.Date);

    speciesPerMonth[monthIndex].add(entry["Preferred Species Name"]);
  }

  let maxSpeciesCount = 0;
  let bestMonthIndex = 0;

  for (let i = 0; i < LABELS_MONTHS.length; i++) {
    const speciesCount = speciesPerMonth[i].size;

    if (speciesCount > maxSpeciesCount) {
      maxSpeciesCount = speciesCount;
      bestMonthIndex = i;
    }
  }

  return {
    month: LABELS_MONTHS[bestMonthIndex],
    speciesCount: maxSpeciesCount,
  };
}

export function getBestMonthForAbundancy(
  dataset: Dataset,
  targetYear: number,
  targetTransect: string | null,
  targetSection: string | null
): { month: string; abundance: number } | null {
  const filteredDataset = filterDataset(dataset, targetYear, targetTransect, targetSection);

  if (filteredDataset.length === 0) return null;

  const abundancyPerMonth = LABELS_MONTHS.map(() => 0);
  const visitsPerMonth = LABELS_MONTHS.map(() => new Set<string>());

  for (const entry of filteredDataset) {
    const monthIndex = getMonthFromDateString(entry.Date);

    visitsPerMonth[monthIndex].add(entry.Date);
    abundancyPerMonth[monthIndex] += entry["Abundance count"];
  }

  let maxAvgAbundance = 0;
  let bestMonthIndex = 0;

  for (let i = 0; i < LABELS_MONTHS.length; i++) {
    const visits = visitsPerMonth[i].size;
    if (visits > 0) {
      const avgAbundance = abundancyPerMonth[i] / visits;
      if (avgAbundance > maxAvgAbundance) {
        maxAvgAbundance = avgAbundance;
        bestMonthIndex = i;
      }
    }
  }

  return {
    month: LABELS_MONTHS[bestMonthIndex],
    abundance: maxAvgAbundance,
  };
}

export function endangeredSpeciesSummary(dataset: Dataset): any {
  const allSpecies = getAllSpecies(dataset);

  const endageredSpecies = [];

  for (const species of allSpecies) {
    if (endangeredSpeciesPT[species]) {
      endageredSpecies.push({
        species,
        status: endangeredSpeciesPT[species],
        geo: "eu",
      });
    } else if (endangeredSpeciesEurope[species]) {
      endageredSpecies.push({
        species,
        status: endangeredSpeciesEurope[species],
        geo: "eu",
      });
    }
  }

  return endageredSpecies;
}
