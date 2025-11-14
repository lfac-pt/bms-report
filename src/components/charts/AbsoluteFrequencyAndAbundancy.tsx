import React, { useRef, useState } from "react";
import { SearchOutlined } from "@ant-design/icons";
import Highlighter from "react-highlight-words";
import { Card, Table, Alert, Button, Input, Space } from "antd";
import moment from "moment";
import { Dataset } from "../../types/dataset";

export function getVisitsCountByYear(dataset: Dataset, year: number): number {
  const dates = new Set<string>();

  for (const entry of dataset) {
    const date = moment(entry.Date, "DD/MM/YYYY");
    const entryYear = date.year();
    if (entryYear === year) {
      dates.add(entry.Date);
    }
  }

  return dates.size;
}

// Deduplicate
export function getAllSpecies(dataset: Dataset): string[] {
  const speciesSet = new Set<string>();

  for (const entry of dataset) {
    const species = entry["Preferred Species Name"];

    if (species.split(" ").length === 2) {
      speciesSet.add(species);
    }
  }

  return [...speciesSet];
}

export interface YearData {
  display: string;
  frequencyAbs: number;
  abundancy: number;
}

export interface ChangeData {
  display: string;
  percentChange: number | null;
}

export interface DataRow {
  key: string;
  species: string;
  abundancyChange?: ChangeData;
  frequencyChange?: ChangeData;
  [year: number]: YearData;
}

interface YearDataBySpecies {
  totalVisits: number;
  frequencyMap: Record<string, Set<string>>;
  abundancyMap: Record<string, number>;
}

export function calculateYearOverYearChanges(
  species: string,
  yearsList: number[],
  dataByYear: Record<number, YearDataBySpecies>
): { abundancyChange: ChangeData; frequencyChange: ChangeData } | null {
  if (yearsList.length < 2) {
    return null;
  }

  const currentYear = yearsList[yearsList.length - 1];
  const previousYear = yearsList[yearsList.length - 2];

  const currentAbundancy = dataByYear[currentYear].abundancyMap[species] || 0;
  const previousAbundancy = dataByYear[previousYear].abundancyMap[species] || 0;

  const currentFrequencySet = dataByYear[currentYear].frequencyMap[species];
  const previousFrequencySet = dataByYear[previousYear].frequencyMap[species];
  const currentFrequencyAbs = currentFrequencySet ? currentFrequencySet.size : 0;
  const previousFrequencyAbs = previousFrequencySet ? previousFrequencySet.size : 0;

  // Calculate frequency percentages for both years
  const currentTotalVisits = dataByYear[currentYear].totalVisits;
  const previousTotalVisits = dataByYear[previousYear].totalVisits;

  const currentFrequencyPercent =
    currentTotalVisits > 0 ? (currentFrequencyAbs / currentTotalVisits) * 100 : 0;
  const previousFrequencyPercent =
    previousTotalVisits > 0 ? (previousFrequencyAbs / previousTotalVisits) * 100 : 0;

  // Calculate abundance change
  let abundancyDisplay: string;
  let abundancyPercentChange: number | null;

  if (currentAbundancy === 0 && previousAbundancy === 0) {
    abundancyDisplay = "NA";
    abundancyPercentChange = null;
  } else if (previousAbundancy === 0) {
    abundancyDisplay = "NA";
    abundancyPercentChange = null;
  } else if (currentAbundancy === 0) {
    abundancyDisplay = "-100%";
    abundancyPercentChange = -100;
  } else {
    abundancyPercentChange = ((currentAbundancy - previousAbundancy) / previousAbundancy) * 100;
    const sign = abundancyPercentChange > 0 ? "+" : "";
    abundancyDisplay = `${sign}${abundancyPercentChange.toFixed(0)}%`;
  }

  // Calculate frequency change using absolute difference in percentage points
  let frequencyDisplay: string;
  let frequencyPercentChange: number | null;

  if (currentFrequencyPercent === 0 && previousFrequencyPercent === 0) {
    // Species not present in either year
    frequencyDisplay = "NA";
    frequencyPercentChange = null;
  } else if (previousFrequencyPercent === 0) {
    // Species only appears in current year
    frequencyDisplay = "NA";
    frequencyPercentChange = null;
  } else if (currentFrequencyPercent === 0) {
    // Species only appears in previous year (100% decrease)
    frequencyDisplay = "-100%";
    frequencyPercentChange = -100;
  } else {
    // Absolute difference in percentage points
    frequencyPercentChange = currentFrequencyPercent - previousFrequencyPercent;
    const sign = frequencyPercentChange > 0 ? "+" : "";
    frequencyDisplay = `${sign}${frequencyPercentChange.toFixed(0)}%`;
  }

  return {
    abundancyChange: {
      display: abundancyDisplay,
      percentChange: abundancyPercentChange,
    },
    frequencyChange: {
      display: frequencyDisplay,
      percentChange: frequencyPercentChange,
    },
  };
}

