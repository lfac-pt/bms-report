const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const https = require('https');

// File paths
const RAW_DATA_DIR = path.join(__dirname, '../raw-data');
const METADATA_FILE = path.join(RAW_DATA_DIR, 'metadata.csv');
const ALL_DATA_FILE = path.join(RAW_DATA_DIR, 'all.csv');
const GEOCODE_CACHE_FILE = path.join(RAW_DATA_DIR, 'geocode-cache.json');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'processed-transects.json');
const TIMELINE_OUTPUT_FILE = path.join(OUTPUT_DIR, 'timeline-data.json');

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
  'Cacyreus marshalli',
  'Callophrys avis',
  'Callophrys rubi',
  'Celastrina argiolus',
  'Cupido lorquinii',
  'Cupido minimus',
  'Eumedonia eumedon',
  'Favonius quercus',
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
  'Zerynthia rumina',
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
  'Brintesia circe',
  'Coenonympha arcania',
  'Coenonympha dorus',
  'Coenonympha glycerion',
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
 * Parse coordinates from the Spatial Reference field
 * Handles multiple formats:
 * - "latitude, longitude" (comma-separated)
 * - "latitude longitude" (space-separated)
 * - "39.41647N 9.5088W" or "40.068639N, 8.391275W" (with N/S/E/W notation)
 */
function parseCoordinates(spatialRef) {
  if (!spatialRef || typeof spatialRef !== 'string') return null;

  const original = spatialRef.trim();

  // Handle N/S/E/W notation (e.g., "39.41647N 9.5088W" or "40.068639N, 8.391275W")
  if (/[NSEW]/i.test(original)) {
    const match = original.match(/([\d.]+)\s*([NS])\s*,?\s*([\d.]+)\s*([EW])/i);
    if (match) {
      let lat = parseFloat(match[1]);
      let lon = parseFloat(match[3]);

      if (match[2].toUpperCase() === 'S') lat = -lat;
      if (match[4].toUpperCase() === 'W') lon = -lon;

      if (!isNaN(lat) && !isNaN(lon)) {
        return { lat, lon };
      }
    }
    return null;
  }

  // Try to split by comma first, then by space
  let parts;
  if (original.includes(',')) {
    // Comma-separated: clean up spaces around minus sign, then split by comma
    const cleaned = original.replace(/\s*-\s*/g, '-');
    parts = cleaned.split(',').map(p => p.trim());
  } else {
    // Space-separated: split by whitespace first, then clean each part
    parts = original.trim().split(/\s+/);
  }

  if (parts.length !== 2) return null;

  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lon)) return null;

  return { lat, lon };
}

/**
 * Reverse geocode coordinates to get location information using Nominatim
 */
