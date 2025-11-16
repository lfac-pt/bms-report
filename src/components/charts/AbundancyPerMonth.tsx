import { Bar } from "react-chartjs-2";
import { useState } from "react";
import { Select, Card, Alert } from "antd";
import { getAllSpecies, getAbundancyPerMonthForSpecies } from "../utils";
import { Dataset } from "../../types/dataset";
import { DatasetType } from "../../utils/datasetAdapter";

export const options = {
  responsive: true,
  plugins: {
    legend: {
      position: "top" as const,
    },
  },
};

interface AbundancyPerMonthProps {
  dataset: Dataset;
  yearsList: number[];
  targetTransect: string | null;
  targetSection: string | null;
  datasetType: DatasetType;
}

function AbundancyPerMonth({
  dataset,
  yearsList,
  targetTransect,
  targetSection,
  datasetType,
}: AbundancyPerMonthProps) {
  const [targetSpecies, setTargetSpecies] = useState<string[]>([]);

  const visitSingular = datasetType === "nocturnal" ? "sessão" : "visita";
  const visitLabel = datasetType === "nocturnal" ? "sessões" : "visitas";

  const speciesList = getAllSpecies(dataset);

  const speciesOptions = speciesList.map(species => {
    return {
      value: species,
      label: (
        <span>
          <i>{species}</i>
        </span>
      ),
    };
  });

  const onTargetSpeciesChange = (newTargetSpecies: string[] | null) => {
    setTargetSpecies(!newTargetSpecies ? [] : newTargetSpecies);
  };

  const anundanciaPorMesTitle = `Abundância média por ${visitSingular}`;

  return (
    <Card title={anundanciaPorMesTitle} size="small">
      <Select
        mode="multiple"
        options={speciesOptions}
        value={targetSpecies}
        onChange={onTargetSpeciesChange}
        allowClear
        showSearch
        filterOption={(input, option) =>
          (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
        }
        style={{ width: "100%", marginBottom: "16px" }}
        placeholder="Todas as espécies (ou escolha uma ou mais)"
        defaultValue={targetSpecies}
      />
      <div data-chart-export data-chart-export-title={`Abundância média por ${visitSingular}`}>
        {targetSpecies.length > 0 ? (
          targetSpecies.map(species => (
            <div key={species} style={{ marginBottom: "24px" }}>
              <h4>{species}</h4>
              <Bar
                options={options}
                data={getAbundancyPerMonthForSpecies(
                  dataset,
                  [species],
                  yearsList,
                  targetTransect,
                  targetSection
                )}
              />
            </div>
          ))
        ) : (
          <Bar
            options={options}
            data={getAbundancyPerMonthForSpecies(
              dataset,
              targetSpecies,
              yearsList,
              targetTransect,
              targetSection
            )}
          />
        )}
        <Alert
          message={`O total de indivíduos da espécie no mês dividido por número de ${visitLabel}`}
          type="info"
        />
      </div>
    </Card>
  );
}

export default AbundancyPerMonth;
