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
import { Dataset, ButterflyRecord } from "../types/dataset";

function getAllYears(dataset: Dataset): number[] {
  const yearsSet = new Set<number>();

  for (const entry of dataset) {
    const date = moment(entry.Date, "DD-MM-YYYY");
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

function getTransectNames(dataset: Dataset): Record<string, string> {
  const transectNames: Record<string, string> = {};

  for (const entry of dataset) {
    const transectId = entry["Transect ID"];
    const sectionName = entry["Section Name"];

    // Skip if already processed or missing data
    if (!transectId || !sectionName || transectNames[transectId]) {
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

  return transectNames;
}

function MyApp() {
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
  };

  const onTargetSectionChange = (newTargetSection: string | null) => {
    setTargetSection(newTargetSection ? newTargetSection : null);
  };

  const onUpload = (results: ParseResult<ButterflyRecord>) => {
    const cleanData = results.data.filter(point => point["Transect Sample ID"]);

    const allYears = getAllYears(cleanData).toReversed();
    setYearsList(allYears);
    // Initialize with all years selected, sorted in ascending order
    setSelectedYears([...allYears].sort((a, b) => a - b));

    const allTransects = getAllTransects(cleanData);
    const names = getTransectNames(cleanData);
    setTransectsList(allTransects);
    setTransectNames(names);
    const initialTransect = allTransects[allTransects.length - 1];
    setTargetTransect(initialTransect);
    setTargetTransectName(names[initialTransect] || initialTransect);

    const allSectionsForTransect = getAllSections(cleanData, allTransects[allTransects.length - 1]);
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
      <Uploader onUpload={onUpload} />

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
          />
          <div data-chart-export data-export-as-table>
            <YearComparison
              yearsList={selectedYears}
              dataset={dataset}
              transect={targetTransect}
              section={targetSection}
            />
          </div>
          <div>
            <AbundancyPerMonth
              dataset={dataset}
              yearsList={selectedYears}
              targetTransect={targetTransect}
              targetSection={targetSection}
            />
          </div>
          <div>
            <DiversityPerMonth
              dataset={dataset}
              yearsList={selectedYears}
              targetTransect={targetTransect}
              targetSection={targetSection}
            />
          </div>
          <AbsoluteFrequencyAndAbundancy
            dataset={dataset}
            yearsList={selectedYears}
            targetTransect={targetTransect}
            targetSection={targetSection}
          />
        </>
      ) : null}
    </Space>
  );
}

export default MyApp;
