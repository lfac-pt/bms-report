import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ButterflyTransects from "./ButterflyTransects";

// Mock TransectMap to avoid react-leaflet issues in tests
jest.mock("./TransectMap", () => ({
  __esModule: true,
  default: () => <div data-testid="transect-map">Map Component</div>,
}));

// Mock data
const mockTransectsData = {
  transects: [
    {
      transectId: "1",
      transectName: "Transect A",
      totalSpecies: 30,
      totalVisits: 100,
      totalAbundance: 500,
      avgVisitsPerYear: 15.5,
      avgButterfliesPerVisit: 20.2,
      yearsActive: 7,
      firstMonitoringYear: 2019,
      lastMonitoringYear: 2025,
      speciesList: ["Species 1", "Species 2"],
      concelho: "Lisboa",
      distrito: "Lisboa",
      entidade: "Entity A",
    },
    {
      transectId: "2",
      transectName: "Transect B",
      totalSpecies: 25,
      totalVisits: 80,
      totalAbundance: 400,
      avgVisitsPerYear: 12.0,
      avgButterfliesPerVisit: 18.5,
      yearsActive: 5,
      firstMonitoringYear: 2020,
      lastMonitoringYear: 2024,
      speciesList: ["Species 3", "Species 4"],
      concelho: "Porto",
      distrito: "Porto",
      entidade: "Entity B",
    },
    {
      transectId: "3",
      transectName: "Transect C",
      totalSpecies: 35,
      totalVisits: 120,
      totalAbundance: 600,
      avgVisitsPerYear: 18.0,
      avgButterfliesPerVisit: 22.0,
      yearsActive: 6,
      firstMonitoringYear: 2019,
      lastMonitoringYear: 2025,
      speciesList: ["Species 5"],
      concelho: "Faro",
      distrito: "Faro",
      entidade: "Entity A",
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
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve(mockTransectsData),
  })
) as jest.Mock;

describe("ButterflyTransects - Smoke Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic rendering", () => {
    it("renders without crashing and displays title", async () => {
      render(<ButterflyTransects />);
      await waitFor(() => {
        expect(screen.getByText(/BMS Diurnas Portugal Continental/i)).toBeInTheDocument();
      });
    });

    it("displays summary statistics cards", async () => {
      render(<ButterflyTransects />);
      await waitFor(() => {
        expect(screen.getByText("Transectos com Dados Robustos")).toBeInTheDocument();
        expect(screen.getByText("Cobertura Geográfica")).toBeInTheDocument();
        expect(screen.getByText("Total de Borboletas Contadas")).toBeInTheDocument();
      });
    });

    it("renders the table with transect data", async () => {
      render(<ButterflyTransects />);
      await waitFor(() => {
        expect(screen.getByText("Transect A")).toBeInTheDocument();
        expect(screen.getByText("Transect B")).toBeInTheDocument();
        expect(screen.getByText("Transect C")).toBeInTheDocument();
      });
    });

    it("fetches data from the correct endpoint", async () => {
      render(<ButterflyTransects />);
      await waitFor(() => {
        // eslint-disable-next-line no-undef
        expect(global.fetch).toHaveBeenCalledWith("/data/processed-transects.json");
      });
    });
  });

  describe("Search functionality", () => {
    it("filters transects by search term", async () => {
      render(<ButterflyTransects />);

      await waitFor(() => {
        expect(screen.getByText("Transect A")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Procurar por nome do transecto...");
      await userEvent.type(searchInput, "Transect A");

      await waitFor(() => {
        expect(screen.getByText("Transect A")).toBeInTheDocument();
        expect(screen.queryByText("Transect B")).not.toBeInTheDocument();
      });
    });
  });

  describe("Table pagination", () => {
    it("displays pagination information", async () => {
      render(<ButterflyTransects />);
      await waitFor(() => {
        expect(screen.getByText(/1-3 de 3 transectos/i)).toBeInTheDocument();
      });
    });

    it("resets to page 1 when search filter is applied", async () => {
      render(<ButterflyTransects />);

      await waitFor(() => {
        expect(screen.getByText("Transect A")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Procurar por nome do transecto...");
      await userEvent.type(searchInput, "Transect A");

      await waitFor(() => {
        expect(screen.getByText(/1-1 de 1 transectos/i)).toBeInTheDocument();
      });
    });
  });

  describe("Table filters", () => {
    it("shows table headers with filter capabilities", async () => {
      render(<ButterflyTransects />);
      await waitFor(() => {
        expect(screen.getByText("Anos Ativos")).toBeInTheDocument();
        expect(screen.getByText("Visitas/Ano")).toBeInTheDocument();
      });
    });

    it("maintains filtered state correctly", async () => {
      render(<ButterflyTransects />);

      await waitFor(() => {
        expect(screen.getByText("Transect A")).toBeInTheDocument();
      });

      // Apply search filter
      const searchInput = screen.getByPlaceholderText("Procurar por nome do transecto...");
      await userEvent.type(searchInput, "Transect");

      // All transects with "Transect" should be visible
      await waitFor(() => {
        expect(screen.getByText("Transect A")).toBeInTheDocument();
        expect(screen.getByText("Transect B")).toBeInTheDocument();
        expect(screen.getByText("Transect C")).toBeInTheDocument();
      });

      // Clear filter
      await userEvent.clear(searchInput);

      // All transects should still be visible
      await waitFor(() => {
        expect(screen.getByText("Transect A")).toBeInTheDocument();
        expect(screen.getByText("Transect B")).toBeInTheDocument();
        expect(screen.getByText("Transect C")).toBeInTheDocument();
      });
    });
  });

  describe("Interactive features", () => {
    it("has column configuration button", async () => {
      render(<ButterflyTransects />);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /configurar colunas/i })).toBeInTheDocument();
      });
    });

    it("renders map component", async () => {
      render(<ButterflyTransects />);
      await waitFor(() => {
        expect(screen.getByTestId("transect-map")).toBeInTheDocument();
      });
    });
  });
});
