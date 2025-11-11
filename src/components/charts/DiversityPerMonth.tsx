import { Bar } from "react-chartjs-2";
import moment from "moment";
import { filterDataset } from "../utils";
import { Card, Alert } from "antd";
import { Dataset } from "../../types/dataset";

export const options = {
    responsive: true,
    plugins: {
        legend: {
            position: 'top' as const,
        },
    },
};

const LABELS_MONTHS = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
];
const SERIES_COLORS = [
    "#ea5545",
    "#f46a9b",
    "#ef9b20",
    "#edbf33",
    "#ede15b",
    "#bdcf32",
    "#87bc45",
    "#27aeef",
    "#b33dc6",
];

function getDiversityForYear(dataset: Dataset, year: number, targetTransect: string | null, targetSection: string | null): number[] {
    const filteredDataset = filterDataset(dataset, year, targetTransect, targetSection);

    let diversityPerMonth = LABELS_MONTHS.map(() => new Set<string>());

    for (const entry of filteredDataset) {
        const date = moment(entry.Date, "DD-MM-YYYY");

        const sp = entry["Preferred Species Name"];

        diversityPerMonth[date.month()].add(sp);
    }

    return diversityPerMonth.map(set => {
        for (const sp of set) {
            const isSingleWord = sp.split(" ").length === 1;
            const isFamily = sp.endsWith("ae");
            const hasSpeciesInSet = Array.from(set).find(setSp => {
                return setSp.split(" ").length === 2 && setSp.includes(sp);
            });
            const shouldBeCounted =
                !isSingleWord ||
                (isSingleWord && !isFamily && !hasSpeciesInSet);

            if (!shouldBeCounted) {
                set.delete(sp);
            }
        }

        return set.size;
    });
}

function getDiversityPerMonthForSpecies(dataset: Dataset, yearsList: number[], targetTransect: string | null, targetSection: string | null) {
    return {
        labels: LABELS_MONTHS,
        datasets: yearsList.map((year, index) => {
            return {
                label: year.toString(),
                data: getDiversityForYear(dataset, year, targetTransect, targetSection),
                backgroundColor: SERIES_COLORS[index],
            };
        }),
    };
}

interface DiversityPerMonthProps {
    dataset: Dataset;
    yearsList: number[];
    targetTransect: string | null;
    targetSection: string | null;
}

function DiversityPerMonth({ dataset, yearsList, targetTransect, targetSection }: DiversityPerMonthProps) {
    const anundanciaPorMesTitle = `Total de espécies por mês`;

    return (
        <Card title={anundanciaPorMesTitle} size="small">
            <Bar
                options={options}
                data={getDiversityPerMonthForSpecies(
                    dataset,
                    yearsList,
                    targetTransect,
                    targetSection
                )}
            />
            <Alert
                message="Observações só com o género são consideradas caso não hajam registos mais específicos. Acima disso nada é considerado."
                type="info"
            />
        </Card>
    );
}

export default DiversityPerMonth;