export function calculateRows(dataset: Dataset, yearsList: number[]): DataRow[] {
  const allSpecies = getAllSpecies(dataset);
  const dataByYear: Record<number, YearDataBySpecies> = {};

  // Initialize data structure for each year
  yearsList.forEach(year => {
    dataByYear[year] = {
      totalVisits: getVisitsCountByYear(dataset, year),
      frequencyMap: {},
      abundancyMap: {},
    };
  });

  // Process dataset entries
  for (const entry of dataset) {
    const species = entry["Preferred Species Name"];
    const entryYear = moment(entry.Date, "DD/MM/YYYY").year();

    if (dataByYear[entryYear]) {
      // Track frequency (unique dates per species per year)
      if (!dataByYear[entryYear].frequencyMap[species]) {
        dataByYear[entryYear].frequencyMap[species] = new Set();
      }
      dataByYear[entryYear].frequencyMap[species].add(entry.Date);

      // Track abundancy (total count per species per year)
      if (!dataByYear[entryYear].abundancyMap[species]) {
        dataByYear[entryYear].abundancyMap[species] = 0;
      }
      dataByYear[entryYear].abundancyMap[species] += entry["Abundance count"];
    }
  }

  // Build rows with data for each species across all years
  return allSpecies.map(species => {
    const row: any = {
      key: species,
      species: species,
    };

    // Add data for each year
    yearsList.forEach(year => {
      const yearData = dataByYear[year];
      const frequencySet = yearData.frequencyMap[species];
      const abundancy = yearData.abundancyMap[species] || 0;
      const frequencyAbs = frequencySet ? frequencySet.size : 0;
      const frequencyPercent =
        yearData.totalVisits > 0 ? ((frequencyAbs / yearData.totalVisits) * 100).toFixed(0) : 0;

      row[year] = {
        display: `${frequencyPercent}% / ${abundancy}`,
        frequencyAbs: frequencyAbs,
        abundancy: abundancy,
      };
    });

    // Calculate year-over-year changes if there are at least 2 years
    const changes = calculateYearOverYearChanges(species, yearsList, dataByYear);
    if (changes) {
      row.abundancyChange = changes.abundancyChange;
      row.frequencyChange = changes.frequencyChange;
    }

    return row;
  });
}

interface AbsoluteFrequencyAndAbundancyProps {
  dataset: Dataset;
  yearsList: number[];
  targetTransect: string | null;
  targetSection: string | null;
}

