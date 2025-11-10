import moment from "moment";

export function filterDataset(
    dataset,
    targetYear,
    targetTransect,
    targetSection
) {
    return dataset.filter(entry => {
        const date = moment(entry.Date, "DD-MM-YYYY");

        return (
            date.year() === targetYear &&
            entry["Transect ID"] === targetTransect &&
            (!targetSection || targetSection === entry["Section Name"])
        );
    });
}

export function getAllSpecies(dataset) {
    const speciesSet = new Set();

    for (const entry of dataset) {
        const species = entry["Preferred Species Name"];

        if (species.split(" ").length === 2) {
            speciesSet.add(species);
        }
    }

    return [...speciesSet];
}

export function getDiversityTotal(dataset) {
    let species = new Set();

    for (const entry of dataset) {
        species.add(entry["Preferred Species Name"]);
    }

    for (const sp of species) {
        const isSingleWord = sp.split(" ").length === 1;
        const isFamily = sp.endsWith("ae");
        const hasSpeciesInSet = Array.from(species).find(setSp => {
            return setSp.split(" ").length === 2 && setSp.includes(sp);
        });
        const shouldBeCounted =
            !isSingleWord || (isSingleWord && !isFamily && !hasSpeciesInSet);

        if (!shouldBeCounted) {
            species.delete(sp);
        }
    }

    return species.size;
}

export function getVisitsCount(dataset) {
    const dates = new Set();

    for (const entry of dataset) {
        dates.add(entry.Date);
    }

    return dates.size;
}

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

function abundancyPerMonthAllSpecies(dataset, year, targetTransect, targetSpecies) {
    let abundancyPerMonth = LABELS_MONTHS.map(() => 0);
    let visitsPerMonth = LABELS_MONTHS.map(() => new Set());
    const filteredDataset = filterDataset(dataset, year, targetTransect);

    for (const entry of filteredDataset) {
        const date = moment(entry.Date, "DD-MM-YYYY");

        if (targetSpecies.length === 0 || targetSpecies.includes(entry["Preferred Species Name"])) {
            visitsPerMonth[date.month()].add(entry.Date);

            abundancyPerMonth[date.month()] += entry["Abundance count"];
        }
    }

    visitsPerMonth = visitsPerMonth.map(set => set.size);

    return abundancyPerMonth.map((count, index) => {
        return count / visitsPerMonth[index];
    });
}

export function getAbundancyPerMonthForSpecies(dataset, targetSpecies, yearsList, targetTransect) {
    return {
            labels: LABELS_MONTHS,
            datasets: yearsList.map((year, index) => {
                return {
                    label: year,
                    data: abundancyPerMonthAllSpecies(dataset, year, targetTransect, targetSpecies),
                    backgroundColor: SERIES_COLORS[index],
                };
            })
        };
}

export function getAvgAbundancy(dataset) {
    let abundancyPerMonth = LABELS_MONTHS.map(() => 0);
    let visitsPerMonth = LABELS_MONTHS.map(() => new Set());

    for (const entry of dataset) {
        const date = moment(entry.Date, "DD-MM-YYYY");

        visitsPerMonth[date.month()].add(entry.Date);

        abundancyPerMonth[date.month()] += entry["Abundance count"];
    }

    visitsPerMonth = visitsPerMonth.map(set => set.size);

    abundancyPerMonth = abundancyPerMonth
        .map((count, index) => {
            return count / visitsPerMonth[index];
        })
        .filter(num => num >= 0);

    return (
        abundancyPerMonth.reduce((memo, num) => memo + num, 0) /
        abundancyPerMonth.length
    ).toFixed(1);
}
