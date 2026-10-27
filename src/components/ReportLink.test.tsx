import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReportLink from "./ReportLink";
import { ReportEmbedContext } from "../contexts/ReportEmbedContext";

test("embedded detail links open the full application outside the report", () => {
  render(
    <MemoryRouter>
      <ReportEmbedContext.Provider value="https://example.org/bms/">
        <ReportLink to="/species/Vanessa%20cardui">Species</ReportLink>
      </ReportEmbedContext.Provider>
    </MemoryRouter>
  );
  expect(screen.getByRole("link")).toHaveAttribute(
    "href",
    "https://example.org/bms/#/species/Vanessa%20cardui"
  );
  expect(screen.getByRole("link")).toHaveAttribute("target", "_blank");
  expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
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
