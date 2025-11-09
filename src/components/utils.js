import moment from "moment";

export function filterDataset(dataset, targetYear, targetTransect, targetSection) {
    return dataset.filter((entry) => {
        const date = moment(entry.Date, "DD-MM-YYYY");

        return date.year() === targetYear && entry["Transect ID"] === targetTransect && (targetSection === null || targetSection === entry["Section Name"]);
    });
}

export function getAllSpecies(dataset) {
	const speciesSet = new Set();

	for (const entry of dataset) {
		const species = entry['Preferred Species Name'];

		if (species.split(" ").length === 2) {
			speciesSet.add(species);
		}
	}

	return [...speciesSet];
}

export function getDiversityTotal(dataset) {
    let species = new Set();
  
    for (const entry of dataset) {
      species.add(entry['Preferred Species Name']); 
    }
  
    for (const sp of species) {
        const isSingleWord = sp.split(" ").length === 1;
        const isFamily = sp.endsWith("ae");
        const hasSpeciesInSet = Array.from(species).find((setSp) => {
          return setSp.split(" ").length === 2 && setSp.includes(sp);
        });
        const shouldBeCounted = !isSingleWord || (isSingleWord && !isFamily && !hasSpeciesInSet);
  
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

const LABELS_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const SERIES_COLORS = ["#ea5545", "#f46a9b", "#ef9b20", "#edbf33", "#ede15b", "#bdcf32", "#87bc45", "#27aeef", "#b33dc6"];

export function getAbundancyPerMonthForSpecies(dataset, targetSpecies) {
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

export function getAvgAbundancy(dataset) {
  const abundancyPerMonth = getAbundancyPerMonthForSpecies(dataset, []).datasets[0].data.filter((num) => num >= 0);

  return (abundancyPerMonth.reduce((memo, num) => memo + num, 0) / abundancyPerMonth.length).toFixed(1);
}