import { useState } from "react";
import moment from "moment";
import { Space, theme } from "antd";
import { ParseResult } from "papaparse";
import AbundancyPerMonth from "./charts/AbundancyPerMonth";
import DiversityPerMonth from "./charts/DiversityPerMonth";
import AbsoluteFrequencyAndAbundancy from "./charts/AbsoluteFrequencyAndAbundancy";
import Uploader from "./Uploader";
import PageFilters from "./PageFilters";
import YearComparison from "./charts/YearComparison";
import TransectSummary from "./TransectSummary";
import { Dataset, ButterflyRecord } from "../types/dataset";
import { NocturnalButterflyRecord } from "../types/nocturnalDataset";
import { adaptNocturnalDataset, DatasetType } from "../utils/datasetAdapter";
import { useDatasetType } from "../contexts/DatasetTypeContext";

function getAllYears(dataset: Dataset): number[] {
  const yearsSet = new Set<number>();

  for (const entry of dataset) {
    const date = moment(entry.Date, "DD/MM/YYYY");
    yearsSet.add(date.year());
  }

  return [...yearsSet].filter(year => {
    return Number(year) === year;
  });
}

function getAllTransects(dataset: Dataset): string[] {
  const set = new Set<string>();

  for (const entry of dataset) {
    set.add(entry["Transect ID"]);
  }

  return [...set].filter(transectId => {
    return !!transectId;
  });
}

function getAllSections(dataset: Dataset, transect: string): string[] {
  const set = new Set<string>();

  for (const entry of dataset) {
    if (entry["Transect ID"] === transect) {
      set.add(entry["Section Name"]);
    }
  }

  return [...set].filter(section => {
    return !!section;
  });
}

function getTransectNames(dataset: Dataset, datasetType: DatasetType): Record<string, string> {
  const transectNames: Record<string, string> = {};

  for (const entry of dataset) {
    const transectId = entry["Transect ID"];

    // Skip if already processed or missing data
    if (!transectId || transectNames[transectId]) {
      continue;
    }

    if (datasetType === "nocturnal") {
      // For nocturnal data, Location field contains the full station name directly
      transectNames[transectId] = transectId; // Location is already the name
    } else {
      // For diurnal data, extract transect name from section name
      const sectionName = entry["Section Name"];
      if (!sectionName) {
        transectNames[transectId] = transectId;
        continue;
      }

      // Extract transect name from section name (e.g., "Baldios de São Miguel de Poiares - S4" -> "Baldios de São Miguel de Poiares")
      const lastDashIndex = sectionName.lastIndexOf(" - ");
      if (lastDashIndex !== -1) {
        transectNames[transectId] = sectionName.substring(0, lastDashIndex);
      } else {
        // Fallback to transect ID if pattern doesn't match
        transectNames[transectId] = transectId;
      }
    }
  }

  return transectNames;
}

