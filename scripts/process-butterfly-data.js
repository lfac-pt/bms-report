const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// File paths
const RAW_DATA_DIR = path.join(__dirname, '../raw-data');
const METADATA_FILE = path.join(RAW_DATA_DIR, 'metadata.csv');
const ALL_DATA_FILE = path.join(RAW_DATA_DIR, 'all.csv');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'processed-transects.json');

// Valid species whitelist - only these species should be considered
const VALID_SPECIES = new Set([
  'Carcharodus alceae',
  'Carcharodus baeticus',
  'Carcharodus tripolinus',
  'Erynnis tages',
  'Gegenes nostrodamus',
  'Hesperia comma',
  'Muschampia proto',
  'Ochlodes sylvanus',
  'Pyrgus alveus',
  'Pyrgus armoricanus',
  'Pyrgus malvoides',
  'Pyrgus onopordi',
  'Pyrgus serratulae',
  'Spialia sertorius',
  'Thymelicus acteon',
  'Thymelicus lineola',
  'Thymelicus sylvestris',
  'Aricia cramera',
  'Aricia montensis',
  'Cacyreus marschallii',
  'Callophrys avis',
  'Callophrys rubi',
  'Celastrina argiolus',
  'Cupido lorquinii',
  'Cupido minimus',
  'Eumedonia eumedon',
  'Flavonius quercus',
  'Glaucopsyche alexis',
  'Glaucopsyche melanops',
  'Hamearis lucina',
  'Laeosopis roboris',
  'Lampides boeticus',
  'Leptotes pirithous',
  'Lycaena alciphron',
  'Lycaena bleusei',
  'Lycaena phlaeas',
  'Lycaena tityrus',
  'Lycaena virgaureae',
  'Lysandra bellargus',
  'Phengaris alcon',
  'Plebejus argus',
  'Polyommatus celina',
  'Polyommatus icarus',
  'Polyommatus semiargus',
  'Polyommatus thersites',
  'Pseudophilotes abencerragus',
  'Pseudophilotes baton',
  'Pseudophilotes panoptes',
  'Satyrium esculi',
  'Satyrium ilicis',
  'Satyrium spini',
  'Thecla betulae',
  'Tomares ballus',
  'Zizeeria knysna',
  'Aglais io',
  'Aglais urticae',
  'Apatura ilia',
  'Argynnis pandora',
  'Argynnis paphia',
  'Boloria dia',
  'Boloria euphrosyne',
  'Boloria selene',
  'Brenthis daphne',
  'Brenthis hecate',
  'Brenthis ino',
  'Charaxes jasius',
  'Danaus chrysippus',
  'Danaus plexippus',
  'Euphydryas aurinia',
  'Euphydryas desfontainii',
  'Fabriciana adippe',
  'Fabriciana niobe',
  'Issoria lathonia',
  'Libythea celtis',
  'Limenitis camilla',
  'Limenitis reducta',
  'Melitaea aetherie',
  'Melitaea cinxia',
  'Melitaea deione',
  'Melitaea didyma',
  'Melitaea celadussa',
  'Melitaea parthenoides',
  'Melitaea phoebe',
  'Melitaea trivia',
  'Nymphalis antiopa',
  'Nymphalis polychloros',
  'Polygonia c-album',
  'Speyeria aglaja',
  'Vanessa atalanta',
  'Vanessa cardui',
  'Vanessa virginiensis',
  'Iphiclides feisthamelii',
  'Papilio machaon',
  'Zeryntia rumina',
  'Anthocharis cardamines',
  'Anthocharis euphenoides',
  'Aporia crataegi',
  'Colias crocea',
  'Euchloe belemia',
  'Euchloe crameri',
  'Euchloe tagis',
  'Gonepteryx cleopatra',
  'Gonepteryx rhamni',
  'Leptidea sinapis',
  'Pieris brassicae',
  'Pieris napi',
  'Pieris rapae',
  'Pontia daplidice',
  'Arethusana arethusa',
  'Brinthesia circe',
  'Coenonympha arcania',
  'Coenonympha dorus',
  'Coenonympha glycerion iphioides',
  'Coenonympha pamphilus',
  'Erebia triarius',
  'Hipparchia fidia',
  'Hipparchia hermione',
  'Hipparchia semele',
  'Hipparchia statilinus',
  'Hyponephele lupinus',
  'Hyponephele lycaon',
  'Lasiommata maera',
  'Lasiommata megera',
  'Maniola jurtina',
  'Melanargia ines',
  'Melanargia lachesis',
  'Melanargia occitanica',
  'Melanargia russiae',
  'Pararge aegeria',
  'Pyronia bathseba',
  'Pyronia cecilia',
  'Pyronia tithonus',
  'Satyrus actaea',
]);

