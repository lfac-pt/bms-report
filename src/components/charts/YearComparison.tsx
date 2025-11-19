import {
  filterDataset,
  getVisitsCount,
  getDiversityTotal,
  getAllSpecies,
  getAvgAbundancy,
} from "../../utils/utils";
import { Card, Table, Tag, Tooltip } from "antd";
import { Dataset } from "../../types/dataset";
import { DatasetType } from "../../utils/datasetAdapter";

function getItemsNotInSet(list: string[], set: Set<string>): string[] {
  return list.filter(item => !set.has(item));
}

interface YearRow {
  year: number | string;
  visitsCount: number;
  diversityTotal: number;
  avgAbundancy?: string;
  newSpecies: string[];
}

function sum(rows: YearRow[], attr: keyof YearRow): number {
  return rows.reduce((memo, row) => {
    const value = row[attr];
    return memo + (typeof value === "number" ? value : 0);
  }, 0);
}

interface TagListProps {
  tags: string[];
  maxVisible?: number;
}

const TagList = ({ tags, maxVisible = 10 }: TagListProps) => {
  const visibleTags = tags.slice(0, maxVisible);
  const hiddenTags = tags.slice(maxVisible);

  return (
    <div data-content-for-pdf={tags.join(", ")}>
      {visibleTags.map((tag, index) => (
        <Tag key={index}>
          <i>{tag}</i>
        </Tag>
      ))}
      {hiddenTags.length > 0 && (
        <Tooltip
          title={
            <div>
              {hiddenTags.map((tag, index) => (
                <Tag key={index} style={{ marginBottom: 4 }}>
                  <i>{tag}</i>
                </Tag>
              ))}
            </div>
          }
        >
          <Tag>+{hiddenTags.length} more</Tag>
        </Tooltip>
      )}
    </div>
  );
};

function calculateRows(
  dataset: Dataset,
  yearsList: number[],
  transect: string | null,
  section: string | null
): YearRow[] {
  const speciesListByYear: Record<number, string[]> = {};

  const rows: YearRow[] = yearsList.map(year => {
    const filteredDataset = filterDataset(dataset, year, transect, section);
    const visitsCount = getVisitsCount(filteredDataset);
    const diversityTotal = getDiversityTotal(filteredDataset);
    const avgAbundancy = getAvgAbundancy(filteredDataset);

    speciesListByYear[year] = getAllSpecies(filteredDataset);

    return {
      year,
      visitsCount,
      diversityTotal,
      avgAbundancy,
      newSpecies: [],
    };
  });

  const speciesSoFar = new Set<string>();

  yearsList.forEach((year, index) => {
    const newSpecies = getItemsNotInSet(speciesListByYear[year], speciesSoFar);

    rows[index].newSpecies = newSpecies;

    speciesListByYear[year].forEach(item => speciesSoFar.add(item));
  });

  rows.reverse().push({
    year: "Total",
    visitsCount: sum(rows, "visitsCount"),
    diversityTotal: speciesSoFar.size,
    newSpecies: [],
  });

  return rows;
}

interface YearComparisonProps {
  dataset: Dataset;
  yearsList: number[];
  transect: string | null;
  section: string | null;
  datasetType: DatasetType;
}

function YearComparison({
  dataset,
  yearsList,
  transect,
  section,
  datasetType,
}: YearComparisonProps) {
  const visitLabel = datasetType === "nocturnal" ? "Sessões" : "Visitas";
  const visitSingular = datasetType === "nocturnal" ? "sessão" : "visita";

  const columns = [
    {
      title: "Ano",
      dataIndex: "year",
      key: "year",
    },
    {
      title: `# ${visitLabel} (ano)`,
      dataIndex: "visitsCount",
      key: "visitsCount",
    },
    {
      title: "Total de espécies",
      dataIndex: "diversityTotal",
      key: "diversityTotal",
    },
    {
      title: "Espécies novas",
      dataIndex: "newSpecies",
      key: "newSpecies",
      render: (_: any, { newSpecies }: YearRow) => <TagList tags={newSpecies} />,
    },
    {
      title: `Abundância média p/ ${visitSingular}`,
      dataIndex: "avgAbundancy",
      key: "avgAbundancy",
    },
  ];

  return (
    <Card title="Sumário por ano" size="small">
      <Table
        dataSource={calculateRows(dataset, yearsList, transect, section)}
        columns={columns}
        pagination={false}
        rowKey="year"
      />
    </Card>
  );
}

export default YearComparison;