function AbsoluteFrequencyAndAbundancy({
  dataset,
  yearsList,
  targetTransect,
  targetSection,
}: AbsoluteFrequencyAndAbundancyProps) {
  // Filter dataset by transect and section
  const filteredDataset = dataset.filter(entry => {
    const matchesTransect = !targetTransect || entry["Transect ID"] === targetTransect;
    const matchesSection = !targetSection || entry["Section Name"] === targetSection;
    return matchesTransect && matchesSection;
  });
  const anundanciaPorMesTitle = `Frequência e abundância`;
  const [searchText, setSearchText] = useState<string>("");
  const [searchedColumn, setSearchedColumn] = useState<string>("");
  const searchInput = useRef<any>(null);

  const handleSearch = (selectedKeys: React.Key[], confirm: () => void, dataIndex: string) => {
    confirm();
    setSearchText(selectedKeys[0] as string);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters: () => void) => {
    clearFilters();
    setSearchText("");
  };

  const getColumnSearchProps = (dataIndex: string): any => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }: any) => (
      <div style={{ padding: 8 }} onKeyDown={e => e.stopPropagation()}>
        <Input
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8, display: "block" }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
          >
            Reset
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              confirm({ closeDropdown: false });
              setSearchText(selectedKeys[0]);
              setSearchedColumn(dataIndex);
            }}
          >
            Filter
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              close();
            }}
          >
            close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
    ),
    onFilter: (value: any, record: any) =>
      record[dataIndex].toString().toLowerCase().includes(value.toLowerCase()),
    onFilterDropdownOpenChange: (visible: boolean) => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100);
      }
    },
    render: (text: any) =>
      searchedColumn === dataIndex ? (
        <Highlighter
          highlightStyle={{ backgroundColor: "#ffc069", padding: 0 }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ""}
        />
      ) : (
        text
      ),
  });

  // Build columns dynamically based on yearsList
  const columns: any[] = [
    {
      title: "Espécie",
      dataIndex: "species",
      key: "species",
      ...getColumnSearchProps("species"),
    },
    ...yearsList.map(year => ({
      title: year.toString(),
      dataIndex: year.toString(),
      key: year.toString(),
      render: (data: any) => (data ? data.display : "0% / 0"),
      sorter: (a: any, b: any) => {
        const aData = a[year] || { frequencyAbs: 0, abundancy: 0 };
        const bData = b[year] || { frequencyAbs: 0, abundancy: 0 };
        // Sort by frequency first, then by abundancy
        if (aData.frequencyAbs !== bData.frequencyAbs) {
          return aData.frequencyAbs - bData.frequencyAbs;
        }
        return aData.abundancy - bData.abundancy;
      },
    })),
    // Add year-over-year change columns if there are at least 2 years (as last columns)
    ...(yearsList.length >= 2
      ? [
          {
            title: "Dif. Frequência",
            dataIndex: "frequencyChange",
            key: "frequencyChange",
            render: (data: any) => {
              if (!data) return "-";
              const { display, percentChange } = data;

              // Apply color coding for changes > 10%
              let style: React.CSSProperties = {};
              if (percentChange !== null) {
                if (percentChange > 10) {
                  style = { color: "green", fontWeight: "bold" };
                } else if (percentChange < -10) {
                  style = { color: "red", fontWeight: "bold" };
                }
              }

              return <span style={style}>{display}</span>;
            },
            sorter: (a: any, b: any) => {
              const aChange = a.frequencyChange?.percentChange ?? 0;
              const bChange = b.frequencyChange?.percentChange ?? 0;
              return aChange - bChange;
            },
          },
          {
            title: "Var. Abundância",
            dataIndex: "abundancyChange",
            key: "abundancyChange",
            render: (data: any) => {
              if (!data) return "-";
              const { display, percentChange } = data;

              // Apply color coding for changes > 10%
              let style: React.CSSProperties = {};
              if (percentChange !== null) {
                if (percentChange > 10) {
                  style = { color: "green", fontWeight: "bold" };
                } else if (percentChange < -10) {
                  style = { color: "red", fontWeight: "bold" };
                }
              }

              return <span style={style}>{display}</span>;
            },
            sorter: (a: any, b: any) => {
              const aChange = a.abundancyChange?.percentChange ?? 0;
              const bChange = b.abundancyChange?.percentChange ?? 0;
              return aChange - bChange;
            },
          },
        ]
      : []),
  ];

  return (
    <Card title={anundanciaPorMesTitle} size="small">
      <div data-table-export>
        <Table
          dataSource={calculateRows(filteredDataset, yearsList)}
          columns={columns}
          pagination={{ showSizeChanger: true, defaultPageSize: 50 }}
        />
      </div>
      <Alert
        message="Frenquência é a percentagem de visitas em que foi avistada. Abundância é o total de indivíduos contados. Formato: Frequência% / Abundância"
        type="info"
      />
    </Card>
  );
}

export default AbsoluteFrequencyAndAbundancy;
