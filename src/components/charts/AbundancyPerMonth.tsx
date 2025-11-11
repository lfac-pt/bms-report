import { Bar } from 'react-chartjs-2';
import { useState } from 'react';
import { Select, Card, Alert } from "antd";
import { getAllSpecies, getAbundancyPerMonthForSpecies } from '../utils';
import { Dataset } from '../../types/dataset';

export const options = {
    responsive: true,
    plugins: {
        legend: {
            position: 'top' as const,
        },
    },
};

interface AbundancyPerMonthProps {
    dataset: Dataset;
    yearsList: number[];
    targetTransect: string | null;
    targetSection: string | null;
}

function AbundancyPerMonth({ dataset, yearsList, targetTransect, targetSection }: AbundancyPerMonthProps) {
    const [targetSpecies, setTargetSpecies] = useState<string[]>([]);

    const speciesList = getAllSpecies(dataset);

    const speciesOptions = speciesList.map((species) => {
        return ({
            value: species,
            label: <span>{species}</span>
        });
    });

    const onTargetSpeciesChange = (newTargetSpecies: string[] | null) => {
        setTargetSpecies(!newTargetSpecies ? [] : newTargetSpecies);
    };

    const anundanciaPorMesTitle = `Abundância média por visita`;

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
                    (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%', marginBottom: '16px' }}
                placeholder="Todas as espécies (ou escolha uma ou mais)"
                defaultValue={targetSpecies}
            />
            {targetSpecies.length > 0 ? (
                targetSpecies.map((species) => (
                    <div key={species} style={{ marginBottom: '24px' }}>
                        <h4>{species}</h4>
                        <Bar options={options} data={getAbundancyPerMonthForSpecies(dataset, [species], yearsList, targetTransect, targetSection)} />
                    </div>
                ))
            ) : (
                <Bar options={options} data={getAbundancyPerMonthForSpecies(dataset, targetSpecies, yearsList, targetTransect, targetSection)} />
            )}
            <Alert message="O total de indivíduos da espécie no mês dividido por número de visitas" type="info" />
        </Card>
    );
}

export default AbundancyPerMonth;
