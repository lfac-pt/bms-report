const fs = require('fs');
const path = require('path');

// Read the current ecology data
const ecologyPath = path.join(__dirname, '../public/data/species-ecology.json');
const currentData = JSON.parse(fs.readFileSync(ecologyPath, 'utf-8'));

// Read the new species data
const newSpeciesPath = '/tmp/new-species.json';
const newSpeciesData = JSON.parse(fs.readFileSync(newSpeciesPath, 'utf-8'));

// Function to extract plant families from host plant string
function extractFamilies(hostPlantStr) {
  const families = new Set();

  // Match family names (typically end in -aceae or are well-known families)
  const familyPattern = /\b([A-Z][a-z]+aceae)\b/g;
  let match;
  while ((match = familyPattern.exec(hostPlantStr)) !== null) {
    families.add(match[1]);
  }

  return Array.from(families).sort();
}

// Function to extract specific plant species (binomial names)
function extractSpecies(hostPlantStr) {
  const species = new Set();

  // Match binomial nomenclature (Genus species or Genus abbreviation)
  // Pattern: Capital letter followed by lowercase, then space, then lowercase word
  const binomialPattern = /\b([A-Z][a-z]+)\\s+([a-z]+|[a-z]\\.\\s*[a-z]+)\b/g;
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
      ? `${genus} ${epithet.replace(/\\./g, '').trim()}`
      : `${genus} ${epithet}`;

    species.add(speciesName);
  }

  return Array.from(species).sort();
}

// Process new species
let addedCount = 0;
let skippedCount = 0;

Object.entries(newSpeciesData).forEach(([speciesName, data]) => {
  if (currentData[speciesName]) {
    console.log(`⊗ Skipping ${speciesName} (already exists)`);
    skippedCount++;
    return;
  }

  const hostPlantStr = data.hostPlant || '';

  currentData[speciesName] = {
    habitat: data.habitat,
    hostPlantFamilies: extractFamilies(hostPlantStr),
    hostPlantSpecies: extractSpecies(hostPlantStr),
    sources: data.sources
  };

  console.log(`✓ Added ${speciesName}`);
  addedCount++;
});

// Write the merged data
fs.writeFileSync(ecologyPath, JSON.stringify(currentData, null, 2), 'utf-8');

console.log(`\n✓ Successfully merged species data`);
console.log(`  Added: ${addedCount} new species`);
console.log(`  Skipped: ${skippedCount} existing species`);
console.log(`  Total: ${Object.keys(currentData).length} species`);
