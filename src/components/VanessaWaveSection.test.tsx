import { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VanessaWaveSection from "./VanessaWaveSection";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";

jest.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => null,
  Popup: () => null,
}));
jest.mock("react-chartjs-2", () => ({ Line: () => <div>Historical chart</div> }));
const timeline: TimelineData = {
  years: [2026],
  transectsByYear: { 2026: ["a"] },
  butterflyFrequencyByYear: {},
  transectDiversityByYear: {},
  observationsByYearDate: {
    2026: {
      "01/03/2026": [["a", "Vanessa cardui", 2]],
      "08/03/2026": [["a", "Vanessa cardui", 10]],
    },
  },
};
const transects: TransectData = { transects: [], metadata: {} as TransectData["metadata"] };

test("weekly abundance bars and keyboard slider share the map period selection", () => {
  render(
    <MemoryRouter>
      <VanessaWaveSection timeline={timeline} transects={transects} />
    </MemoryRouter>
  );
  const secondWeek = screen.getByRole("button", { name: "08/03 – 14/03: 10 indivíduos" });
  fireEvent.click(secondWeek);
  expect(secondWeek).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("slider", { name: "Semana de observação" })).toHaveAttribute(
    "aria-valuenow",
    "1"
  );
  expect(screen.getByText("2026 · semana 2 de 31")).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight", keyCode: 39, which: 39 });
  expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "2");
  expect(screen.getByText("Sem visitas registadas nesta semana")).toBeInTheDocument();
  expect(secondWeek).toHaveAttribute("aria-pressed", "false");
});
