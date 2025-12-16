import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ButterflyTransects from "./ButterflyTransects";

// Mock TransectMap to avoid react-leaflet issues in tests
jest.mock("./TransectMap", () => ({
  __esModule: true,
  default: () => <div data-testid="transect-map">Map Component</div>,
}));

// Mock TransectTimeline to avoid timeline data loading in tests
jest.mock("./TransectTimeline", () => ({
  __esModule: true,
  default: () => <div data-testid="transect-timeline">Timeline Component</div>,
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
    {
      transectId: "4",
      transectName: "Transect D (New)",
      totalSpecies: 20,
      totalVisits: 15,
      totalAbundance: 100,
      avgVisitsPerYear: 15.0,
      avgButterfliesPerVisit: 6.7,
      yearsActive: 1,
      firstMonitoringYear: 2025,
      lastMonitoringYear: 2025,
      speciesList: ["Species 6"],
      concelho: "Braga",
      distrito: "Braga",
      entidade: "Entity C",
    },
  ],
  metadata: {
    processedAt: "2025-01-01T00:00:00.000Z",
    totalTransects: 4,
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
        expect(screen.getByText("Transect D (New)")).toBeInTheDocument();
      });
    });

    it("fetches data from the correct endpoint", async () => {
      render(<ButterflyTransects />);
      await waitFor(() => {
        // eslint-disable-next-line no-undef
        expect(global.fetch).toHaveBeenCalledWith("data/processed-transects.json");
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
        expect(screen.getByText(/1-4 de 4 transectos/i)).toBeInTheDocument();
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

  describe("Transects gained/lost popover", () => {
    it("displays transects active card with gained/lost counts", async () => {
      render(<ButterflyTransects />);
      await waitFor(() => {
        const activeTransectsElements = screen.getAllByText(/Transectos Ativos em 2025/i);
        expect(activeTransectsElements.length).toBeGreaterThan(0);
        expect(screen.getByText(/Ganhos\/Perdidos:/i)).toBeInTheDocument();
      });
    });

    it("shows popover with lists of gained and lost transects when clicked", async () => {
      render(<ButterflyTransects />);

      await waitFor(() => {
        const activeTransectsElements = screen.getAllByText(/Transectos Ativos em 2025/i);
        expect(activeTransectsElements.length).toBeGreaterThan(0);
      });

      // Find the clickable card (it's wrapped in a div with cursor: pointer)
      const activeTransectsElements = screen.getAllByText(/Transectos Ativos em 2025/i);
      const clickableCard = activeTransectsElements[0].closest("div[style*='cursor: pointer']");

      if (clickableCard) {
        await userEvent.click(clickableCard);

        // Wait for popover to appear
        await waitFor(() => {
          expect(screen.getByText("Alterações nos Transectos")).toBeInTheDocument();
        });

        // Check for gained transects section
        await waitFor(() => {
          expect(screen.getByText(/Transectos Ganhos \(1\)/i)).toBeInTheDocument();
          // Verify that "Transect D (New)" appears at least twice (once in table, once in popover)
          const transectDElements = screen.getAllByText("Transect D (New)");
          expect(transectDElements.length).toBeGreaterThanOrEqual(2);
        });

        // Check for lost transects section
        await waitFor(() => {
          expect(screen.getByText(/Transectos Perdidos \(1\)/i)).toBeInTheDocument();
          // Verify that "Transect B" appears at least twice (once in table, once in popover)
          const transectBElements = screen.getAllByText("Transect B");
          expect(transectBElements.length).toBeGreaterThanOrEqual(2);
        });
      }
    });

    it("correctly identifies transects gained in most recent year", async () => {
      render(<ButterflyTransects />);

      await waitFor(() => {
        expect(screen.getByText(/\+1/i)).toBeInTheDocument(); // +1 gained
      });
    });

    it("correctly identifies transects lost before most recent year", async () => {
      render(<ButterflyTransects />);

      await waitFor(() => {
        expect(screen.getByText(/-1/i)).toBeInTheDocument(); // -1 lost
      });
    });
  });
});
