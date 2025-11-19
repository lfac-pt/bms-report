import { render, screen } from "@testing-library/react";
import App from "./App";
import { DatasetTypeProvider } from "../contexts/DatasetTypeContext";

test("renders learn react link", () => {
  render(
    <DatasetTypeProvider>
      <App />
    </DatasetTypeProvider>
  );
  const linkElement = screen.getByText(
    /Clique ou arraste um ou mais ficheiros para esta área para começar/i
  );
  expect(linkElement).toBeInTheDocument();
});
