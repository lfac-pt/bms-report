import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReportLink from "./ReportLink";
import { ReportEmbedContext } from "../contexts/ReportEmbedContext";

test("embedded detail names remain visible without navigation", () => {
  render(
    <MemoryRouter>
      <ReportEmbedContext.Provider value="https://example.org/bms/">
        <ReportLink to="/species/Vanessa%20cardui">Species</ReportLink>
      </ReportEmbedContext.Provider>
    </MemoryRouter>
  );
  expect(screen.getByText("Species")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
test("normal application links preserve internal routing", () => {
  render(
    <MemoryRouter>
      <ReportLink to="/municipality/Coimbra">Coimbra</ReportLink>
    </MemoryRouter>
  );
  expect(screen.getByRole("link")).toHaveAttribute("href", "/municipality/Coimbra");
  expect(screen.getByRole("link")).not.toHaveAttribute("target");
});
