import moment from "moment";
import { Dataset } from "../types/dataset";

export function filterDataset(
  dataset: Dataset,
  targetYear: number,
  targetTransect: string | null,
  targetSection: string | null
): Dataset {
  return dataset.filter(entry => {
    const date = moment(entry.Date, "DD-MM-YYYY");

    return (
      date.year() === targetYear &&
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
    const date = moment(entry.Date, "DD-MM-YYYY");

    if (targetSpecies.length === 0 || targetSpecies.includes(entry["Preferred Species Name"])) {
      visitsPerMonthSets[date.month()].add(entry.Date);

      abundancyPerMonth[date.month()] += entry["Abundance count"];
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
    const date = moment(entry.Date, "DD-MM-YYYY");

    visitsPerMonthSets[date.month()].add(entry.Date);

    abundancyPerMonth[date.month()] += entry["Abundance count"];
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

export function getTransectStartYear(
  dataset: Dataset,
  targetTransect: string | null,
  targetSection: string | null
): number | null {
  const filteredDataset = dataset.filter(entry => {
    return (
      (!targetTransect || entry["Transect ID"] === targetTransect) &&
      (!targetSection || targetSection === entry["Section Name"])
    );
  });

  if (filteredDataset.length === 0) return null;

  let minYear = Infinity;
  for (const entry of filteredDataset) {
    const date = moment(entry.Date, "DD-MM-YYYY");
    const year = date.year();
    if (year < minYear) {
      minYear = year;
    }
  }

  return minYear === Infinity ? null : minYear;
}

export function getTransectYearsOfOperation(
  dataset: Dataset,
  targetTransect: string | null,
  targetSection: string | null
): number {
  const startYear = getTransectStartYear(dataset, targetTransect, targetSection);
  if (!startYear) return 0;

  const currentYear = new Date().getFullYear();
  return currentYear - startYear + 1;
}

export function getAverageVisitsPerYear(
  dataset: Dataset,
  targetTransect: string | null,
  targetSection: string | null
): number {
  const filteredDataset = dataset.filter(entry => {
    return (
      (!targetTransect || entry["Transect ID"] === targetTransect) &&
      (!targetSection || targetSection === entry["Section Name"])
    );
  });

  const totalVisits = getVisitsCount(filteredDataset);
  const yearsOfOperation = getTransectYearsOfOperation(dataset, targetTransect, targetSection);

  return yearsOfOperation > 0 ? totalVisits / yearsOfOperation : 0;
}

export function getNewSpeciesCount(
  dataset: Dataset,
  targetYear: number,
  targetTransect: string | null,
  targetSection: string | null
): number {
  // Get all species from target year
  const currentYearDataset = filterDataset(dataset, targetYear, targetTransect, targetSection);
  const currentYearSpecies = new Set(getAllSpecies(currentYearDataset));

  // Get all species from all previous years
  const previousYearsSpecies = new Set<string>();
  const filteredDataset = dataset.filter(entry => {
    const date = moment(entry.Date, "DD-MM-YYYY");
    return (
      date.year() < targetYear &&
      (!targetTransect || entry["Transect ID"] === targetTransect) &&
      (!targetSection || targetSection === entry["Section Name"])
    );
  });

  for (const species of getAllSpecies(filteredDataset)) {
    previousYearsSpecies.add(species);
  }

  // Count species in current year that are not in previous years
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
): { month: string; frequency: number } | null {
  const filteredDataset = filterDataset(dataset, targetYear, targetTransect, targetSection);

  if (filteredDataset.length === 0) return null;

  const visitsPerMonth = LABELS_MONTHS.map(() => new Set<string>());
  const speciesPerMonth = LABELS_MONTHS.map(() => new Set<string>());

  for (const entry of filteredDataset) {
    const date = moment(entry.Date, "DD-MM-YYYY");
    const monthIndex = date.month();

    visitsPerMonth[monthIndex].add(entry.Date);
    speciesPerMonth[monthIndex].add(entry["Preferred Species Name"]);
  }

  let maxFrequency = 0;
  let bestMonthIndex = 0;

  for (let i = 0; i < LABELS_MONTHS.length; i++) {
    const visits = visitsPerMonth[i].size;
    const species = speciesPerMonth[i].size;

    if (visits > 0) {
      const frequency = species / visits;
      if (frequency > maxFrequency) {
        maxFrequency = frequency;
        bestMonthIndex = i;
      }
    }
  }

  return {
    month: LABELS_MONTHS[bestMonthIndex],
    frequency: maxFrequency,
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
    const date = moment(entry.Date, "DD-MM-YYYY");
    const monthIndex = date.month();

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
