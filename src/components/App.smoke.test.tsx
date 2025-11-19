import { render, screen, waitFor } from "@testing-library/react";
import { DatasetTypeProvider } from "../contexts/DatasetTypeContext";
import App from "./App";
import Papa from "papaparse";
import fs from "fs";
import path from "path";
import { calculateRows, getAllSpecies, getVisitsCountByYear } from "./charts/AbsoluteFrequencyAndAbundancy";
import { Dataset } from "../types/dataset";

// Mock window.matchMedia for Ant Design components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Read the test CSV file
const testDatasetPath = path.join(__dirname, "__fixtures__", "smoke-test-dataset.csv");
const testDatasetCSV = fs.readFileSync(testDatasetPath, "utf-8");

/**
 * Comprehensive smoke test for the BMS Report application.
 *
 * This test validates critical application workflows:
 * 1. CSV parsing and data loading
 * 2. Data processing and calculations
 * 3. Multi-year and multi-transect data handling
 * 4. Core component rendering
 */
describe("App Smoke Test - Full Application Workflow", () => {
  describe("CSV Parsing and Data Loading", () => {
    it("should successfully parse the test dataset CSV", () => {
      const parseResult = Papa.parse(testDatasetCSV, {
        header: true,
        skipEmptyLines: true,
      });

      expect(parseResult.errors).toHaveLength(0);
      expect(parseResult.data.length).toBe(80);

      // Verify CSV has expected columns
      const firstRecord = parseResult.data[0] as any;
      expect(firstRecord).toHaveProperty("Transect Sample ID");
      expect(firstRecord).toHaveProperty("Transect ID");
      expect(firstRecord).toHaveProperty("Section Name");
      expect(firstRecord).toHaveProperty("Date");
      expect(firstRecord).toHaveProperty("Preferred Species Name");
      expect(firstRecord).toHaveProperty("Abundance count");
    });

    it("should contain data from both transects (TA and TB)", () => {
      const parseResult = Papa.parse(testDatasetCSV, { header: true, skipEmptyLines: true });
      const data = parseResult.data as any[];

      const transects = new Set(data.map((row: any) => row["Transect ID"]));
      expect(transects.has("TA")).toBe(true);
      expect(transects.has("TB")).toBe(true);
      expect(transects.size).toBe(2);
    });

    it("should contain data from both years (2022 and 2023)", () => {
      const parseResult = Papa.parse(testDatasetCSV, { header: true, skipEmptyLines: true });
      const data = parseResult.data as any[];

      const years = new Set(
        data.map((row: any) => {
          const dateParts = row.Date.split("/");
          return parseInt(dateParts[2]);
        })
      );

      expect(years.has(2022)).toBe(true);
      expect(years.has(2023)).toBe(true);
      expect(years.size).toBe(2);
    });

    it("should have equal distribution of records across transects", () => {
      const parseResult = Papa.parse(testDatasetCSV, { header: true, skipEmptyLines: true });
      const data = parseResult.data as any[];

      const transectA = data.filter((row: any) => row["Transect ID"] === "TA");
      const transectB = data.filter((row: any) => row["Transect ID"] === "TB");

      expect(transectA.length).toBe(40);
      expect(transectB.length).toBe(40);
    });
  });

  describe("Data Processing Functions", () => {
    let testDataset: Dataset;

    beforeAll(() => {
      const parseResult = Papa.parse(testDatasetCSV, { header: true, skipEmptyLines: true });
      testDataset = (parseResult.data as any[]).map(row => ({
        ...row,
        "Abundance count": parseInt(row["Abundance count"]),
      })) as Dataset;
    });

    it("should correctly count visits per year", () => {
      const visits2022 = getVisitsCountByYear(testDataset, 2022);
      const visits2023 = getVisitsCountByYear(testDataset, 2023);

      expect(visits2022).toBeGreaterThan(0);
      expect(visits2023).toBeGreaterThan(0);

      // Based on our test data structure, both years should have multiple visits
      expect(visits2022).toBeGreaterThanOrEqual(5);
      expect(visits2023).toBeGreaterThanOrEqual(5);
    });

    it("should correctly identify all species", () => {
      const allSpecies = getAllSpecies(testDataset);

      expect(allSpecies.length).toBeGreaterThan(0);
      expect(allSpecies).toContain("Pieris rapae");
      expect(allSpecies).toContain("Vanessa atalanta");
      expect(allSpecies).toContain("Pararge aegeria");
      expect(allSpecies).toContain("Aglais io");
      expect(allSpecies).toContain("Lycaena phlaeas");

      // Transect B species
      expect(allSpecies).toContain("Pieris brassicae");
      expect(allSpecies).toContain("Colias crocea");
      expect(allSpecies).toContain("Maniola jurtina");

      // Should have exactly 8 unique species
      expect(allSpecies.length).toBe(8);
    });

    it("should calculate frequency and abundancy correctly", () => {
      const rows = calculateRows(testDataset, [2022, 2023]);

      expect(rows.length).toBeGreaterThan(0);

      // Each row should have data for both years
      rows.forEach(row => {
        expect(row[2022]).toBeDefined();
        expect(row[2023]).toBeDefined();
        expect(row[2022]).toHaveProperty("display");
        expect(row[2022]).toHaveProperty("frequencyAbs");
        expect(row[2022]).toHaveProperty("abundancy");
        expect(row[2023]).toHaveProperty("display");
        expect(row[2023]).toHaveProperty("frequencyAbs");
        expect(row[2023]).toHaveProperty("abundancy");
      });

      // Should calculate year-over-year changes for multi-year data
      const firstRow = rows[0];
      expect(firstRow).toHaveProperty("abundancyChange");
      expect(firstRow).toHaveProperty("frequencyChange");
    });

    it("should handle single year data correctly", () => {
      const rows2022Only = calculateRows(testDataset, [2022]);

      expect(rows2022Only.length).toBeGreaterThan(0);

      // Should not have change data for single year
      rows2022Only.forEach(row => {
        expect(row.abundancyChange).toBeUndefined();
        expect(row.frequencyChange).toBeUndefined();
      });
    });

    it("should filter data by transect correctly", () => {
      const transectAData = testDataset.filter(entry => entry["Transect ID"] === "TA");
      const transectBData = testDataset.filter(entry => entry["Transect ID"] === "TB");

      const speciesA = getAllSpecies(transectAData);
      const speciesB = getAllSpecies(transectBData);

      // Different transects should have different species
      expect(speciesA).toContain("Pieris rapae");
      expect(speciesB).toContain("Pieris brassicae");

      // Transect A should not have Transect B's exclusive species
      expect(speciesA).not.toContain("Pieris brassicae");
      expect(speciesA).not.toContain("Colias crocea");
      expect(speciesA).not.toContain("Maniola jurtina");
    });

    it("should handle section filtering correctly", () => {
      const section1Data = testDataset.filter(entry => entry["Section Name"].includes("S1"));
      const section2Data = testDataset.filter(entry => entry["Section Name"].includes("S2"));

      expect(section1Data.length).toBeGreaterThan(0);
      expect(section2Data.length).toBeGreaterThan(0);

      // Both sections should have data
      const section1Species = getAllSpecies(section1Data);
      const section2Species = getAllSpecies(section2Data);

      expect(section1Species.length).toBeGreaterThan(0);
      expect(section2Species.length).toBeGreaterThan(0);
    });
  });

  describe("Component Rendering", () => {
    it("should render the application without crashing", () => {
      render(
        <DatasetTypeProvider>
          <App />
        </DatasetTypeProvider>
      );

      expect(
        screen.getByText(/Clique ou arraste um ou mais ficheiros para esta área para começar/i)
      ).toBeInTheDocument();
    });

    it("should render initial upload state with correct message", () => {
      render(
        <DatasetTypeProvider>
          <App />
        </DatasetTypeProvider>
      );

      // Should show uploader initially
      expect(screen.getByText(/para esta área para começar/i)).toBeInTheDocument();

      // Should not show any charts before upload
      expect(screen.queryByText(/Sumário por ano/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Abundância por mês/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Diversidade por mês/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Frequência e abundância/i)).not.toBeInTheDocument();
    });
  });

  describe("Multi-file Merging Logic", () => {
    it("should correctly merge data from multiple CSV files", () => {
      const parseResult = Papa.parse(testDatasetCSV, { header: true, skipEmptyLines: true });
      const allData = parseResult.data as any[];

      // Simulate splitting into two files
      const midpoint = Math.floor(allData.length / 2);
      const file1Data = allData.slice(0, midpoint);
      const file2Data = allData.slice(midpoint);

      // Merge logic (simulating what the app does)
      const mergedData = [...file1Data, ...file2Data];

      expect(mergedData.length).toBe(allData.length);
      expect(mergedData.length).toBe(80);

      // Verify that both transects are present after merge
      const transects = new Set(mergedData.map(row => row["Transect ID"]));
      expect(transects.size).toBe(2);
    });
  });

  describe("Data Integrity", () => {
    it("should have valid dates in DD/MM/YYYY format", () => {
      const parseResult = Papa.parse(testDatasetCSV, { header: true, skipEmptyLines: true });
      const data = parseResult.data as any[];

      data.forEach((row: any, index: number) => {
        const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        expect(row.Date).toMatch(dateRegex);

        // Verify date parts are valid
        const [day, month, year] = row.Date.split("/").map(Number);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(31);
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
        expect(year).toBeGreaterThanOrEqual(2022);
        expect(year).toBeLessThanOrEqual(2023);
      });
    });

    it("should have valid abundance counts", () => {
      const parseResult = Papa.parse(testDatasetCSV, { header: true, skipEmptyLines: true });
      const data = parseResult.data as any[];

      data.forEach((row: any) => {
        const abundanceCount = parseInt(row["Abundance count"]);
        expect(abundanceCount).toBeGreaterThan(0);
        expect(Number.isInteger(abundanceCount)).toBe(true);
      });
    });

    it("should have valid section names", () => {
      const parseResult = Papa.parse(testDatasetCSV, { header: true, skipEmptyLines: true });
      const data = parseResult.data as any[];

      data.forEach((row: any) => {
        expect(row["Section Name"]).toBeTruthy();
        expect(row["Section Name"]).toMatch(/Test Transect [AB] - S[12]/);
      });
    });

    it("should have valid species names (binomial nomenclature)", () => {
      const parseResult = Papa.parse(testDatasetCSV, { header: true, skipEmptyLines: true });
      const data = parseResult.data as any[];

      data.forEach((row: any) => {
        const speciesName = row["Preferred Species Name"];
        expect(speciesName).toBeTruthy();

        // Species names should follow genus + species pattern (at least 2 words)
        const parts = speciesName.trim().split(" ");
        expect(parts.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
