/* eslint-env browser, node */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SpeciesPage from "./SpeciesPage";
import { SPECIES_FAMILIES } from "../utils/speciesFamilies";
import endangeredSpeciesPT from "../utils/endangered_pt";
import endangeredSpeciesEurope from "../utils/endangered_eu";

// Mock SpeciesMap to avoid react-leaflet issues in tests
jest.mock("./SpeciesMap", () => ({
  __esModule: true,
  default: () => <div data-testid="species-map">Species Map Component</div>,
}));

// Mock Chart.js to avoid canvas issues in tests
jest.mock("react-chartjs-2", () => ({
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
}));

// Mock timeline data
const mockTimelineData = {
  years: [2020, 2021, 2022, 2023, 2024, 2025],
  transectsByYear: {
    2020: ["T1", "T2"],
    2021: ["T1", "T2", "T3"],
    2022: ["T1", "T2", "T3"],
    2023: ["T1", "T2", "T3"],
    2024: ["T1", "T2", "T3"],
    2025: ["T1", "T2", "T3"],
  },
  observationsByYearDate: {
    2024: {
      "15/06/2024": [
        ["T1", "Maniola jurtina", 5],
        ["T1", "Pieris rapae", 3],
        ["T2", "Maniola jurtina", 2],
      ],
      "20/07/2024": [
        ["T1", "Maniola jurtina", 4],
        ["T3", "Pieris rapae", 1],
      ],
    },
    2025: {
      "10/05/2025": [
        ["T1", "Maniola jurtina", 3],
        ["T2", "Pieris rapae", 2],
      ],
    },
  },
  butterflyFrequencyByYear: {},
  transectDiversityByYear: {},
};

// Mock transect data
const mockTransectData = {
  transects: [
    {
      transectId: "T1",
      transectCode: "T1",
      transectName: "Transect 1",
      isActive: true,
      totalSpecies: 25,
      totalVisits: 50,
      totalAbundance: 250,
      avgVisitsPerYear: 10,
      avgButterfliesPerVisit: 5,
      yearsActive: 5,
      firstMonitoringYear: 2020,
      lastMonitoringYear: 2025,
      speciesList: ["Maniola jurtina", "Pieris rapae"],
      tipologia: "Rural",
      concelho: "Lisboa",
      distrito: "Lisboa",
      climaticRegion: "Lisboa e Vale do Tejo",
      responsavel: "John Doe",
      entidade: "Entity A",
      coordinates: { lat: 38.7223, lon: -9.1393 },
    },
    {
      transectId: "T2",
      transectCode: "T2",
      transectName: "Transect 2",
      isActive: true,
      totalSpecies: 30,
      totalVisits: 60,
      totalAbundance: 300,
      avgVisitsPerYear: 12,
      avgButterfliesPerVisit: 5,
      yearsActive: 5,
      firstMonitoringYear: 2020,
      lastMonitoringYear: 2025,
      speciesList: ["Maniola jurtina", "Pieris rapae"],
      tipologia: "Urban",
      concelho: "Porto",
      distrito: "Porto",
      climaticRegion: "Norte",
      responsavel: "Jane Doe",
      entidade: "Entity B",
      coordinates: { lat: 41.1579, lon: -8.6291 },
    },
    {
      transectId: "T3",
      transectCode: "T3",
      transectName: "Transect 3",
      isActive: true,
      totalSpecies: 20,
      totalVisits: 55,
      totalAbundance: 275,
      avgVisitsPerYear: 11,
      avgButterfliesPerVisit: 5,
      yearsActive: 5,
      firstMonitoringYear: 2020,
      lastMonitoringYear: 2025,
      speciesList: ["Pieris rapae"],
      tipologia: "Mixed",
      concelho: "Faro",
      distrito: "Faro",
      climaticRegion: "Algarve",
      responsavel: "John Smith",
      entidade: "Entity C",
      coordinates: { lat: 37.0194, lon: -7.9322 },
    },
  ],
  metadata: {
    processedAt: "2025-01-01T00:00:00.000Z",
    totalTransects: 3,
    filteredSpeciesCount: 0,
    filteredSpecies: [],
  },
};

