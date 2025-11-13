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

const LABELS_MONTHS = [
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
const SERIES_COLORS = [
  "#ea5545",
  "#f46a9b",
  "#ef9b20",
  "#edbf33",
  "#ede15b",
  "#bdcf32",
  "#87bc45",
  "#27aeef",
  "#b33dc6",
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
