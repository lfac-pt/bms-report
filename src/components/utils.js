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