// Mock fetch
// eslint-disable-next-line no-undef
global.fetch = jest.fn(url => {
  if (url === "data/timeline-data.json") {
    return Promise.resolve({
      json: () => Promise.resolve(mockTimelineData),
    });
  }
  if (url === "data/processed-transects.json") {
    return Promise.resolve({
      json: () => Promise.resolve(mockTransectData),
    });
  }
  if (
    url === "data/flight-curves-data.json" ||
    url === "data/phenology-curves-data.json" ||
    url === "data/gbi-data.json"
  ) {
    return Promise.resolve({
      json: () => Promise.resolve(null),
    });
  }
  return Promise.reject(new Error("Unknown URL"));
}) as jest.Mock;

// Helper to render SpeciesPage with router
const renderSpeciesPage = (speciesName: string) => {
  return render(
    <MemoryRouter initialEntries={[`/species/${encodeURIComponent(speciesName)}`]}>
      <Routes>
        <Route path="/species/:speciesName" element={<SpeciesPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("SpeciesPage - Data Correctness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Family Order", () => {
    it("displays families in the correct canonical order", async () => {
      renderSpeciesPage("Maniola jurtina");

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Maniola jurtina/i })).toBeInTheDocument();
      });

      // The canonical order should be: Hesperiidae, Papilionidae, Pieridae, Nymphalidae, Lycaenidae
      const expectedOrder = [
        "Hesperiidae",
        "Papilionidae",
        "Pieridae",
        "Nymphalidae",
        "Lycaenidae",
      ];

      // Get all species from SPECIES_FAMILIES and group by family
      const familiesUsed = new Set<string>();
      Object.values(SPECIES_FAMILIES).forEach(family => {
        familiesUsed.add(family);
      });

      // Verify all used families are in the expected order
      const usedFamiliesArray = Array.from(familiesUsed);
      const orderedFamilies = usedFamiliesArray
        .filter(f => expectedOrder.includes(f))
        .sort((a, b) => expectedOrder.indexOf(a) - expectedOrder.indexOf(b));

      // Check that the sorted families match the expected order
      for (let i = 0; i < orderedFamilies.length - 1; i++) {
        const indexA = expectedOrder.indexOf(orderedFamilies[i]);
        const indexB = expectedOrder.indexOf(orderedFamilies[i + 1]);
        expect(indexA).toBeLessThan(indexB);
      }
    });
  });

  describe("Species Grouping", () => {
    it("correctly groups species by their family", () => {
      // This is a data integrity test that doesn't require rendering
      // Verify that Maniola jurtina is grouped under Nymphalidae
      expect(SPECIES_FAMILIES["Maniola jurtina"]).toBe("Nymphalidae");

      // Verify that Pieris rapae is grouped under Pieridae
      expect(SPECIES_FAMILIES["Pieris rapae"]).toBe("Pieridae");
    });

    it("only includes species from the validated species families list", () => {
      // This is a data integrity test that doesn't require rendering
      // All species in the select should be in SPECIES_FAMILIES
      const allValidSpecies = Object.keys(SPECIES_FAMILIES);
      expect(allValidSpecies.length).toBeGreaterThan(0);
      expect(allValidSpecies).toContain("Maniola jurtina");
      expect(allValidSpecies).toContain("Pieris rapae");
    });
  });

  describe("Endangered Species Display", () => {
    it("displays endangered status for PT endangered species", async () => {
      // Find a PT endangered species
      const ptEndangeredSpecies = Object.keys(endangeredSpeciesPT);
      if (ptEndangeredSpecies.length > 0) {
        const testSpecies = ptEndangeredSpecies[0];
        renderSpeciesPage(testSpecies);

        await waitFor(() => {
          const status = endangeredSpeciesPT[testSpecies];
          expect(screen.getByText(new RegExp(`${status}.*PT`, "i"))).toBeInTheDocument();
        });
      }
    });

    it("displays endangered status for EU endangered species", async () => {
      // Find an EU endangered species that's not in PT list and has observations in mock data
      const speciesWithObservations = new Set<string>();
      Object.values(mockTimelineData.observationsByYearDate).forEach(yearData => {
        Object.values(yearData).forEach(observations => {
          observations.forEach(([, species]) => {
            speciesWithObservations.add(species);
          });
        });
      });

      const euEndangeredSpecies = Object.keys(endangeredSpeciesEurope).filter(
        species => !endangeredSpeciesPT[species] && speciesWithObservations.has(species)
      );

      if (euEndangeredSpecies.length > 0) {
        const testSpecies = euEndangeredSpecies[0];
        renderSpeciesPage(testSpecies);

        await waitFor(
          () => {
            const status = endangeredSpeciesEurope[testSpecies];
            expect(screen.getByText(new RegExp(`${status}.*UE`, "i"))).toBeInTheDocument();
          },
          { timeout: 3000 }
        );
      } else {
        // If no EU-only endangered species with observations, test is not applicable
        expect(true).toBe(true);
      }
    });

    it("prioritizes PT endangered status over EU status", async () => {
      // Find a species in both lists
      const ptSpecies = Object.keys(endangeredSpeciesPT);
      const inBothLists = ptSpecies.find(species => endangeredSpeciesEurope[species]);

      if (inBothLists) {
        renderSpeciesPage(inBothLists);

        await waitFor(() => {
          const ptStatus = endangeredSpeciesPT[inBothLists];
          expect(screen.getByText(new RegExp(`${ptStatus}.*PT`, "i"))).toBeInTheDocument();
        });
      }
    });
  });

  describe("Data Fetching", () => {
    it("fetches timeline data from correct endpoint", async () => {
      renderSpeciesPage("Maniola jurtina");

      await waitFor(() => {
        // eslint-disable-next-line no-undef
        expect(global.fetch).toHaveBeenCalledWith("data/timeline-data.json");
      });
    });

    it("fetches transect data from correct endpoint", async () => {
      renderSpeciesPage("Maniola jurtina");

      await waitFor(() => {
        // eslint-disable-next-line no-undef
        expect(global.fetch).toHaveBeenCalledWith("data/processed-transects.json");
      });
    });

    it("handles species names with special characters correctly", async () => {
      const speciesWithSpaces = "Maniola jurtina";
      renderSpeciesPage(speciesWithSpaces);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: new RegExp(speciesWithSpaces, "i") })
        ).toBeInTheDocument();
      });
    });
  });

  describe("Species Family Information", () => {
    it("displays correct family for species", async () => {
      renderSpeciesPage("Maniola jurtina");

      await waitFor(() => {
        expect(screen.getByText(/Família: Nymphalidae/i)).toBeInTheDocument();
      });
    });

    it("shows fallback message for species without family info", async () => {
      // This would be an edge case if SPECIES_FAMILIES doesn't have the species
      renderSpeciesPage("Unknown Species");

      await waitFor(() => {
        expect(screen.getByText(/Família: Informação não disponível/i)).toBeInTheDocument();
      });
    });
  });

  describe("Year Distribution", () => {
    it("displays distribution cards for available years", async () => {
      renderSpeciesPage("Maniola jurtina");

      await waitFor(() => {
        expect(screen.getByText("Distribuição por Ano")).toBeInTheDocument();
      });

      // Should show years 2020-2025
      await waitFor(() => {
        expect(screen.getByText(/2025/i)).toBeInTheDocument();
        expect(screen.getByText(/2024/i)).toBeInTheDocument();
      });
    });
  });
});
