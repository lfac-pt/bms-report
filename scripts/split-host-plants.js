const fs = require('fs');
const path = require('path');

// Read the current ecology data
const ecologyPath = path.join(__dirname, '../public/data/species-ecology.json');
const ecologyData = JSON.parse(fs.readFileSync(ecologyPath, 'utf-8'));

// Function to extract plant families from host plant string
function extractFamilies(hostPlantStr) {
  const families = new Set();

  // Match family names (typically end in -aceae or are well-known families)
  const familyPattern = /\b([A-Z][a-z]+aceae)\b/g;
  let match;
  while ((match = familyPattern.exec(hostPlantStr)) !== null) {
    families.add(match[1]);
  }

  // Also check for other family/genus names that are standalone
  const standalonePattern = /\b(Quercus|Salix|Betula|Ulmus|Prunus|Malus|Pyrus|Crataegus|Sorbus|Humulus|Celtis|Arbutus|Vaccinium|Calluna|Rhamnus|Frangula|Ribes|Spiraea|Caragana|Chamaecytisus|Hedysarum|Genista|Hippophae|Rubus|Filipendula|Corylus|Lotus|Trifolium|Medicago|Vicia|Lathyrus|Anthyllis|Astragalus|Oxytropis|Hippocrepis|Cytisus|Genista|Melilotus|Coronilla|Ononis|Onobrychis|Spartium|Dolichos|Crotalaria|Polygala|Sutherlandia|Cajanus|Gliricidia|Indigofera|Lablab|Lupinus|Pisum|Pongamia|Pueraria|Robinia|Vigna|Xylia|Rumex|Oxyria|Plantago|Veronica|Digitalis|Melampyrum|Linaria|Antirrhinum|Misopates|Phlomis|Ballota|Viola|Erodium|Geranium|Pelargonium|Helianthemum|Tuberaria|Sinapis|Iberis|Biscutella|Raphanus|Moricandia|Isatis|Cardamine|Alliaria|Arabis|Barbarea|Capsella|Erysimum|Sisymbrium|Urtica|Parietaria|Pipturus|Boehmeria|Laportea|Cirsium|Carduus|Centaurea|Arctium|Onopordum|Helianthus|Artemisia|Senecio|Asclepias|Calotropis|Cynanchum|Gomphocarpus|Aristolochia|Lonicera|Foeniculum|Anthenum|Pastinaca|Daucus|Petroselinum|Peucedanum|Sanguisorba|Potentilla|Fragaria|Malva|Althaea|Sida|Abutilon|Callirhoe|Sphaeralcea|Poa|Agrostis|Lolium|Holcus|Brachypodium|Festuca|Ammophila|Aira|Bromus|Stipa|Deschampsia|Phleum|Phalaris|Calamagrostis|Agropyron)\b/gi;

  // Don't add genera if we already have the family
  const matches = hostPlantStr.match(standalonePattern);
  if (matches && families.size === 0) {
    // Only add if no family was found
    matches.forEach(genus => {
      // These are genera, not families - we might want to skip them
      // or map them to their families
    });
  }

  return Array.from(families).sort();
}

// Function to extract specific plant species (binomial names)
function extractSpecies(hostPlantStr) {
  const species = new Set();

  // Match binomial nomenclature (Genus species or Genus abbreviation)
  // Pattern: Capital letter followed by lowercase, then space, then lowercase word
  const binomialPattern = /\b([A-Z][a-z]+)\s+([a-z]+|[a-z]\.\s*[a-z]+)\b/g;
  let match;

  while ((match = binomialPattern.exec(hostPlantStr)) !== null) {
    const genus = match[1];
    const epithet = match[2];

    // Skip if it's likely a family name
    if (genus.endsWith('aceae')) continue;

    // Skip common words that aren't species
    const skipWords = ['and', 'the', 'of', 'in', 'to', 'with', 'for', 'on', 'at'];
    if (skipWords.includes(epithet.toLowerCase())) continue;

    // Clean up abbreviations like "V. canina"
    const speciesName = epithet.includes('.')
      ? `${genus} ${epithet.replace(/\./g, '').trim()}`
      : `${genus} ${epithet}`;

    species.add(speciesName);
  }

  return Array.from(species).sort();
}

// Transform the data
const transformedData = {};

Object.entries(ecologyData).forEach(([speciesName, data]) => {
  const hostPlantStr = data.hostPlant || '';

  transformedData[speciesName] = {
    habitat: data.habitat,
    hostPlantFamilies: extractFamilies(hostPlantStr),
    hostPlantSpecies: extractSpecies(hostPlantStr),
    sources: data.sources
  };
});

// Write the transformed data
fs.writeFileSync(ecologyPath, JSON.stringify(transformedData, null, 2), 'utf-8');

console.log('✓ Successfully split host plant data into families and species');
console.log(`  Processed ${Object.keys(transformedData).length} species`);

// Show some examples
console.log('\nExamples:');
const examples = Object.entries(transformedData).slice(0, 5);
examples.forEach(([name, data]) => {
  console.log(`\n${name}:`);
  console.log(`  Families: ${data.hostPlantFamilies.join(', ') || 'none'}`);
  console.log(`  Species: ${data.hostPlantSpecies.join(', ') || 'none'}`);
});