function MyApp() {
  const { datasetType } = useDatasetType();
  const [dataset, setDataset] = useState<Dataset>([]);

  const [yearsList, setYearsList] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  const [transectsList, setTransectsList] = useState<string[]>([]);
  const [transectNames, setTransectNames] = useState<Record<string, string>>({});
  const [targetTransect, setTargetTransect] = useState<string | null>(null);
  const [targetTransectName, setTargetTransectName] = useState<string | null>(null);

  const [sectionsList, setSectionsList] = useState<string[]>([]);
  const [targetSection, setTargetSection] = useState<string | null>(null);

  const onSelectedYearsChange = (newSelectedYears: number[]) => {
    // Ensure at least one year is always selected
    if (!newSelectedYears || newSelectedYears.length === 0) {
      return; // Don't allow clearing all years
    }

    // Sort years in ascending order
    const sortedYears = [...newSelectedYears].sort((a, b) => a - b);
    setSelectedYears(sortedYears);
  };

  const onTargetTransectChange = (newTargetTransect: string) => {
    setTargetTransect(newTargetTransect);
    setTargetTransectName(transectNames[newTargetTransect] || newTargetTransect);

    const allSectionsForTransect = getAllSections(dataset, newTargetTransect);
    setSectionsList(allSectionsForTransect);
    setTargetSection(null);

    // Get years with data for this transect
    const transectData = dataset.filter(entry => entry["Transect ID"] === newTargetTransect);
    const availableYears = getAllYears(transectData);

    // Update selected years to only include years with data in this transect
    setSelectedYears(availableYears.sort((a, b) => a - b));
  };

  const onTargetSectionChange = (newTargetSection: string | null) => {
    setTargetSection(newTargetSection ? newTargetSection : null);
  };

  const onUpload = (
    results: ParseResult<ButterflyRecord | NocturnalButterflyRecord>,
    type: DatasetType
  ) => {
    let cleanData: Dataset;

    if (type === "nocturnal") {
      // Adapt nocturnal data to diurnal format
      const nocturnalData = (results.data as NocturnalButterflyRecord[]).filter(
        point => point["Sample ID"]
      );
      cleanData = adaptNocturnalDataset(nocturnalData);
    } else {
      // Use diurnal data as-is
      cleanData = (results.data as ButterflyRecord[]).filter(point => point["Transect Sample ID"]);
    }

    const allYears = getAllYears(cleanData).toReversed();
    setYearsList(allYears);
    // Initialize with all years selected, sorted in ascending order
    setSelectedYears([...allYears].sort((a, b) => a - b));

    const allTransects = getAllTransects(cleanData);
    const names = getTransectNames(cleanData, type);
    setTransectsList(allTransects);
    setTransectNames(names);

    // Count records per transect and select the one with most observations
    const transectRecordCounts: Record<string, number> = {};
    cleanData.forEach(entry => {
      const transectId = entry["Transect ID"];
      transectRecordCounts[transectId] = (transectRecordCounts[transectId] || 0) + 1;
    });

    // Find transect with most records
    const initialTransect = allTransects.reduce((maxTransect, transect) => {
      return (transectRecordCounts[transect] || 0) > (transectRecordCounts[maxTransect] || 0)
        ? transect
        : maxTransect;
    }, allTransects[0]);

    setTargetTransect(initialTransect);
    setTargetTransectName(names[initialTransect] || initialTransect);

    const allSectionsForTransect = getAllSections(cleanData, initialTransect);
    setSectionsList(allSectionsForTransect);
    setTargetSection(null);

    setDataset(cleanData);
  };

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Space
      direction="vertical"
      size="middle"
      style={{
        display: "flex",
        background: colorBgContainer,
        padding: 24,
        borderRadius: borderRadiusLG,
      }}
    >
      <Uploader key={datasetType} onUpload={onUpload} datasetType={datasetType} />

      {dataset.length > 0 ? (
        <>
          <PageFilters
            selectedYears={selectedYears}
            yearsList={yearsList}
            transectsList={transectsList}
            transectNames={transectNames}
            targetTransectName={targetTransectName}
            targetTransect={targetTransect}
            onSelectedYearsChange={onSelectedYearsChange}
            onTargetTransectChange={onTargetTransectChange}
            sectionsList={sectionsList}
            targetSection={targetSection}
            onTargetSectionChange={onTargetSectionChange}
            datasetType={datasetType}
            dataset={dataset}
          />
          <div id="pdf-summary">
            <TransectSummary
              dataset={dataset}
              selectedYears={selectedYears}
              targetTransect={targetTransect}
              targetSection={targetSection}
              targetTransectName={targetTransectName}
              datasetType={datasetType}
            />
          </div>
          <div id="pdf-year-comparison">
            <YearComparison
              yearsList={selectedYears}
              dataset={dataset}
              transect={targetTransect}
              section={targetSection}
              datasetType={datasetType}
            />
          </div>
          <div id="pdf-abundancy-per-month">
            <AbundancyPerMonth
              dataset={dataset}
              yearsList={selectedYears}
              targetTransect={targetTransect}
              targetSection={targetSection}
              datasetType={datasetType}
            />
          </div>
          <div id="pdf-diversity-per-month">
            <DiversityPerMonth
              dataset={dataset}
              yearsList={selectedYears}
              targetTransect={targetTransect}
              targetSection={targetSection}
            />
          </div>
          <div id="pdf-frequency-abundancy-table">
            <AbsoluteFrequencyAndAbundancy
              dataset={dataset}
              yearsList={selectedYears}
              targetTransect={targetTransect}
              targetSection={targetSection}
              datasetType={datasetType}
            />
          </div>
        </>
      ) : null}
    </Space>
  );
}

export default MyApp;
