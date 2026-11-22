import { summarizeTimedCounts } from "./timedCounts";

const visit = (id: string, extra: Record<string, string> = {}) => ({
  "Visit Sample ID": id,
  Date: "10/04/2026",
  "Species groups": "Butterflies",
  "Private Sample?": "false",
  ...extra,
});
const observation = (id: string, extra: Record<string, string> = {}) => ({
  "Visit Sample ID": id,
  "Taxon group": "insect - butterfly",
  "Accepted species name": "Vanessa cardui",
  "Private Sample?": "false",
  Stage: "Adult",
  "Record status": "Accepted",
  Count: "3",
  ...extra,
});
const locate = (row: Record<string, string>) => ({ visit: row, municipality: "Águeda" });

test("includes explicit zero counts, counts each sample once and separates accepted species", () => {
  const rows = [
    observation("a"),
    observation("a", {
      "Accepted species name": "Euphydryas aurinia",
      "Record status": "Unconfirmed",
      Count: "2",
    }),
    observation("a", { "Accepted species name": "Pieris", Count: "4" }),
    observation("b", { "Accepted species name": "Vanessa cardui", Count: "1" }),
  ];
  const { summary, municipalities } = summarizeTimedCounts(
    [visit("a"), visit("a"), visit("b", { Date: "10/05/2026" }), visit("zero")].map(locate),
    rows,
    2026
  );
  expect(summary).toMatchObject({
    visits: 3,
    individuals: 10,
    species: 2,
    acceptedSpecies: 1,
    zeroCounts: 1,
    pendingRecords: 1,
  });
  expect(summary.months[1]).toMatchObject({ visits: 2, individuals: 9, zeroCounts: 1 });
  expect(summary.months[2].visits).toBe(1);
  expect(summary.months[0].visits).toBe(0);
  expect(municipalities["Águeda"]).toEqual([0, 2, 1, 0, 0, 0, 0]);
});

test("excludes private visits, off-season records, non-butterfly surveys and unlocated visits", () => {
  const inputs = [
    locate(visit("private", { "Private Sample?": "true" })),
    locate(visit("winter", { Date: "01/02/2026" })),
    locate(visit("previous", { Date: "01/04/2025" })),
    locate(visit("moths", { "Species groups": "Moths" })),
    locate(visit("unknown", { "Species groups": "" })),
    { visit: visit("unlocated"), municipality: "" },
    locate(visit("inferred", { "Species groups": "" })),
  ];
  const { summary } = summarizeTimedCounts(
    inputs,
    [observation("moths"), observation("inferred")],
    2026
  );
  expect(summary).toMatchObject({ visits: 1, individuals: 3, species: 1 });
});

test("filters non-adults, other insects, private/rejected records and orphan observations", () => {
  const rows = [
    observation("a", { Stage: "Larval web", Count: "30" }),
    observation("a", { "Taxon group": "insect - moth", Count: "20" }),
    observation("a", { "Record status": "Rejected", Count: "10" }),
    observation("a", { "Private Sample?": "true" }),
    observation("a", { Count: "-5" }),
    observation("a", { Count: "invalid" }),
    observation("orphan", { Count: "100" }),
    observation("a", { Stage: "", Count: "2" }),
  ];
  expect(summarizeTimedCounts([locate(visit("a"))], rows, 2026).summary).toMatchObject({
    visits: 1,
    individuals: 2,
    species: 1,
  });
});