function reverseGeocode(lat, lon) {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;

    const options = {
      headers: {
        'User-Agent': 'BMS-Portugal-Report/1.0'
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Known mapping of localities/freguesias to their correct concelhos
 */
const LOCALITY_TO_CONCELHO = {
  'Amora': 'Seixal',
  'Costa da Caparica': 'Almada',
  'Minde': 'Alcanena',
  'Quinta do Conde': 'Sesimbra',
  'Santo André': 'Santiago do Cacém',
  'Vila Nova de Milfontes': 'Odemira',
  'Azeitão': 'Setúbal',
};

/**
 * Extract Concelho and Distrito from Nominatim response
 */
function extractLocation(nominatimResponse) {
  if (!nominatimResponse || !nominatimResponse.address) {
    return { concelho: '', distrito: '' };
  }

  const addr = nominatimResponse.address;

  // Try municipality first, then fallback to city/town/village
  let concelho = addr.municipality || addr.city || addr.town || addr.village || '';

  // Check if this is a known locality that should be mapped to a different concelho
  if (LOCALITY_TO_CONCELHO[concelho]) {
    concelho = LOCALITY_TO_CONCELHO[concelho];
  }

  // Distrito is in county field for Portugal
  const distrito = addr.county || '';

  return { concelho, distrito };
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load geocode cache from file
 */
function loadGeocodeCache() {
  try {
    if (fs.existsSync(GEOCODE_CACHE_FILE)) {
      const cacheData = fs.readFileSync(GEOCODE_CACHE_FILE, 'utf-8');
      return JSON.parse(cacheData);
    }
  } catch (error) {
    console.warn('Warning: Failed to load geocode cache:', error.message);
  }
  return {};
}

/**
 * Save geocode cache to file
 */
function saveGeocodeCache(cache) {
  try {
    fs.writeFileSync(GEOCODE_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.warn('Warning: Failed to save geocode cache:', error.message);
  }
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
 * Add random offset to coordinates for privacy (approximately 500-1000 meters)
 */
function fuzzyCoordinates(coords) {
  if (!coords) return null;

  // Add random offset of ~0.005 to 0.01 degrees (roughly 500-1000 meters)
  const offsetLat = (Math.random() - 0.5) * 0.015;
  const offsetLon = (Math.random() - 0.5) * 0.015;

  return {
    lat: coords.lat + offsetLat,
    lon: coords.lon + offsetLon,
  };
}

/**
 * Calculate statistics for a transect
 */
function calculateTransectStats(transectId, allData, metadata, location = null, coords = null) {
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

  // Note: isActive will be determined later based on the most recent year across all transects

  return {
    transectId: transectId,
    transectCode: metadata['Transect Code'] || '',
    transectName: metadata['Transect Name'] || '',
    isActive: false, // Will be updated based on most recent year
    totalSpecies,
    totalVisits,
    totalAbundance,
    avgVisitsPerYear: Math.round(avgVisitsPerYear * 10) / 10, // Round to 1 decimal
    avgButterfliesPerVisit: Math.round(avgButterfliesPerVisit * 10) / 10, // Round to 1 decimal
    yearsActive,
    firstMonitoringYear,
    lastMonitoringYear,
    // List of species observed in this transect
    speciesList: [...speciesSet].sort(),
    // Additional metadata
    tipologia: metadata['Tipologia'] || '',
    concelho: location ? location.concelho : (metadata['Concelho'] || ''),
    distrito: location ? location.distrito : '',
    responsavel: metadata['Responsável'] || '',
    entidade: metadata['Entidade'] || '',
    // Fuzzy coordinates for privacy (approximate location only)
    coordinates: coords,
  };
}

/**
 * Process timeline data for all transects and years
 */
function processTimelineData(allData) {
  console.log('\nProcessing timeline data...');

  const timelineData = {
    years: [],
    transectsByYear: {},
    butterflyFrequencyByYear: {},
    transectDiversityByYear: {}
  };

  // Extract unique years from monitoring season (March-September)
  const yearsSet = new Set();
  allData.forEach(row => {
    const date = row['Date'];
    if (!date) return;

    // Parse date DD/MM/YYYY
    const parts = date.split('/');
    if (parts.length !== 3) return;
    const year = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10);

    // Filter to monitoring season (March-September)
    if (month >= 3 && month <= 9) {
      yearsSet.add(year);
    }
  });

  timelineData.years = Array.from(yearsSet).sort((a, b) => a - b);
  console.log(`  Found ${timelineData.years.length} years: ${timelineData.years.join(', ')}`);

  // Process each year
  timelineData.years.forEach(year => {
    // Filter data for this year (monitoring season only)
    const yearData = allData.filter(row => {
      const date = row['Date'];
      if (!date) return false;

      const parts = date.split('/');
      if (parts.length !== 3) return false;

      const rowYear = parseInt(parts[2], 10);
      const month = parseInt(parts[1], 10);
      const species = row['Preferred Species Name'];

      return rowYear === year &&
             month >= 3 && month <= 9 &&
             species &&
             VALID_SPECIES.has(species.trim());
    });

    console.log(`  Processing year ${year}: ${yearData.length} observations`);

    // 1. Transects active this year
    const transectsThisYear = new Set();
    yearData.forEach(row => {
      transectsThisYear.add(row['Transect ID']);
    });
    timelineData.transectsByYear[year] = Array.from(transectsThisYear);

    // 2. Butterfly frequency
    const allDatesThisYear = new Set();
    yearData.forEach(row => allDatesThisYear.add(row['Date']));
    const totalVisits = allDatesThisYear.size;

    const speciesVisitsMap = new Map();
    yearData.forEach(row => {
      const species = row['Preferred Species Name'].trim();
      if (!speciesVisitsMap.has(species)) {
        speciesVisitsMap.set(species, new Set());
      }
      speciesVisitsMap.get(species).add(row['Date']);
    });

    timelineData.butterflyFrequencyByYear[year] = Array.from(speciesVisitsMap.entries())
      .map(([species, dateSet]) => ({
        species,
        frequency: (dateSet.size / totalVisits) * 100,
        visitCount: dateSet.size,
        totalVisits
      }))
      .sort((a, b) => b.frequency - a.frequency);

    // 3. Diversity per transect
    const transectSpeciesMap = new Map();
    yearData.forEach(row => {
      const transectId = row['Transect ID'];
      const species = row['Preferred Species Name'].trim();

      if (!transectSpeciesMap.has(transectId)) {
        transectSpeciesMap.set(transectId, new Set());
      }
      transectSpeciesMap.get(transectId).add(species);
    });

    timelineData.transectDiversityByYear[year] = Array.from(transectSpeciesMap.entries())
      .map(([transectId, speciesSet]) => ({
        transectId,
        diversityCount: speciesSet.size,
        speciesList: Array.from(speciesSet).sort()
      }))
      .sort((a, b) => b.diversityCount - a.diversityCount);
  });

  console.log(`  ✓ Timeline data processed for ${timelineData.years.length} years`);
  return timelineData;
}

/**
 * Main processing function
 */
async function processData() {
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

  // Geocode transect coordinates to get Concelho and Distrito
  console.log('\nGeocoding transect coordinates...');
  const geocodeCache = loadGeocodeCache();
  const locationMap = {};
  const coordinatesMap = {}; // Store fuzzy coordinates for privacy
  let geocodedCount = 0;
  let cachedCount = 0;
  let failedCount = 0;
  let apiCallCount = 0;
  const failedTransects = [];

  for (const [transectId, metadata] of Object.entries(metadataMap)) {
    const coords = parseCoordinates(metadata['Spatial Refere']);

    // Store fuzzy coordinates for map display (privacy protection)
    if (coords) {
      coordinatesMap[transectId] = fuzzyCoordinates(coords);
    }

    if (coords) {
      const cacheKey = `${coords.lat.toFixed(5)},${coords.lon.toFixed(5)}`;

      // Check cache first
      if (geocodeCache[cacheKey]) {
        locationMap[transectId] = geocodeCache[cacheKey];
        cachedCount++;
      } else {
        try {
          // Respect Nominatim's usage policy: max 1 request per second
          await sleep(1000);

          const result = await reverseGeocode(coords.lat, coords.lon);
          const location = extractLocation(result);

          if (location.concelho || location.distrito) {
            locationMap[transectId] = location;
            geocodeCache[cacheKey] = location; // Save to cache
            geocodedCount++;
            apiCallCount++;

            // Log progress every 10 API calls
            if (apiCallCount % 10 === 0) {
              console.log(`  Made ${apiCallCount} API calls...`);
            }
          } else {
            failedCount++;
            failedTransects.push({
              name: metadata['Transect Name'],
              id: transectId,
              reason: 'No concelho/distrito in response'
            });
          }
        } catch (error) {
          console.warn(`  Warning: Failed to geocode transect ${metadata['Transect Name']}: ${error.message}`);
          failedCount++;
          failedTransects.push({
            name: metadata['Transect Name'],
            id: transectId,
            reason: error.message
          });
        }
      }
    } else {
      failedCount++;
      failedTransects.push({
        name: metadata['Transect Name'],
        id: transectId,
        coords: metadata['Spatial Refere'],
        reason: 'Invalid or missing coordinates'
      });
    }
  }

  // Save updated cache
  if (apiCallCount > 0) {
    saveGeocodeCache(geocodeCache);
    console.log(`\nCache updated with ${apiCallCount} new entries`);
  }

  console.log(`\nGeocoding complete: ${geocodedCount} from API, ${cachedCount} from cache, ${failedCount} failed`);

  if (failedTransects.length > 0) {
    console.log(`\nFailed to geocode ${failedTransects.length} transects:`);
    failedTransects.forEach(t => {
      if (t.coords) {
        console.log(`  - ${t.name} (ID: ${t.id})`);
        console.log(`    Coordinates: "${t.coords}"`);
        console.log(`    Reason: ${t.reason}`);
      } else {
        console.log(`  - ${t.name} (ID: ${t.id}) - ${t.reason}`);
      }
    });
  }

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
    const location = locationMap[transectId] || null;
    const coords = coordinatesMap[transectId] || null;
    const stats = calculateTransectStats(transectId, allData, metadata, location, coords);
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

  // Determine the most recent year across all transects
  const mostRecentYear = results.length > 0
    ? Math.max(...results.map(t => t.lastMonitoringYear || 0).filter(y => y > 0))
    : null;

  // Update isActive flag based on most recent year
  if (mostRecentYear) {
    results.forEach(transect => {
      transect.isActive = transect.lastMonitoringYear === mostRecentYear;
    });
    console.log(`Most recent monitoring year: ${mostRecentYear}`);
    console.log(`Active transects (monitored in ${mostRecentYear}): ${results.filter(t => t.isActive).length}`);
  }

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

  // Process and save timeline data
  const timelineData = processTimelineData(allData);
  console.log(`\nWriting timeline data to ${TIMELINE_OUTPUT_FILE}...`);
  fs.writeFileSync(TIMELINE_OUTPUT_FILE, JSON.stringify(timelineData, null, 2), 'utf-8');
  console.log(`Timeline data saved (${(fs.statSync(TIMELINE_OUTPUT_FILE).size / 1024).toFixed(2)} KB)`);

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
