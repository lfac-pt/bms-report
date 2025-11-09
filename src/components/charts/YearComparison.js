import {
  filterDataset,
  getVisitsCount,
  getDiversityTotal,
  getAllSpecies,
} from "../utils";
import { Card, Table, Tag, Tooltip } from "antd";

function getItemsNotInSet(list, set) {
  return list.filter(item => !set.has(item));
}

function sum(rows, attr) {
  return rows.reduce((memo, row) => memo + row[attr], 0);
}

const TagList = ({ tags, maxVisible = 10 }) => {
  const visibleTags = tags.slice(0, maxVisible);
  const hiddenTags = tags.slice(maxVisible);

  return (
    <div>
      {visibleTags.map((tag, index) => (
        <Tag key={index}>{tag}</Tag>
      ))}
      {hiddenTags.length > 0 && (
        <Tooltip
          title={
            <div>
              {hiddenTags.map((tag, index) => (
                <Tag key={index} style={{ marginBottom: 4 }}>
                  {tag}
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

function calculateRows(dataset, yearsList, transect, section) {
  const speciesListByYear = {};

  const reversedYearsList = yearsList.toReversed();

  const rows = reversedYearsList.map(year => {
    const filteredDataset = filterDataset(dataset, year, transect, section);
    const visitsCount = getVisitsCount(filteredDataset);
    const diversityTotal = getDiversityTotal(filteredDataset);
    speciesListByYear[year] = getAllSpecies(filteredDataset);

    return {
      year,
      visitsCount,
      diversityTotal,
    };
  });

  const speciesSoFar = new Set();

  reversedYearsList.forEach((year, index) => {
    const newSpecies = getItemsNotInSet(speciesListByYear[year], speciesSoFar);

    rows[index].newSpecies = newSpecies;

    speciesListByYear[year].forEach(item => speciesSoFar.add(item));
  });

  rows.unshift({
    year: "Total",
    visitsCount: sum(rows, "visitsCount"),
    diversityTotal: speciesSoFar.size,
    newSpecies: []
  });

  return rows.toReversed();
}

function YearComparison({ dataset, yearsList, transect, section }) {
  const columns = [
    {
      title: "Ano",
      dataIndex: "year",
      key: "year",
    },
    {
      title: "# Visitas",
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
      render: (_, { newSpecies }) => <TagList tags={newSpecies} />
    },
  ];

  return (
    <Card title="Sumário por ano" size="small">
      <Table
        dataSource={calculateRows(dataset, yearsList, transect, section)}
        columns={columns}
        pagination={false}
      />
    </Card>
  );
}

export default YearComparison;
