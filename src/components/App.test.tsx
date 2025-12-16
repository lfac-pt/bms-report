import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders learn react link", () => {
  render(<App datasetType="diurnal" />);
  const linkElement = screen.getByText(
    /Clique ou arraste um ou mais ficheiros para esta área para começar/i
  );
  expect(linkElement).toBeInTheDocument();
});
