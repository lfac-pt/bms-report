import { Bar } from 'react-chartjs-2';
import { useState } from 'react';
import moment from 'moment';
import { Select, Card, Alert } from "antd";

export const options = {
    responsive: true,
    plugins: {
        legend: {
            position: 'top',
        },
    },
};

const LABELS_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const SERIES_COLORS = ["#ea5545", "#f46a9b", "#ef9b20", "#edbf33", "#ede15b", "#bdcf32", "#87bc45", "#27aeef", "#b33dc6"];

function getAllSpecies(dataset) {
    const speciesSet = new Set();

    for (const entry of dataset) {
        const species = entry['Preferred Species Name'];

        if (species.split(" ").length === 2) {
            speciesSet.add(species);
        }
    }

    return [...speciesSet];
}

function getAbundancyPerMonthForSpecies(dataset, targetSpecies) {
    if (targetSpecies.length === 0) {
        let abundancyPerMonth = LABELS_MONTHS.map(() => 0);
        let visitsPerMonth = LABELS_MONTHS.map(() => new Set());

        for (const entry of dataset) {
            const date = moment(entry.Date, "DD-MM-YYYY");

            visitsPerMonth[date.month()].add(entry.Date);

            abundancyPerMonth[date.month()] += entry['Abundance count'];
        }

        visitsPerMonth = visitsPerMonth.map((set) => set.size);

        abundancyPerMonth = abundancyPerMonth.map((count, index) => {
            return count / visitsPerMonth[index];
        });

        return {
            labels: LABELS_MONTHS,
            datasets: [{
                label: "Todas as espécies",
                data: abundancyPerMonth,
                backgroundColor: SERIES_COLORS[0],
            }]
        };
    }

    const datasetsForChat = targetSpecies.map((targetSp, index) => {
        return {
            label: targetSp,
            data: LABELS_MONTHS.map(() => 0),
            backgroundColor: SERIES_COLORS[index],
        };
    });

    let visitsPerMonth = LABELS_MONTHS.map(() => new Set());

    for (const entry of dataset) {
        const date = moment(entry.Date, "DD-MM-YYYY");

        visitsPerMonth[date.month()].add(entry.Date);

        if (targetSpecies.includes(entry['Preferred Species Name'])) {
            const targetSpIndex = targetSpecies.indexOf(entry['Preferred Species Name']);

            datasetsForChat[targetSpIndex].data[date.month()] += entry['Abundance count'];
        }
    }

    visitsPerMonth = visitsPerMonth.map((set) => set.size);

    for (const species of datasetsForChat) {
        species.data = species.data.map((count, index) => {
            return count / visitsPerMonth[index];
        });
    }

    return {
        labels: LABELS_MONTHS,
        datasets: datasetsForChat
    };
}

function AbundancyPerMonth({ dataset }) {
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
            <Bar options={options} data={getAbundancyPerMonthForSpecies(dataset, targetSpecies)} />
            <Alert message="O total de indivíduos da a espécie no mês dividido por número de visitas" type="info" />
        </Card>
    );
}

export default AbundancyPerMonth;
