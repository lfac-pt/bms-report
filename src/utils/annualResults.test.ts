import {
  monitoringWeeks,
  timelineForWeek,
  monthlySpeciesAbundance,
  summarizeYear,
  summarizeSpeciesPeriod,
  timelineForMonth,
} from "./annualResults";
import { TimelineData } from "../types/timelineData";

const timeline: TimelineData = {
  years: [2025, 2026],
  transectsByYear: { 2026: ["a", "b"] },
  butterflyFrequencyByYear: {},
  transectDiversityByYear: {},
  observationsByYearDate: {
    2026: {
      "01/03/2026": [
        ["a", "Vanessa cardui", 3],
        ["a", "Vanessa cardui", 2],
        ["b", "Vanessa cardui", 0],
        ["b", "Unidentified", 4],
      ],
      "02/04/2026": [
        ["a", "Pieris rapae", 5],
        ["a", "Vanessa cardui", 1],
      ],
    },
  },
};

test("counts visits per transect and date without counting sections or species twice", () => {
  expect(summarizeYear(timeline, 2026)).toEqual({
    species: 2,
    individuals: 15,
    visits: 3,
    transects: 2,
  });
  expect(summarizeYear(timeline, 2025)).toBeNull();
});

test("isolates each month for the migration map and sums species across transects", () => {
  const march = timelineForMonth(timeline, 2026, 3);
  expect(Object.keys(march.observationsByYearDate[2026])).toEqual(["01/03/2026"]);
  expect(monthlySpeciesAbundance(timeline, 2026)).toEqual([5, 1, 0, 0, 0, 0, 0]);
  expect(Object.keys(timeline.observationsByYearDate[2026])).toHaveLength(2);
  expect(timelineForMonth(timeline, 2025, 3).observationsByYearDate[2025]).toEqual({});
});

test("weekly windows cover the season once, including month boundaries and the last day", () => {
  const weeks = monitoringWeeks(2026);
  expect(weeks).toHaveLength(31);
  expect(weeks[0].label).toBe("01/03 – 07/03");
  expect(weeks[30].label).toBe("27/09 – 30/09");
  const dates = [
    "07/03/2026",
    "08/03/2026",
    "31/03/2026",
    "01/04/2026",
    "30/09/2026",
    "01/10/2026",
  ];
  const input: TimelineData = {
    ...timeline,
    observationsByYearDate: {
      2026: Object.fromEntries(dates.map(date => [date, [["a", "Vanessa cardui", 1]]])),
    },
  };
  const included = weeks.flatMap((_, index) =>
    Object.keys(timelineForWeek(input, 2026, index).observationsByYearDate[2026])
  );
  expect(included).toEqual(dates.slice(0, -1));
  expect(Object.keys(timelineForWeek(input, 2026, 0).observationsByYearDate[2026])).toEqual([
    "07/03/2026",
  ]);
});

test("species summaries include visits without detections and aggregate sections", () => {
  const summary = summarizeSpeciesPeriod(timeline, 2026);
  expect(summary.individuals).toBe(6);
  expect(summary.visits).toBe(3);
  expect([...summary.visited]).toEqual(["a", "b"]);
  expect([...summary.counts.entries()]).toEqual([
    ["a", 6],
    ["b", 0],
  ]);
  expect(summarizeSpeciesPeriod(timeline, 2025).visits).toBe(0);
  const weeklyTotal = monitoringWeeks(2026).reduce(
    (sum, _, index) =>
      sum + summarizeSpeciesPeriod(timelineForWeek(timeline, 2026, index), 2026).individuals,
    0
  );
  expect(weeklyTotal).toBe(summary.individuals);
});
