import {
  calculateRows,
  getVisitsCountByYear,
  getAllSpecies,
} from "./AbsoluteFrequencyAndAbundancy";
import { Dataset } from "../../types/dataset";
import { parse } from "papaparse";
import * as fs from "fs";
import * as path from "path";
import { getYearFromDateString } from "../../utils/fastDateParser";

describe("AbsoluteFrequencyAndAbundancy with real test dataset", () => {
  let testDataset: Dataset;

  beforeAll(() => {
    // Load the real CSV file
    const csvPath = path.join(__dirname, "__fixtures__", "test-dataset.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");

    // Parse CSV
    const result = parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    testDataset = result.data as Dataset;
  });

  describe("Dataset validation", () => {
    it("should load the test dataset successfully", () => {
      expect(testDataset).toBeDefined();
      expect(testDataset.length).toBeGreaterThan(0);
    });

    it("should have expected structure", () => {
      const firstRecord = testDataset[0];
      expect(firstRecord).toHaveProperty("Preferred Species Name");
      expect(firstRecord).toHaveProperty("Date");
      expect(firstRecord).toHaveProperty("Abundance count");
      expect(firstRecord).toHaveProperty("Transect ID");
    });

    it("should contain only 2025 data", () => {
      const years = testDataset.map(record => {
        return getYearFromDateString(record.Date);
      });

      const uniqueYears = [...new Set(years)];
      expect(uniqueYears).toEqual([2025]);
    });
  });

  describe("getAllSpecies", () => {
    it("should extract all unique species with binomial names", () => {
      const species = getAllSpecies(testDataset);

      // These species have binomial names (genus + species)
      expect(species).toContain("Maniola jurtina");
      expect(species).toContain("Papilio machaon");
      expect(species).toContain("Plebejus argus");
      expect(species).toContain("Lycaena phlaeas");
      expect(species).toContain("Pieris rapae");
      expect(species).toContain("Iphiclides feisthamelii");
      expect(species).toContain("Gonepteryx rhamni");
      expect(species).toContain("Gonepteryx cleopatra");

      // Should have 8 unique species
      expect(species.length).toBe(8);
    });
  });

  describe("getVisitsCountByYear", () => {
    it("should count unique visit dates in 2025", () => {
      const visitsCount = getVisitsCountByYear(testDataset, 2025);

      // Based on the dataset:
      // - 2025-05-16
      // - 2025-05-21
      // - 2025-05-26
      // - 2025-06-29
      // Total: 4 unique dates
      expect(visitsCount).toBe(4);
    });

    it("should return 0 for years without data", () => {
      const visitsCount2024 = getVisitsCountByYear(testDataset, 2024);
      const visitsCount2026 = getVisitsCountByYear(testDataset, 2026);

      expect(visitsCount2024).toBe(0);
      expect(visitsCount2026).toBe(0);
    });
  });

  describe("calculateRows", () => {
    it("should calculate correct frequency and abundance for all species", () => {
      const rows = calculateRows(testDataset, [2025]);

      expect(rows.length).toBe(8); // 8 unique species

      // Maniola jurtina - appears on 2 dates (2025-05-16 and 2025-05-26)
      const maniolaRow = rows.find(r => r.species === "Maniola jurtina");
      expect(maniolaRow).toBeDefined();
      expect(maniolaRow![2025]).toEqual({
        display: "50% / 4", // 2 out of 4 visits = 50%, total abundance = 2 + 2 = 4
        frequencyAbs: 2,
        abundancy: 4,
      });

      // Papilio machaon - appears on 1 date (2025-05-21)
      const papilioRow = rows.find(r => r.species === "Papilio machaon");
      expect(papilioRow).toBeDefined();
      expect(papilioRow![2025]).toEqual({
        display: "25% / 2", // 1 out of 4 visits = 25%, abundance = 2
        frequencyAbs: 1,
        abundancy: 2,
      });

      // Pieris rapae - appears on 1 date (2025-05-26) but in 2 different sections
      const pierisRow = rows.find(r => r.species === "Pieris rapae");
      expect(pierisRow).toBeDefined();
      expect(pierisRow![2025]).toEqual({
        display: "25% / 2", // 1 out of 4 visits = 25%, total abundance = 1 + 1 = 2
        frequencyAbs: 1,
        abundancy: 2,
      });

      // Plebejus argus - appears on 1 date (2025-05-26)
      const plebejusRow = rows.find(r => r.species === "Plebejus argus");
      expect(plebejusRow).toBeDefined();
      expect(plebejusRow![2025]).toEqual({
        display: "25% / 1", // 1 out of 4 visits = 25%, abundance = 1
        frequencyAbs: 1,
        abundancy: 1,
      });

      // Lycaena phlaeas - appears on 1 date (2025-05-26)
      const lycaenaRow = rows.find(r => r.species === "Lycaena phlaeas");
      expect(lycaenaRow).toBeDefined();
      expect(lycaenaRow![2025]).toEqual({
        display: "25% / 1",
        frequencyAbs: 1,
        abundancy: 1,
      });

      // Iphiclides feisthamelii - appears on 1 date (2025-05-26)
      const iphiclidesRow = rows.find(r => r.species === "Iphiclides feisthamelii");
      expect(iphiclidesRow).toBeDefined();
      expect(iphiclidesRow![2025]).toEqual({
        display: "25% / 1",
        frequencyAbs: 1,
        abundancy: 1,
      });

      // Gonepteryx rhamni - appears on 1 date (2025-06-29)
      const gonepteryxRhamniRow = rows.find(r => r.species === "Gonepteryx rhamni");
      expect(gonepteryxRhamniRow).toBeDefined();
      expect(gonepteryxRhamniRow![2025]).toEqual({
        display: "25% / 1",
        frequencyAbs: 1,
        abundancy: 1,
      });

      // Gonepteryx cleopatra - appears on 1 date (2025-06-29)
      const gonepteryxCleopatraRow = rows.find(r => r.species === "Gonepteryx cleopatra");
      expect(gonepteryxCleopatraRow).toBeDefined();
      expect(gonepteryxCleopatraRow![2025]).toEqual({
        display: "25% / 1",
        frequencyAbs: 1,
        abundancy: 1,
      });
    });

    it("should not include change columns for single year", () => {
      const rows = calculateRows(testDataset, [2025]);

      rows.forEach(row => {
        expect(row.abundancyChange).toBeUndefined();
        expect(row.frequencyChange).toBeUndefined();
      });
    });

    it("should have all rows with proper structure", () => {
      const rows = calculateRows(testDataset, [2025]);

      rows.forEach(row => {
        expect(row).toHaveProperty("key");
        expect(row).toHaveProperty("species");
        expect(row[2025]).toBeDefined();
        expect(row[2025]).toHaveProperty("display");
        expect(row[2025]).toHaveProperty("frequencyAbs");
        expect(row[2025]).toHaveProperty("abundancy");
      });
    });

    it("should correctly handle species appearing on same date in different sections", () => {
      // Pieris rapae appears twice on 2025-05-26 (in S3 and S5)
      // This should count as 1 visit (same date) but abundance = 2 (sum of both)
      const rows = calculateRows(testDataset, [2025]);
      const pierisRow = rows.find(r => r.species === "Pieris rapae");

      expect(pierisRow).toBeDefined();
      expect(pierisRow![2025].frequencyAbs).toBe(1); // Same date = 1 visit
      expect(pierisRow![2025].abundancy).toBe(2); // 1 + 1 = 2 individuals
    });
  });

  describe("Data integrity checks", () => {
    it("should sum all abundances correctly", () => {
      const rows = calculateRows(testDataset, [2025]);

      const totalAbundance = rows.reduce((sum, row) => {
        return sum + row[2025].abundancy;
      }, 0);

      // Total from dataset:
      // Maniola jurtina: 4
      // Papilio machaon: 2
      // Plebejus argus: 1
      // Lycaena phlaeas: 1
      // Pieris rapae: 2
      // Iphiclides feisthamelii: 1
      // Gonepteryx rhamni: 1
      // Gonepteryx cleopatra: 1
      // Total: 13
      expect(totalAbundance).toBe(13);
    });

    it("should have frequency percentages that make sense", () => {
      const rows = calculateRows(testDataset, [2025]);

      rows.forEach(row => {
        const yearData = row[2025];
        const frequencyPercent = parseInt(yearData.display.split("%")[0]);

        // Frequency should be between 0 and 100
        expect(frequencyPercent).toBeGreaterThanOrEqual(0);
        expect(frequencyPercent).toBeLessThanOrEqual(100);

        // For 4 total visits, valid percentages are 0%, 25%, 50%, 75%, 100%
        expect([0, 25, 50, 75, 100]).toContain(frequencyPercent);
      });
    });

    it("should have non-zero abundances for all present species", () => {
      const rows = calculateRows(testDataset, [2025]);

      rows.forEach(row => {
        const yearData = row[2025];
        expect(yearData.abundancy).toBeGreaterThan(0);
      });
    });
  });
});
