import {
  calculateRows,
  getVisitsCountByYear,
  getAllSpecies,
  calculateYearOverYearChanges,
} from "./AbsoluteFrequencyAndAbundancy";
import { Dataset, ButterflyRecord } from "../../types/dataset";

// Helper function to create mock butterfly records
const createMockRecord = (
  date: string,
  species: string,
  abundanceCount: number
): ButterflyRecord => ({
  "Transect Sample ID": "T1",
  "Section Sample ID": "S1",
  "Transect ID": "T1",
  "Occurrence ID": "O1",
  "Section Name": "Section 1",
  Date: date,
  "Species Name (entered)": species,
  "Preferred Species Name": species,
  "Taxon Group": "Butterfly",
  "Walk % Sun": "80",
  "Walk % Cloud": "20",
  "Section % Sun": "80",
  "Section % Cloud": "20",
  Reliability: "High",
  "Abundance count": abundanceCount,
  "Record status": "Verified",
  "Record substatus": "Active",
  Comments: "",
  "Occurrence comment": "",
});

describe("AbsoluteFrequencyAndAbundancy", () => {
  describe("getVisitsCountByYear", () => {
    it("should return 0 for empty dataset", () => {
      const result = getVisitsCountByYear([], 2023);
      expect(result).toBe(0);
    });

    it("should count unique dates for a given year", () => {
      const dataset: Dataset = [
        createMockRecord("2023-01-01", "Pieris rapae", 5),
        createMockRecord("2023-01-01", "Vanessa atalanta", 3),
        createMockRecord("2023-01-02", "Pieris rapae", 2),
        createMockRecord("2022-01-01", "Pieris rapae", 4),
      ];

      expect(getVisitsCountByYear(dataset, 2023)).toBe(2); // 2 unique dates in 2023
      expect(getVisitsCountByYear(dataset, 2022)).toBe(1); // 1 unique date in 2022
    });

    it("should return 0 for year with no data", () => {
      const dataset: Dataset = [createMockRecord("2023-01-01", "Pieris rapae", 5)];
      expect(getVisitsCountByYear(dataset, 2024)).toBe(0);
    });
  });

  describe("getAllSpecies", () => {
    it("should return empty array for empty dataset", () => {
      const result = getAllSpecies([]);
      expect(result).toEqual([]);
    });

    it("should return unique species with binomial names only", () => {
      const dataset: Dataset = [
        createMockRecord("2023-01-01", "Pieris rapae", 5),
        createMockRecord("2023-01-01", "Pieris rapae", 3),
        createMockRecord("2023-01-02", "Vanessa atalanta", 2),
        createMockRecord("2023-01-03", "Single", 1), // Should be excluded (not binomial)
      ];

      const result = getAllSpecies(dataset);
      expect(result).toHaveLength(2);
      expect(result).toContain("Pieris rapae");
      expect(result).toContain("Vanessa atalanta");
      expect(result).not.toContain("Single");
    });

    it("should deduplicate species", () => {
      const dataset: Dataset = [
        createMockRecord("2023-01-01", "Pieris rapae", 5),
        createMockRecord("2023-01-02", "Pieris rapae", 3),
        createMockRecord("2023-01-03", "Pieris rapae", 2),
      ];

      const result = getAllSpecies(dataset);
      expect(result).toEqual(["Pieris rapae"]);
    });
  });

  describe("calculateYearOverYearChanges", () => {
    it("should return null for single year", () => {
      const dataByYear = {
        2023: {
          totalVisits: 10,
          frequencyMap: { "Pieris rapae": new Set(["2023-01-01"]) },
          abundancyMap: { "Pieris rapae": 5 },
        },
      };

      const result = calculateYearOverYearChanges("Pieris rapae", [2023], dataByYear);
      expect(result).toBeNull();
    });

    it("should calculate positive abundance change", () => {
      const dataByYear = {
        2022: {
          totalVisits: 10,
          frequencyMap: { "Pieris rapae": new Set(["2022-01-01", "2022-01-02"]) },
          abundancyMap: { "Pieris rapae": 10 },
        },
        2023: {
          totalVisits: 10,
          frequencyMap: { "Pieris rapae": new Set(["2023-01-01", "2023-01-02"]) },
          abundancyMap: { "Pieris rapae": 20 },
        },
      };

      const result = calculateYearOverYearChanges("Pieris rapae", [2022, 2023], dataByYear);

      expect(result).not.toBeNull();
      expect(result!.abundancyChange).toEqual({
        display: "+100%",
        percentChange: 100,
      });
    });

    it("should calculate negative abundance change", () => {
      const dataByYear = {
        2022: {
          totalVisits: 10,
          frequencyMap: { "Pieris rapae": new Set(["2022-01-01", "2022-01-02"]) },
          abundancyMap: { "Pieris rapae": 20 },
        },
        2023: {
          totalVisits: 10,
          frequencyMap: { "Pieris rapae": new Set(["2023-01-01", "2023-01-02"]) },
          abundancyMap: { "Pieris rapae": 10 },
        },
      };

      const result = calculateYearOverYearChanges("Pieris rapae", [2022, 2023], dataByYear);

      expect(result).not.toBeNull();
      expect(result!.abundancyChange).toEqual({
        display: "-50%",
        percentChange: -50,
      });
    });

    it("should return NA for species only in current year", () => {
      const dataByYear = {
        2022: {
          totalVisits: 10,
          frequencyMap: {},
          abundancyMap: {},
        },
        2023: {
          totalVisits: 10,
          frequencyMap: { "Pieris rapae": new Set(["2023-01-01"]) },
          abundancyMap: { "Pieris rapae": 10 },
        },
      };

      const result = calculateYearOverYearChanges("Pieris rapae", [2022, 2023], dataByYear);

      expect(result).not.toBeNull();
      expect(result!.abundancyChange).toEqual({
        display: "NA",
        percentChange: null,
      });
      expect(result!.frequencyChange).toEqual({
        display: "NA",
        percentChange: null,
      });
    });

    it("should return -100% for species that disappeared", () => {
      const dataByYear = {
        2022: {
          totalVisits: 10,
          frequencyMap: { "Pieris rapae": new Set(["2022-01-01"]) },
          abundancyMap: { "Pieris rapae": 10 },
        },
        2023: {
          totalVisits: 10,
          frequencyMap: {},
          abundancyMap: {},
        },
      };

      const result = calculateYearOverYearChanges("Pieris rapae", [2022, 2023], dataByYear);

      expect(result).not.toBeNull();
      expect(result!.abundancyChange).toEqual({
        display: "-100%",
        percentChange: -100,
      });
      expect(result!.frequencyChange).toEqual({
        display: "-100%",
        percentChange: -100,
      });
    });

    it("should calculate positive frequency change as absolute difference", () => {
      const dataByYear = {
        2022: {
          totalVisits: 10,
          // Seen on 5/10 visits = 50%
          frequencyMap: {
            "Pieris rapae": new Set([
              "2022-01-01",
              "2022-01-02",
              "2022-01-03",
              "2022-01-04",
              "2022-01-05",
            ]),
          },
          abundancyMap: { "Pieris rapae": 10 },
        },
        2023: {
          totalVisits: 10,
          // Seen on 8/10 visits = 80%
          frequencyMap: {
            "Pieris rapae": new Set([
              "2023-01-01",
              "2023-01-02",
              "2023-01-03",
              "2023-01-04",
              "2023-01-05",
              "2023-01-06",
              "2023-01-07",
              "2023-01-08",
            ]),
          },
          abundancyMap: { "Pieris rapae": 10 },
        },
      };

      const result = calculateYearOverYearChanges("Pieris rapae", [2022, 2023], dataByYear);

      expect(result).not.toBeNull();
      // Frequency went from 50% to 80%, so change should be +30%
      expect(result!.frequencyChange).toEqual({
        display: "+30%",
        percentChange: 30,
      });
    });

    it("should calculate negative frequency change as absolute difference", () => {
      const dataByYear = {
        2022: {
          totalVisits: 10,
          // Seen on 8/10 visits = 80%
          frequencyMap: {
            "Pieris rapae": new Set([
              "2022-01-01",
              "2022-01-02",
              "2022-01-03",
              "2022-01-04",
              "2022-01-05",
              "2022-01-06",
              "2022-01-07",
              "2022-01-08",
            ]),
          },
          abundancyMap: { "Pieris rapae": 10 },
        },
        2023: {
          totalVisits: 10,
          // Seen on 5/10 visits = 50%
          frequencyMap: {
            "Pieris rapae": new Set([
              "2023-01-01",
              "2023-01-02",
              "2023-01-03",
              "2023-01-04",
              "2023-01-05",
            ]),
          },
          abundancyMap: { "Pieris rapae": 10 },
        },
      };

      const result = calculateYearOverYearChanges("Pieris rapae", [2022, 2023], dataByYear);

      expect(result).not.toBeNull();
      // Frequency went from 80% to 50%, so change should be -30%
      expect(result!.frequencyChange).toEqual({
        display: "-30%",
        percentChange: -30,
      });
    });

    it("should handle zero frequency change", () => {
      const dataByYear = {
        2022: {
          totalVisits: 10,
          frequencyMap: { "Pieris rapae": new Set(["2022-01-01", "2022-01-02"]) },
          abundancyMap: { "Pieris rapae": 10 },
        },
        2023: {
          totalVisits: 10,
          frequencyMap: { "Pieris rapae": new Set(["2023-01-01", "2023-01-02"]) },
          abundancyMap: { "Pieris rapae": 20 },
        },
      };

      const result = calculateYearOverYearChanges("Pieris rapae", [2022, 2023], dataByYear);

      expect(result).not.toBeNull();
      expect(result!.frequencyChange).toEqual({
        display: "0%",
        percentChange: 0,
      });
    });
  });

  describe("calculateRows", () => {
    it("should return empty array for empty dataset", () => {
      const result = calculateRows([], [2023]);
      expect(result).toEqual([]);
    });

    it("should calculate frequency and abundancy for single year", () => {
      const dataset: Dataset = [
        createMockRecord("2023-01-01", "Pieris rapae", 5),
        createMockRecord("2023-01-01", "Vanessa atalanta", 3),
        createMockRecord("2023-01-02", "Pieris rapae", 2),
      ];

      const result = calculateRows(dataset, [2023]);

      expect(result).toHaveLength(2);

      const pierislRow = result.find(r => r.species === "Pieris rapae");
      expect(pierislRow).toBeDefined();
      expect(pierislRow![2023]).toEqual({
        display: "100% / 7", // Seen on 2/2 visits (100%), total abundance 7
        frequencyAbs: 2,
        abundancy: 7,
      });

      const vanessaRow = result.find(r => r.species === "Vanessa atalanta");
      expect(vanessaRow).toBeDefined();
      expect(vanessaRow![2023]).toEqual({
        display: "50% / 3", // Seen on 1/2 visits (50%), total abundance 3
        frequencyAbs: 1,
        abundancy: 3,
      });
    });

    it("should not include change columns for single year", () => {
      const dataset: Dataset = [createMockRecord("2023-01-01", "Pieris rapae", 5)];

      const result = calculateRows(dataset, [2023]);

      expect(result[0].abundancyChange).toBeUndefined();
      expect(result[0].frequencyChange).toBeUndefined();
    });

    it("should calculate year-over-year changes for multiple years", () => {
      const dataset: Dataset = [
        // Year 2022: Pieris rapae seen on 2 visits with total abundance 10
        createMockRecord("2022-01-01", "Pieris rapae", 5),
        createMockRecord("2022-01-02", "Pieris rapae", 5),
        // Year 2023: Pieris rapae seen on 2 visits with total abundance 20
        createMockRecord("2023-01-01", "Pieris rapae", 10),
        createMockRecord("2023-01-02", "Pieris rapae", 10),
      ];

      const result = calculateRows(dataset, [2022, 2023]);
      const row = result.find(r => r.species === "Pieris rapae");

      expect(row).toBeDefined();
      expect(row!.abundancyChange).toEqual({
        display: "+100%", // From 10 to 20 = 100% increase
        percentChange: 100,
      });
      expect(row!.frequencyChange).toEqual({
        display: "0%", // From 100% to 100% = 0% change
        percentChange: 0,
      });
    });

    it("should show NA for species only in current year", () => {
      const dataset: Dataset = [
        createMockRecord("2022-01-01", "Pieris rapae", 5),
        createMockRecord("2023-01-01", "Pieris rapae", 5),
        createMockRecord("2023-01-01", "Vanessa atalanta", 3), // New in 2023
      ];

      const result = calculateRows(dataset, [2022, 2023]);
      const vanessaRow = result.find(r => r.species === "Vanessa atalanta");

      expect(vanessaRow).toBeDefined();
      expect(vanessaRow!.abundancyChange).toEqual({
        display: "NA",
        percentChange: null,
      });
      expect(vanessaRow!.frequencyChange).toEqual({
        display: "NA",
        percentChange: null,
      });
    });

    it("should show -100% for species that disappeared", () => {
      const dataset: Dataset = [
        createMockRecord("2022-01-01", "Pieris rapae", 5),
        createMockRecord("2022-01-02", "Vanessa atalanta", 3), // Only in 2022
        createMockRecord("2023-01-01", "Pieris rapae", 5),
      ];

      const result = calculateRows(dataset, [2022, 2023]);
      const vanessaRow = result.find(r => r.species === "Vanessa atalanta");

      expect(vanessaRow).toBeDefined();
      expect(vanessaRow!.abundancyChange).toEqual({
        display: "-100%",
        percentChange: -100,
      });
      expect(vanessaRow!.frequencyChange).toEqual({
        display: "-100%",
        percentChange: -100,
      });
    });

    it("should calculate frequency change as absolute difference in percentage points", () => {
      const dataset: Dataset = [
        // Year 2022: 10 total visits, species seen on 5 visits (50%)
        createMockRecord("2022-01-01", "Pieris rapae", 1),
        createMockRecord("2022-01-02", "Pieris rapae", 1),
        createMockRecord("2022-01-03", "Pieris rapae", 1),
        createMockRecord("2022-01-04", "Pieris rapae", 1),
        createMockRecord("2022-01-05", "Pieris rapae", 1),
        createMockRecord("2022-01-06", "Vanessa atalanta", 1),
        createMockRecord("2022-01-07", "Vanessa atalanta", 1),
        createMockRecord("2022-01-08", "Vanessa atalanta", 1),
        createMockRecord("2022-01-09", "Vanessa atalanta", 1),
        createMockRecord("2022-01-10", "Vanessa atalanta", 1),
        // Year 2023: 10 total visits, species seen on 8 visits (80%)
        createMockRecord("2023-01-01", "Pieris rapae", 1),
        createMockRecord("2023-01-02", "Pieris rapae", 1),
        createMockRecord("2023-01-03", "Pieris rapae", 1),
        createMockRecord("2023-01-04", "Pieris rapae", 1),
        createMockRecord("2023-01-05", "Pieris rapae", 1),
        createMockRecord("2023-01-06", "Pieris rapae", 1),
        createMockRecord("2023-01-07", "Pieris rapae", 1),
        createMockRecord("2023-01-08", "Pieris rapae", 1),
        createMockRecord("2023-01-09", "Vanessa atalanta", 1),
        createMockRecord("2023-01-10", "Vanessa atalanta", 1),
      ];

      const result = calculateRows(dataset, [2022, 2023]);
      const row = result.find(r => r.species === "Pieris rapae");

      expect(row).toBeDefined();
      // Frequency went from 50% to 80%, so change should be +30%
      expect(row!.frequencyChange).toEqual({
        display: "+30%",
        percentChange: 30,
      });
    });

    it("should handle negative frequency changes", () => {
      const dataset: Dataset = [
        // Year 2022: 10 visits, species seen on 8 (80%)
        createMockRecord("2022-01-01", "Pieris rapae", 1),
        createMockRecord("2022-01-02", "Pieris rapae", 1),
        createMockRecord("2022-01-03", "Pieris rapae", 1),
        createMockRecord("2022-01-04", "Pieris rapae", 1),
        createMockRecord("2022-01-05", "Pieris rapae", 1),
        createMockRecord("2022-01-06", "Pieris rapae", 1),
        createMockRecord("2022-01-07", "Pieris rapae", 1),
        createMockRecord("2022-01-08", "Pieris rapae", 1),
        createMockRecord("2022-01-09", "Vanessa atalanta", 1),
        createMockRecord("2022-01-10", "Vanessa atalanta", 1),
        // Year 2023: 10 visits, species seen on 5 (50%)
        createMockRecord("2023-01-01", "Pieris rapae", 1),
        createMockRecord("2023-01-02", "Pieris rapae", 1),
        createMockRecord("2023-01-03", "Pieris rapae", 1),
        createMockRecord("2023-01-04", "Pieris rapae", 1),
        createMockRecord("2023-01-05", "Pieris rapae", 1),
        createMockRecord("2023-01-06", "Vanessa atalanta", 1),
        createMockRecord("2023-01-07", "Vanessa atalanta", 1),
        createMockRecord("2023-01-08", "Vanessa atalanta", 1),
        createMockRecord("2023-01-09", "Vanessa atalanta", 1),
        createMockRecord("2023-01-10", "Vanessa atalanta", 1),
      ];

      const result = calculateRows(dataset, [2022, 2023]);
      const row = result.find(r => r.species === "Pieris rapae");

      expect(row).toBeDefined();
      // Frequency went from 80% to 50%, so change should be -30%
      expect(row!.frequencyChange).toEqual({
        display: "-30%",
        percentChange: -30,
      });
    });

    it("should handle species with zero abundancy in previous year", () => {
      const dataset: Dataset = [
        createMockRecord("2022-01-01", "Vanessa atalanta", 5),
        createMockRecord("2023-01-01", "Pieris rapae", 10),
        createMockRecord("2023-01-02", "Vanessa atalanta", 5),
      ];

      const result = calculateRows(dataset, [2022, 2023]);
      const pierisRow = result.find(r => r.species === "Pieris rapae");

      expect(pierisRow).toBeDefined();
      expect(pierisRow!.abundancyChange).toEqual({
        display: "NA",
        percentChange: null,
      });
    });

    it("should calculate data for multiple years correctly", () => {
      const dataset: Dataset = [
        createMockRecord("2021-01-01", "Pieris rapae", 5),
        createMockRecord("2022-01-01", "Pieris rapae", 10),
        createMockRecord("2023-01-01", "Pieris rapae", 15),
      ];

      const result = calculateRows(dataset, [2021, 2022, 2023]);
      const row = result.find(r => r.species === "Pieris rapae");

      expect(row).toBeDefined();
      expect(row![2021]).toBeDefined();
      expect(row![2022]).toBeDefined();
      expect(row![2023]).toBeDefined();

      // Change should be between last two years (2022 to 2023)
      expect(row!.abundancyChange).toEqual({
        display: "+50%", // From 10 to 15 = 50% increase
        percentChange: 50,
      });
    });
  });
});
