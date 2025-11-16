import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { DatasetType } from "../utils/datasetAdapter";

interface DatasetTypeContextValue {
  datasetType: DatasetType;
  setDatasetType: (type: DatasetType) => void;
}

const DatasetTypeContext = createContext<DatasetTypeContextValue | undefined>(undefined);

// Helper functions for URL state management
function getDatasetTypeFromURL(): DatasetType {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  return type === "nocturnal" ? "nocturnal" : "diurnal";
}

function setDatasetTypeInURL(type: DatasetType): void {
  const params = new URLSearchParams(window.location.search);
  params.set("type", type);
  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({}, "", newURL);
}

export function DatasetTypeProvider({ children }: { children: ReactNode }) {
  const [datasetType, setDatasetTypeState] = useState<DatasetType>(() => getDatasetTypeFromURL());

  useEffect(() => {
    setDatasetTypeInURL(datasetType);
  }, [datasetType]);

  const setDatasetType = (type: DatasetType) => {
    setDatasetTypeState(type);
  };

  return (
    <DatasetTypeContext.Provider value={{ datasetType, setDatasetType }}>
      {children}
    </DatasetTypeContext.Provider>
  );
}

export function useDatasetType() {
  const context = useContext(DatasetTypeContext);
  if (!context) {
    throw new Error("useDatasetType must be used within DatasetTypeProvider");
  }
  return context;
}
