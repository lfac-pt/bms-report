import {
  annualHighlights,
  annualNetwork,
  compareSpeciesOnSharedTransects,
  municipalityGaps,
  speciesInYear,
} from "./annualHighlights";
import { TimelineData } from "../types/timelineData";
import { TransectStats } from "../types/transectStats";
import { monthlySpeciesAbundance, summarizeSpeciesPeriod } from "./annualResults";

const timeline: TimelineData = {
  years: [2019, 2021, 2022, 2024, 2025, 2026, 2027],
  transectsByYear: {},
  butterflyFrequencyByYear: {},
  transectDiversityByYear: {},
  observationsByYearDate: {
    2019: { "01/03/2019": [["old", "Pieris rapae", 1]] },
    2021: { "01/03/2021": [["old", "Pieris rapae", 1]] },
    2022: { "01/03/2022": [["old", "Pieris rapae", 1]] },
    2024: {
      "01/03/2024": [
        ["old", "Pieris rapae", 1],
        ["short", "Vanessa cardui", 1],
      ],
    },
    2025: {
      "01/03/2025": [
        ["old", "Euphydryas aurinia", 2],
        ["old", "Euchloe tagis", 0],
      ],
    },
    2026: {
      "02/05/2026": [
        ["new", "Euchloe tagis", 3],
        ["old", "Euphydryas aurinia", 5],
        ["old", "Pieris rapae", 2],
        ["short", "Unknown", 4],
      ],
      "30/03/2026": [
        ["new", "Euchloe tagis", 2],
        ["old", "Euphydryas aurinia", 4],
      ],
    },
    2027: {
      "01/03/2027": [
        ["new", "Euchloe tagis", 2],
        ["future", "Euphydryas aurinia", 20],
      ],
    },
  },
};
const metadata = [
  { transectId: "old", transectName: "Old route", isActive: false },
] as TransectStats[];

test("first records use positive validated observations, earlier seasons and chronological dates", () => {
  const results = annualHighlights(timeline, 2026, metadata);
  expect(results.discoveries.map(item => item.species)).toEqual(["Euchloe tagis"]);
  expect(results.discoveries[0]).toEqual({
    species: "Euchloe tagis",
    individuals: 5,
    transectIds: ["new"],
    firstDate: "30/03/2026",
  });
  expect(results.threatened.map(item => item.species)).toEqual(["Euchloe tagis"]);
  expect(speciesInYear(timeline, 2026).some(item => item.species === "Unknown")).toBe(false);
});

test("network uses observation years, includes missing metadata and counts distinct seasons", () => {
  const network = annualNetwork(timeline, 2026, metadata);
  expect(network).toHaveLength(3);
  const old = network.find(item => item.id === "old")!;
  expect(old.years).toEqual([2019, 2021, 2022, 2024, 2025, 2026]);
  expect(old.isVeteran).toBe(true);
  expect(old.visits).toBe(2);
  expect(old.speciesCount).toBe(2);
  expect(network.find(item => item.id === "short")?.isVeteran).toBe(false);
  expect(network.find(item => item.id === "new")?.isNew).toBe(true);
  expect(network.find(item => item.id === "new")?.metadata).toBeUndefined();
});

test("same-transect comparisons include all visits and exclude routes absent in one year", () => {
  expect(compareSpeciesOnSharedTransects(timeline, 2026, "Euphydryas aurinia")).toEqual({
    transects: 1,
    current: { individuals: 9, visits: 2 },
    previous: { individuals: 2, visits: 1 },
  });
  expect(summarizeSpeciesPeriod(timeline, 2026, "Euphydryas aurinia").individuals).toBe(9);
  expect(monthlySpeciesAbundance(timeline, 2026, "Euphydryas aurinia")).toEqual([
    4, 0, 5, 0, 0, 0, 0,
  ]);
});

test("municipality examples only include zero coverage and preserve Portuguese prepositions", () => {
  expect(
    municipalityGaps([
      { Concelho: "FIGUEIRA DA FOZ", transectCount: 0 },
      { Concelho: "COIMBRA", transectCount: 1 },
    ])
  ).toEqual(["Figueira da Foz"]);
});