/**
 * Parse a date string in DD/MM/YYYY format and extract the year
 */
function getYearFromDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[2], 10);
  return isNaN(year) ? null : year;
}

/**
 * Parse a date string in DD/MM/YYYY format and extract the month (0-indexed)
 */
function getMonthFromDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[1], 10) - 1; // Convert to 0-indexed (0 = Jan, 1 = Feb, etc.)
  return isNaN(month) ? null : month;
}

/**
 * Read and parse a CSV file
 */
function readCSV(filePath) {
  console.log(`Reading ${filePath}...`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep everything as strings initially
  });

  if (result.errors.length > 0) {
    console.warn(`Warnings while parsing ${filePath}:`, result.errors);
  }

  console.log(`  Loaded ${result.data.length} rows`);
  return result.data;
}

/**
 * Calculate statistics for a transect
 */
function calculateTransectStats(transectId, allData, metadata) {
  // Filter data for this transect AND only include valid species
  const transectData = allData.filter(row => {
    if (row['Transect ID'] !== transectId) return false;

    const species = row['Preferred Species Name'];
    if (!species || !species.trim()) return false;

    // Only include records for species in the whitelist
    return VALID_SPECIES.has(species.trim());
  });

  if (transectData.length === 0) {
    return null;
  }

  // Get unique species (using Preferred Species Name)
  // All species are already filtered by the whitelist, so just count unique ones
  const speciesSet = new Set();
  transectData.forEach(row => {
    const species = row['Preferred Species Name'];
    if (species && species.trim()) {
      speciesSet.add(species.trim());
    }
  });

  // Get unique dates and years
  const datesSet = new Set();
  transectData.forEach(row => {
    const date = row['Date'];
    if (date && date.trim()) {
      datesSet.add(date.trim());
    }
  });

  // Calculate years active and first monitoring year using only monitoring season data
  // Monitoring season is March-September (months 2-8 in 0-indexed)
  const monitoringSeasonData = transectData.filter(row => {
    const month = getMonthFromDate(row['Date']);
    return month !== null && month >= 2 && month <= 8;
  });

  const monitoringYearsSet = new Set();
  monitoringSeasonData.forEach(row => {
    const year = getYearFromDate(row['Date']);
    if (year) {
      monitoringYearsSet.add(year);
    }
  });

  // Calculate total abundance
  let totalAbundance = 0;
  transectData.forEach(row => {
    const abundance = parseInt(row['Abundance Count'], 10);
    if (!isNaN(abundance)) {
      totalAbundance += abundance;
    }
  });

  // Calculate statistics
  const totalSpecies = speciesSet.size;
  const totalVisits = datesSet.size;
  const yearsActive = monitoringYearsSet.size;
  const firstMonitoringYear = monitoringYearsSet.size > 0 ? Math.min(...monitoringYearsSet) : null;
  const lastMonitoringYear = monitoringYearsSet.size > 0 ? Math.max(...monitoringYearsSet) : null;
  const avgVisitsPerYear = yearsActive > 0 ? totalVisits / yearsActive : 0;
  const avgButterfliesPerVisit = totalVisits > 0 ? totalAbundance / totalVisits : 0;

  return {
    transectId: transectId,
    transectCode: metadata['Transect Code'] || '',
    transectName: metadata['Transect Name'] || '',
    isActive: metadata['Estado'] === 'Ativo',
    totalSpecies,
    totalVisits,
    avgVisitsPerYear: Math.round(avgVisitsPerYear * 10) / 10, // Round to 1 decimal
    avgButterfliesPerVisit: Math.round(avgButterfliesPerVisit * 10) / 10, // Round to 1 decimal
    yearsActive,
    firstMonitoringYear,
    lastMonitoringYear,
    // List of species observed in this transect
    speciesList: [...speciesSet].sort(),
    // Additional metadata
    tipologia: metadata['Tipologia'] || '',
    concelho: metadata['Concelho'] || '',
    responsavel: metadata['Responsável'] || '',
    entidade: metadata['Entidade'] || '',
  };
}

/**
 * Main processing function
 */
