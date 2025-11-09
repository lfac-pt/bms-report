import { Bar } from 'react-chartjs-2';
import { useState } from 'react';
import moment from 'moment';
import { Select, Card, Alert } from "antd";
import { getAllSpecies, getAbundancyPerMonthForSpecies } from '../utils';

export const options = {
    responsive: true,
    plugins: {
        legend: {
            position: 'top',
        },
    },
};

function AbundancyPerMonth({ dataset, yearsList, targetTransect }) {
    const [targetSpecies, setTargetSpecies] = useState([]);

    const speciesList = getAllSpecies(dataset);

    const speciesOptions = speciesList.map((species) => {
        return ({
            value: species,
            label: <span>{species}</span>
        });
    });

    const onTargetSpeciesChange = (newTargetSpecies) => {
        setTargetSpecies(newTargetSpecies);
    };

    const anundanciaPorMesTitle = `Abundância média por visita`;

    return (
        <Card title={anundanciaPorMesTitle} size="small">
            <Select
                options={speciesOptions}
                value={targetSpecies}
                onChange={onTargetSpeciesChange}
                mode="multiple"
                style={{ width: '100%' }}
                placeholder="Por favor escolha"
                defaultValue={targetSpecies}
            />
            <Bar options={options} data={getAbundancyPerMonthForSpecies(dataset, targetSpecies, yearsList, targetTransect)} />
            <Alert message="O total de indivíduos da a espécie no mês dividido por número de visitas" type="info" />
        </Card>
    );
}

export default AbundancyPerMonth;
