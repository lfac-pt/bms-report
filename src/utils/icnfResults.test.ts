import { icnfIdentification, icnfResults } from "./icnfResults";
import { TimelineData } from "../types/timelineData";
import { TransectStats } from "../types/transectStats";

const route = (transectId: string, entidade: string, transectName: string) =>
  ({ transectId, entidade, transectName }) as TransectStats;
const routes = [
  route("a", " ICNF ", "Route A"),
  route("b", "", "ICNF Route B"),
  route("c", "Município", "ICNF collaborative route"),
  route("d", "ICNF", "Historical route"),
  route("e", "", "Other route"),
];
const timeline: TimelineData = {
  years: [2025, 2026],
  transectsByYear: {},
  butterflyFrequencyByYear: {},
  transectDiversityByYear: {},
  observationsByYearDate: {
    2025: { "01/03/2025": [["d", "Vanessa cardui", 8]] },
    2026: {
      "01/03/2026": [
        ["a", "Vanessa cardui", 2],
        ["a", "Pieris rapae", 3],
        ["b", "Vanessa cardui", 5],
        ["c", "Pieris rapae", 20],
        ["e", "Pieris rapae", 20],
      ],
      "02/03/2026": [["b", "Euchloe tagis", 1]],
    },
  },
};

test("ICNF attribution trusts the entity and only falls back to an explicit name when missing", () => {
  expect(icnfIdentification(routes[0])).toBe("entity");
  expect(icnfIdentification(routes[1])).toBe("name");
  expect(icnfIdentification(routes[2])).toBeNull();
  expect(icnfIdentification(routes[4])).toBeNull();
  expect(icnfIdentification(route("x", "", "Project ICNF route"))).toBe("name");
  expect(icnfIdentification(route("x", "", "NotICNF route"))).toBeNull();
});

test("institutional totals count transect-date visits and retain routes active only in earlier years", () => {
  const result = icnfResults(timeline, routes, 2026);
  expect(result.current).toEqual({ transects: 2, visits: 3, species: 3, individuals: 11 });
  expect(result.previous?.individuals).toBe(8);
  expect(result.network.map(item => item.id).sort()).toEqual(["a", "b"]);
  expect(result.nameMatches).toBe(1);
  expect(result.highlights.threatened.map(item => item.species)).toEqual(["Euchloe tagis"]);
  expect(icnfResults(timeline, [], 2026).current).toBeNull();
});