function processData() {
  console.log('Starting butterfly data processing...\n');

  // Read metadata
  const metadataRows = readCSV(METADATA_FILE);

  // Check for the specific transect the user is looking for
  const targetTransect = metadataRows.find(row =>
    row['Transect Name'] && row['Transect Name'].includes('Baldios de São Miguel de Poiares')
  );
  if (targetTransect) {
    console.log(`\nFound target transect: ${targetTransect['Transect Name']}`);
    console.log(`  ID: ${targetTransect['Transect ID']}`);
    console.log(`  Situação: ${targetTransect['Situação']}`);
  } else {
    console.log(`\nTarget transect "Baldios de São Miguel de Poiares" not found in metadata`);
  }

  // Filter for valid and new transects (trim to handle trailing spaces)
  const validTransects = metadataRows.filter(row => {
    const situacao = (row['Situação'] || '').trim();
    return situacao === 'Válido' || situacao === 'Novo';
  });
  console.log(`\nFound ${validTransects.length} valid/new transects (out of ${metadataRows.length} total)\n`);

  // Read all butterfly observation data
  const allData = readCSV(ALL_DATA_FILE);

  // Create a map of metadata by Transect ID for quick lookup
  const metadataMap = {};
  validTransects.forEach(row => {
    const transectId = row['Transect ID'];
    if (transectId && transectId.trim()) {
      metadataMap[transectId.trim()] = row;
    }
  });

  // Track filtered species (those not in the whitelist)
  const filteredSpeciesSet = new Set();
  const validTransectIds = new Set(Object.keys(metadataMap));

  // Collect all species that were filtered out from valid transects
  allData.forEach(row => {
    const transectId = row['Transect ID'];
    if (!validTransectIds.has(transectId)) return; // Skip invalid transects

    const species = row['Preferred Species Name'];
    if (!species || !species.trim()) return;

    const trimmedSpecies = species.trim();
    // Check if it's a valid binomial name but NOT in the whitelist
    if (trimmedSpecies.split(' ').length === 2 && !VALID_SPECIES.has(trimmedSpecies)) {
      filteredSpeciesSet.add(trimmedSpecies);
    }
  });

  // Calculate statistics for each valid transect
  console.log('\nCalculating statistics for each transect...');
  const results = [];
  let processedCount = 0;
  const skippedTransects = [];

  Object.entries(metadataMap).forEach(([transectId, metadata]) => {
    const stats = calculateTransectStats(transectId, allData, metadata);
    if (stats) {
      results.push(stats);
      processedCount++;

      // Log progress every 20 transects
      if (processedCount % 20 === 0) {
        console.log(`  Processed ${processedCount} transects...`);
      }
    } else {
      skippedTransects.push({
        id: transectId,
        name: metadata['Transect Name'] || 'Unknown',
        situacao: metadata['Situação'] || 'Unknown',
      });
    }
  });

  console.log(`\nSuccessfully calculated statistics for ${results.length} transects`);

  if (skippedTransects.length > 0) {
    console.log(`\nSkipped ${skippedTransects.length} transects (no valid observation data):`);
    skippedTransects.forEach(t => {
      console.log(`  - ${t.name} (ID: ${t.id}, Situação: ${t.situacao})`);
    });
  }

  // Sort by transect name
  results.sort((a, b) => a.transectName.localeCompare(b.transectName));

  // Prepare filtered species list
  const filteredSpeciesList = Array.from(filteredSpeciesSet).sort();

  // Create output object with transects and metadata
  const output = {
    transects: results,
    metadata: {
      totalValidTransects: results.length,
      activeTransects: results.filter(t => t.isActive).length,
      inactiveTransects: results.filter(t => !t.isActive).length,
      filteredSpeciesCount: filteredSpeciesList.length,
      filteredSpecies: filteredSpeciesList,
    },
  };

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write to JSON file
  console.log(`\nWriting results to ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

  console.log('\n✓ Processing complete!');
  console.log(`\nSummary:`);
  console.log(`  - Total valid transects: ${results.length}`);
  console.log(`  - Active transects: ${results.filter(t => t.isActive).length}`);
  console.log(`  - Inactive transects: ${results.filter(t => !t.isActive).length}`);
  console.log(`  - Filtered species: ${filteredSpeciesList.length}`);
  console.log(`  - Output file: ${OUTPUT_FILE}`);
  console.log(`  - File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
}

// Run the script
try {
  processData();
} catch (error) {
  console.error('\n❌ Error processing data:', error);
  process.exit(1);
}
