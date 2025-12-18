const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const https = require('https');
const rbmsUtils = require('./rbms-utils');

// File paths
const RAW_DATA_DIR = path.join(__dirname, '../raw-data');
const METADATA_FILE = path.join(RAW_DATA_DIR, 'metadata.csv');
const ALL_DATA_FILE = path.join(RAW_DATA_DIR, 'all.csv');
const GEOCODE_CACHE_FILE = path.join(RAW_DATA_DIR, 'geocode-cache.json');
const TEMP_RBMS_DIR = path.join(RAW_DATA_DIR, 'temp-rbms');
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
  'Cyaniris semiargus', // Synonym for Polyommatus semiargus
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

// Grassland butterfly species for GBI calculation
// Based on European Grassland Butterfly Indicator
// Source: https://www.eea.europa.eu/en/analysis/indicators/grassland-butterfly-index-in-europe-1
const GRASSLAND_SPECIES = {
  // Widespread species (7)
  widespread: new Set([
    'Anthocharis cardamines',
    'Coenonympha pamphilus',
    'Lasiommata megera',
    'Lycaena phlaeas',
    'Maniola jurtina',
    'Ochlodes sylvanus',
    'Polyommatus icarus',
  ]),
  // Specialist species (7)
  specialist: new Set([
    'Cupido minimus',
    'Cyaniris semiargus', // Also known as Polyommatus semiargus
    'Erynnis tages',
    'Euphydryas aurinia',
    'Lysandra bellargus',
    'Spialia sertorius',
    'Thymelicus acteon',
  ])
};

// Get all grassland species as a single set
const ALL_GRASSLAND_SPECIES = new Set([
  ...GRASSLAND_SPECIES.widespread,
  ...GRASSLAND_SPECIES.specialist
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
 * Mapping of distritos to climatic regions
 * Based on Portugal's geographic and climatic divisions
 */
const DISTRITO_TO_CLIMATIC_REGION = {
  // Norte (North) - Atlantic climate
  'Viana do Castelo': 'Norte',
  'Braga': 'Norte',
  'Porto': 'Norte',
  'Vila Real': 'Norte',
  'Bragança': 'Norte',

  // Centro (Center) - Transition zone
  'Aveiro': 'Centro',
  'Viseu': 'Centro',
  'Guarda': 'Centro',
  'Coimbra': 'Centro',
  'Castelo Branco': 'Centro',
  'Leiria': 'Centro',

  // Lisboa e Vale do Tejo - Mediterranean influence
  'Lisboa': 'Lisboa e Vale do Tejo',
  'Santarém': 'Lisboa e Vale do Tejo',
  'Setúbal': 'Lisboa e Vale do Tejo',

  // Alentejo - Mediterranean/Continental
  'Portalegre': 'Alentejo',
  'Évora': 'Alentejo',
  'Beja': 'Alentejo',

  // Algarve - Mediterranean
  'Faro': 'Algarve',
};

/**
 * Get climatic region from distrito
 */
function getClimaticRegion(distrito) {
  return DISTRITO_TO_CLIMATIC_REGION[distrito] || 'Desconhecido';
}

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
    climaticRegion: getClimaticRegion(location ? location.distrito : ''),
    responsavel: metadata['Responsável'] || '',
    entidade: metadata['Entidade'] || '',
    // Fuzzy coordinates for privacy (approximate location only)
    coordinates: coords,
  };
}

/**
 * Filter transects based on quality criteria for GBI
 * Criteria: 5+ years active, 10+ visits per year average
 */
function getQualityFilteredTransects(transects) {
  return transects.filter(t =>
    t.yearsActive >= 5 && t.avgVisitsPerYear >= 10
  );
}

/**
 * Calculate total abundance for grassland species by year across quality transects
 */
function calculateSpeciesAbundanceByYear(allData, qualityTransectIds) {
  const abundanceByYearSpecies = {}; // { year: { species: totalAbundance } }

  allData.forEach(row => {
    const transectId = row['Transect ID'];
    if (!qualityTransectIds.has(transectId)) return;

    const year = getYearFromDate(row['Date']);
    if (!year) return;

    const month = getMonthFromDate(row['Date']);
    if (month === null || month < 2 || month > 8) return; // Monitoring season only (March-September)

    const species = row['Preferred Species Name'];
    if (!species || !ALL_GRASSLAND_SPECIES.has(species.trim())) return;

    const abundance = parseInt(row['Abundance Count'], 10) || 0;

    if (!abundanceByYearSpecies[year]) {
      abundanceByYearSpecies[year] = {};
    }

    if (!abundanceByYearSpecies[year][species]) {
      abundanceByYearSpecies[year][species] = 0;
    }

    abundanceByYearSpecies[year][species] += abundance;
  });

  return abundanceByYearSpecies;
}

/**
 * Calculate log-linear trend for a species
 * Returns slope from least squares regression on log-transformed data
 */
function calculateLogLinearTrend(yearlyAbundance, baselineYear) {
  const years = Object.keys(yearlyAbundance).map(Number).sort((a, b) => a - b);

  if (years.length < 3) {
    return null;
  }

  // Transform: x = years since baseline, y = log(abundance + 1)
  const points = years.map(year => ({
    x: year - baselineYear,
    y: Math.log(yearlyAbundance[year] + 1) // +1 to handle zeros
  }));

  // Least squares regression
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept, years };
}

/**
 * Calculate species index for a given year
 * Index = 100 * exp(slope * (year - baseline))
 */
function calculateSpeciesIndex(slope, year, baselineYear) {
  return 100 * Math.exp(slope * (year - baselineYear));
}

/**
 * Calculate geometric mean of species indices
 * Geometric mean = exp(mean(log(indices)))
 */
function calculateGeometricMean(values) {
  if (values.length === 0) return 0;

  // Filter out non-positive values
  const positiveValues = values.filter(v => v > 0);
  if (positiveValues.length === 0) return 0;

  const logSum = positiveValues.reduce((sum, v) => sum + Math.log(v), 0);
  const logMean = logSum / positiveValues.length;

  return Math.exp(logMean);
}

/**
 * Calculate percentile from sorted array using linear interpolation
 * @param {number[]} sortedArray - Array sorted in ascending order
 * @param {number} p - Percentile to calculate (0-100)
 * @returns {number} Percentile value
 */
function percentile(sortedArray, p) {
  if (sortedArray.length === 0) return 0;
  if (sortedArray.length === 1) return sortedArray[0];

  const index = (p / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sortedArray[lower];
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

/**
 * Calculate 95% bootstrap confidence intervals for GBI
 * Uses species-level resampling (resample which species contribute to geometric mean)
 *
 * @param {Object} speciesTrends - Species trend data with annual indices
 * @param {number[]} years - Array of years to calculate CI for
 * @param {number} nBootstrap - Number of bootstrap iterations (default 1000)
 * @returns {Object} CI bounds per year: { year: { ci_lower, ci_upper } }
 */
function calculateBootstrapCI(speciesTrends, years, nBootstrap = 1000) {
  const speciesNames = Object.keys(speciesTrends);
  const ciByYear = {};

  console.log(`  Bootstrap: ${nBootstrap} iterations, ${speciesNames.length} species`);

  for (const year of years) {
    // Get valid indices for this year
    const observedIndices = speciesNames
      .map(sp => speciesTrends[sp].annualIndices[year])
      .filter(idx => idx !== undefined && idx > 0);

    if (observedIndices.length < 2) {
      console.warn(`  Year ${year}: insufficient species for CI (${observedIndices.length})`);
      ciByYear[year] = { ci_lower: null, ci_upper: null };
      continue;
    }

    const n = observedIndices.length;

    // Bootstrap resampling with replacement
    const bootstrapGBIs = [];
    for (let b = 0; b < nBootstrap; b++) {
      const resampled = [];
      for (let i = 0; i < n; i++) {
        const randomIdx = Math.floor(Math.random() * n);
        resampled.push(observedIndices[randomIdx]);
      }
      bootstrapGBIs.push(calculateGeometricMean(resampled));
    }

    // Sort and extract percentiles
    bootstrapGBIs.sort((a, b) => a - b);

    ciByYear[year] = {
      ci_lower: Math.round(percentile(bootstrapGBIs, 2.5) * 100) / 100,
      ci_upper: Math.round(percentile(bootstrapGBIs, 97.5) * 100) / 100
    };
  }

  return ciByYear;
}

/**
 * Main GBI calculation function
 */
async function calculateGBI(allData, transects, baselineYear = 2021) {
  console.log('\nCalculating Grassland Butterfly Index (GBI) using rbms...');

  // Step 1: Filter quality transects
  const qualityTransects = getQualityFilteredTransects(transects);

  // Filter to only include transects active in the most recent year
  const activeQualityTransects = qualityTransects.filter(t => t.isActive);
  const qualityTransectIds = activeQualityTransects.map(t => t.transectId);

  console.log(`  Quality transects: ${qualityTransects.length} (5+ years, 10+ visits/year)`);
  console.log(`  Active in most recent year: ${activeQualityTransects.length}`);

  if (activeQualityTransects.length === 0) {
    console.warn('  Warning: No active quality transects found for GBI calculation');
    return null;
  }

  // Step 2: Prepare temporary directory for rbms data exchange
  if (!fs.existsSync(TEMP_RBMS_DIR)) {
    fs.mkdirSync(TEMP_RBMS_DIR, { recursive: true });
  }

  // Step 3: Transform data for rbms
  // rbms expects: transectId, date (YYYY-MM-DD), year, species, count
  const transformedData = allData
    .filter(row => {
      const month = getMonthFromDate(row['Date']);
      return month !== null && month >= 3 && month <= 9; // Monitoring season
    })
    .map(row => ({
      transectId: row['Transect ID'],
      date: row['Date'], // Still in DD/MM/YYYY, will convert per-species
      year: getYearFromDate(row['Date']),
      month: getMonthFromDate(row['Date']),
      species: row['Preferred Species Name'],
      count: parseInt(row['Abundance Count']) || 0
    }))
    .filter(row => row.year >= 2021); // Start from 2021

  console.log(`  Transformed ${transformedData.length} observations for rbms`);

  // Get all years
  const allYears = Array.from(new Set(transformedData.map(row => row.year))).sort((a, b) => a - b);
  console.log(`  Years with data: ${allYears.join(', ')}`);

  if (allYears.length < 3) {
    console.warn(`  Warning: Insufficient years of data: ${allYears.length}`);
    return null;
  }

  // Step 4: Process each grassland species with rbms
  const speciesTrends = {};
  const allSpecies = Array.from(ALL_GRASSLAND_SPECIES);
  const rScriptPath = path.join(__dirname, 'rbms-collated-index.R');

  console.log(`  Processing ${allSpecies.length} grassland species with rbms...`);

  // Debug: Check what species we actually have in the data
  const speciesInData = new Set(transformedData.map(row => row.species));
  console.log(`  Species found in data (${speciesInData.size}):`);
  console.log(`  All species: ${Array.from(speciesInData).sort().join(', ')}`);
  console.log(`  Grassland species in data:`);
  Array.from(speciesInData).sort().forEach(sp => {
    if (ALL_GRASSLAND_SPECIES.has(sp)) {
      const count = transformedData.filter(r => r.species === sp).length;
      console.log(`    - ${sp}: ${count} observations`);
    }
  });

  // Check first few rows of transformedData
  console.log(`  Sample transformed data (first 3 rows):`);
  transformedData.slice(0, 3).forEach(row => {
    console.log(`    ${JSON.stringify(row)}`);
  });

  for (const species of allSpecies) {
    try {
      console.log(`\n  Processing: ${species}`);

      // Extract data for this species
      const speciesData = rbmsUtils.extractSpeciesData(
        transformedData,
        qualityTransectIds,
        species
      );

      console.log(`    Found: ${speciesData.visits.length} visits, ${speciesData.counts.length} counts`);

      if (speciesData.visits.length < 10) {
        console.log(`    Skipping: insufficient visits (${speciesData.visits.length})`);
        continue;
      }

      if (speciesData.counts.length < 5) {
        console.log(`    Skipping: insufficient counts (${speciesData.counts.length})`);
        continue;
      }

      // Create safe filename
      const speciesSafe = rbmsUtils.sanitizeFilename(species);

      // Write CSV files
      const visitsFile = path.join(TEMP_RBMS_DIR, `visits_${speciesSafe}.csv`);
      const countsFile = path.join(TEMP_RBMS_DIR, `counts_${speciesSafe}.csv`);
      const outputFile = path.join(TEMP_RBMS_DIR, `output_${speciesSafe}.json`);

      rbmsUtils.writeCSV(visitsFile, speciesData.visits, ['site_id', 'date', 'year']);
      rbmsUtils.writeCSV(countsFile, speciesData.counts, ['site_id', 'date', 'count']);

      console.log(`    Visits: ${speciesData.visits.length}, Counts: ${speciesData.counts.length}`);

      // Call R script with extended timeout (2 minutes per species)
      const args = [visitsFile, countsFile, outputFile, species, baselineYear.toString()];

      try {
        await rbmsUtils.callRbms(rScriptPath, args, 120000, {
          visitsFile,
          countsFile,
          sourceDataFiles: [ALL_DATA_FILE, METADATA_FILE]
        }); // 2 minute timeout with caching

        // Read and validate results
        if (!fs.existsSync(outputFile)) {
          throw new Error('R script did not produce output file');
        }

        const outputJSON = fs.readFileSync(outputFile, 'utf8');
        const rbmsOutput = JSON.parse(outputJSON);

        // Validate output
        rbmsUtils.validateRbmsOutput(rbmsOutput, species, allYears);

        // Check if we got valid indices
        if (Object.keys(rbmsOutput.collated_indices).length < 3) {
          throw new Error(`Insufficient years with rbms indices: ${Object.keys(rbmsOutput.collated_indices).length}`);
        }

        // Store species trend
        const speciesType = GRASSLAND_SPECIES.widespread.has(species) ? 'widespread' : 'specialist';
        const yearsWithData = Object.keys(rbmsOutput.collated_indices).map(Number);

        // Calculate slope from indices (log-linear regression for metadata)
        const indices = yearsWithData.map(year => rbmsOutput.collated_indices[year]);
        const years = yearsWithData.map(year => year - baselineYear);
        const logIndices = indices.map(idx => Math.log(idx));
        const n = years.length;
        const sumX = years.reduce((a, b) => a + b, 0);
        const sumY = logIndices.reduce((a, b) => a + b, 0);
        const sumXY = years.reduce((sum, x, i) => sum + x * logIndices[i], 0);
        const sumX2 = years.reduce((sum, x) => sum + x * x, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        // Extract rbms-calculated bootstrap confidence intervals
        let confidenceIntervals = {};
        if (rbmsOutput.confidence_intervals && Object.keys(rbmsOutput.confidence_intervals).length > 0) {
          for (const [year, ci] of Object.entries(rbmsOutput.confidence_intervals)) {
            confidenceIntervals[parseInt(year)] = {
              ci_lower: ci.ci_lower,
              ci_upper: ci.ci_upper
            };
          }
          console.log(`    ✓ rbms bootstrap CIs: ${Object.keys(confidenceIntervals).length} years`);
        } else {
          console.log(`    ⚠ No bootstrap CIs available from rbms`);
        }

        speciesTrends[species] = {
          species,
          type: speciesType,
          slope: slope,
          yearsWithData,
          annualIndices: rbmsOutput.collated_indices,
          confidenceIntervals: confidenceIntervals,
          dataQuality: rbmsOutput.data_quality,
          method: 'rbms'
        };

        console.log(`    ✓ rbms success: ${yearsWithData.length} years, R²=${rbmsOutput.data_quality.flight_curve_r2}`);

        // Clean up temp files
        try {
          fs.unlinkSync(visitsFile);
          fs.unlinkSync(countsFile);
          fs.unlinkSync(outputFile);
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }

      } catch (rbmsError) {
        console.log(`    rbms failed: ${rbmsError.message.split('\n')[0]}`);
        console.log(`    Species excluded from GBI`);
        continue;
      }

    } catch (err) {
      console.log(`    Error: ${err.message}`);
      continue;
    }
  }

  const speciesWithTrends = Object.keys(speciesTrends);
  console.log(`\n  Species successfully processed: ${speciesWithTrends.length}/${allSpecies.length}`);

  if (speciesWithTrends.length === 0) {
    console.warn('  Warning: No species trends calculated');
    return null;
  }

  // Step 5: Calculate GBI for each year using geometric mean
  const gbiByYear = {};

  allYears.forEach(year => {
    const speciesIndicesThisYear = {};
    const indicesForGBI = [];

    speciesWithTrends.forEach(species => {
      const index = speciesTrends[species].annualIndices[year];
      if (index !== undefined && index > 0) {
        speciesIndicesThisYear[species] = index;
        indicesForGBI.push(index);
      }
    });

    if (indicesForGBI.length === 0) {
      console.warn(`  Warning: No species indices for year ${year}`);
      return;
    }

    const gbiValue = calculateGeometricMean(indicesForGBI);

    // Count transects and visits for this year
    const yearData = transformedData.filter(row => row.year === year);
    const transectsThisYear = new Set(yearData.map(row => row.transectId));
    const datesThisYear = new Set(yearData.map(row => row.date));

    gbiByYear[year] = {
      year,
      gbiValue: Math.round(gbiValue * 100) / 100, // Round to 2 decimals
      speciesIndices: speciesIndicesThisYear,
      dataQuality: {
        transectCount: transectsThisYear.size,
        totalVisits: datesThisYear.size,
        speciesWithData: Object.keys(speciesIndicesThisYear).length
      }
    };

    console.log(`  ${year}: GBI=${gbiValue.toFixed(2)}, species=${Object.keys(speciesIndicesThisYear).length}`);
  });

  // Step 5.5: Calculate bootstrap confidence intervals
  console.log('  Calculating 95% bootstrap confidence intervals...');
  const confidenceIntervals = calculateBootstrapCI(speciesTrends, allYears, 1000);

  // Merge CI data into gbiByYear
  allYears.forEach(year => {
    if (gbiByYear[year] && confidenceIntervals[year]) {
      gbiByYear[year].ci_lower = confidenceIntervals[year].ci_lower;
      gbiByYear[year].ci_upper = confidenceIntervals[year].ci_upper;
    }
  });

  console.log(`  CI calculated for ${allYears.length} years`);

  // Step 6: Compile metadata
  const grasslandSpeciesList = allSpecies.map(species => ({
    scientificName: species,
    type: GRASSLAND_SPECIES.widespread.has(species) ? 'widespread' : 'specialist'
  }));

  const transectsUsedList = activeQualityTransects.map(t => ({
    transectId: t.transectId,
    transectName: t.transectName
  })).sort((a, b) => a.transectName.localeCompare(b.transectName));

  const metadata = {
    baselineYear,
    grasslandSpecies: grasslandSpeciesList,
    qualityCriteria: {
      minYearsActive: 5,
      minVisitsPerYear: 10
    },
    transectsUsed: transectsUsedList,
    calculationMethod: 'rbms (GAM flight curves + GLM collated indices + geometric mean)',
    confidenceInterval: {
      method: 'species_bootstrap',
      nIterations: 1000,
      confidenceLevel: 0.95
    }
  };

  console.log(`  ✓ GBI calculated for ${Object.keys(gbiByYear).length} years using rbms`);

  return {
    metadata,
    gbiByYear,
    speciesTrends,
    years: allYears
  };
}

/**
 * Calculate flight curves for all species with sufficient data using rbms
 * @param {Array} allData - Raw butterfly observation data
 * @param {Array} transects - Transect metadata
 * @param {number} baselineYear - Baseline year for index normalization
 * @returns {Object|null} Flight curve data for all species
 */
async function calculateAllFlightCurves(allData, transects, baselineYear = 2021) {
  console.log('\nCalculating flight curves for all species using rbms...');

  // Step 1: Use same quality transect filtering as GBI
  const qualityTransects = getQualityFilteredTransects(transects);
  const activeQualityTransects = qualityTransects.filter(t => t.isActive);
  const qualityTransectIds = activeQualityTransects.map(t => t.transectId);

  console.log(`  Quality transects: ${qualityTransects.length} (5+ years, 10+ visits/year)`);
  console.log(`  Active in most recent year: ${activeQualityTransects.length}`);

  if (activeQualityTransects.length === 0) {
    console.warn('  Warning: No active quality transects found');
    return null;
  }

  // Step 2: Prepare temporary directory for rbms data exchange
  if (!fs.existsSync(TEMP_RBMS_DIR)) {
    fs.mkdirSync(TEMP_RBMS_DIR, { recursive: true });
  }

  // Step 3: Transform data for rbms
  const transformedData = allData
    .filter(row => {
      const month = getMonthFromDate(row['Date']);
      return month !== null && month >= 3 && month <= 9; // Monitoring season
    })
    .map(row => ({
      transectId: row['Transect ID'],
      date: row['Date'],
      year: getYearFromDate(row['Date']),
      month: getMonthFromDate(row['Date']),
      species: row['Preferred Species Name'],
      count: parseInt(row['Abundance Count']) || 0
    }))
    .filter(row => row.year >= 2021); // Start from 2021

  console.log(`  Transformed ${transformedData.length} observations for rbms`);

  // Get all years
  const allYears = Array.from(new Set(transformedData.map(row => row.year))).sort((a, b) => a - b);
  console.log(`  Years with data: ${allYears.join(', ')}`);

  if (allYears.length < 3) {
    console.warn(`  Warning: Insufficient years of data: ${allYears.length}`);
    return null;
  }

  // Step 4: Get all species with sufficient data
  const speciesCounts = new Map();
  transformedData.forEach(row => {
    if (!qualityTransectIds.includes(row.transectId)) return;

    const current = speciesCounts.get(row.species) || { observations: 0, counts: 0, years: new Set() };
    current.observations++;
    if (row.count > 0) current.counts++;
    current.years.add(row.year);
    speciesCounts.set(row.species, current);
  });

  // Filter to species with sufficient data AND in the whitelist
  const eligibleSpecies = Array.from(speciesCounts.entries())
    .filter(([species, stats]) => {
      return VALID_SPECIES.has(species) &&
             stats.counts >= 20 &&
             stats.years.size >= 3; // At least 20 counts across 3 years
    })
    .map(([species]) => species)
    .sort();

  console.log(`  Found ${eligibleSpecies.length} species in whitelist with sufficient data (20+ counts, 3+ years)`);

  // Step 5: Process each species with rbms
  const speciesResults = {};
  const rScriptPath = path.join(__dirname, 'rbms-collated-index.R');
  let successCount = 0;

  for (const species of eligibleSpecies) {
    try {
      // Extract data for this species
      const speciesData = rbmsUtils.extractSpeciesData(
        transformedData,
        qualityTransectIds,
        species
      );

      if (speciesData.visits.length < 10 || speciesData.counts.length < 5) {
        continue; // Skip silently
      }

      // Prepare temporary files
      const sanitized = rbmsUtils.sanitizeFilename(species);
      const visitsFile = path.join(TEMP_RBMS_DIR, `visits_${sanitized}.csv`);
      const countsFile = path.join(TEMP_RBMS_DIR, `counts_${sanitized}.csv`);
      const outputFile = path.join(TEMP_RBMS_DIR, `output_${sanitized}.json`);

      rbmsUtils.writeCSV(visitsFile, speciesData.visits, ['site_id', 'date', 'year']);
      rbmsUtils.writeCSV(countsFile, speciesData.counts, ['site_id', 'date', 'count']);

      const args = [visitsFile, countsFile, outputFile, species, baselineYear.toString()];

      // Call rbms R script with caching
      await rbmsUtils.callRbms(rScriptPath, args, 120000, {
        visitsFile,
        countsFile,
        sourceDataFiles: [ALL_DATA_FILE, METADATA_FILE]
      });

      // Check if R script created the output file
      if (!fs.existsSync(outputFile)) {
        throw new Error('R script did not produce output file (likely insufficient data for model fitting)');
      }

      // Read and validate results
      const outputJSON = fs.readFileSync(outputFile, 'utf8');
      const rbmsOutput = JSON.parse(outputJSON);
      rbmsUtils.validateRbmsOutput(rbmsOutput, species, allYears);

      // Extract confidence intervals from rbms bootstrap
      const confidenceIntervals = {};
      if (rbmsOutput.confidence_intervals && Object.keys(rbmsOutput.confidence_intervals).length > 0) {
        for (const [year, ci] of Object.entries(rbmsOutput.confidence_intervals)) {
          confidenceIntervals[parseInt(year)] = {
            ci_lower: ci.ci_lower,
            ci_upper: ci.ci_upper
          };
        }
      }

      // Store results
      speciesResults[species] = {
        collatedIndices: rbmsOutput.collated_indices,
        phenologyCurves: rbmsOutput.phenology_curves || null,
        dataQuality: rbmsOutput.data_quality,
        processingInfo: rbmsOutput.processing_info,
        confidenceIntervals: confidenceIntervals
      };

      successCount++;

      // Clean up temp files
      fs.unlinkSync(visitsFile);
      fs.unlinkSync(countsFile);
      fs.unlinkSync(outputFile);

    } catch (error) {
      // Skip species that fail - don't log to keep output clean
      continue;
    }
  }

  console.log(`  ✓ Successfully processed ${successCount}/${eligibleSpecies.length} species`);

  if (successCount === 0) {
    console.warn('  Warning: No species successfully processed');
    return null;
  }

  // Step 6: Compile metadata
  const transectsUsedList = activeQualityTransects.map(t => ({
    transectId: t.transectId,
    transectName: t.transectName
  })).sort((a, b) => a.transectName.localeCompare(b.transectName));

  const metadata = {
    processingDate: new Date().toISOString(),
    baselineYear,
    qualityCriteria: {
      minYearsActive: 5,
      minVisitsPerYear: 10,
      minCountsPerSpecies: 20,
      minYearsPerSpecies: 3
    },
    transectsUsed: transectsUsedList,
    method: 'rbms (GAM flight curves + GLM collated indices)'
  };

  return {
    metadata,
    species: speciesResults,
    speciesList: Object.keys(speciesResults).sort(),
    years: allYears
  };
}

/**
 * Calculate phenology curves (weekly abundance predictions) by region using rbms
 *
 * @param {Array} allData - Raw observation data
 * @param {Array} transects - All transect information
 * @param {number} baselineYear - Baseline year for normalization
 * @returns {Object} Phenology data organized by species and region
 */
async function calculateRegionalPhenology(allData, transects, baselineYear = 2021) {
  console.log('\nCalculating regional phenology curves using rbms...');

  // Step 1: Get quality transects (same criteria as GBI)
  const qualityTransects = getQualityFilteredTransects(transects);
  const activeQualityTransects = qualityTransects.filter(t => t.isActive);

  console.log(`  Quality transects: ${qualityTransects.length} (5+ years, 10+ visits/year)`);
  console.log(`  Active in most recent year: ${activeQualityTransects.length}`);

  // Step 2: Group transects by climatic region
  const transectsByRegion = {};
  const REGIONS = ['Norte', 'Centro', 'Lisboa e Vale do Tejo', 'Alentejo', 'Algarve'];

  REGIONS.forEach(region => {
    transectsByRegion[region] = activeQualityTransects.filter(
      t => t.climaticRegion === region
    );
  });

  console.log('\n  Transects by region:');
  REGIONS.forEach(region => {
    console.log(`    ${region}: ${transectsByRegion[region].length} transects`);
  });

  // Step 3: Transform data for rbms
  const transformedData = allData
    .filter(row => {
      const date = row['Date'];
      if (!date) return false;

      const parts = date.split('/');
      if (parts.length !== 3) return false;

      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return month >= 3 && month <= 9 && year >= 2021; // Monitoring season, 2021+
    })
    .map(row => ({
      transectId: row['Transect ID'],
      date: row['Date'],
      year: parseInt(row['Date'].split('/')[2], 10),
      month: parseInt(row['Date'].split('/')[1], 10) - 1,
      species: row['Preferred Species Name'].trim(),
      count: parseInt(row['Abundance Count'], 10) || 0
    }));

  // Step 4: Identify species with sufficient data (using quality transects only)
  const qualityTransectIds = new Set(activeQualityTransects.map(t => t.transectId));
  const speciesCounts = new Map();

  transformedData.forEach(row => {
    if (!VALID_SPECIES.has(row.species)) return;
    if (!qualityTransectIds.has(row.transectId)) return; // Only count from quality transects

    if (!speciesCounts.has(row.species)) {
      speciesCounts.set(row.species, {
        counts: 0,
        years: new Set()
      });
    }

    const stats = speciesCounts.get(row.species);
    stats.counts += row.count;
    stats.years.add(row.year);
  });

  const eligibleSpecies = Array.from(speciesCounts.entries())
    .filter(([species, stats]) => {
      return stats.counts >= 20 && stats.years.size >= 3;
    })
    .map(([species]) => species)
    .sort();

  console.log(`\n  Found ${eligibleSpecies.length} species with sufficient data (20+ counts, 3+ years)`);

  // Step 5: Process each species for each region
  const regionalResults = {};
  const rScriptPath = path.join(__dirname, 'rbms-collated-index.R');
  let totalProcessed = 0;

  for (const species of eligibleSpecies) {
    console.log(`\n  Processing: ${species}`);
    regionalResults[species] = {
      regions: {}
    };

    for (const region of REGIONS) {
      const regionTransects = transectsByRegion[region];

      if (regionTransects.length < 2) {
        console.log(`    ${region}: skipped (< 2 transects)`);
        continue;
      }

      try {
        // Extract data for this species in this region
        const regionTransectIds = regionTransects.map(t => t.transectId);
        const speciesData = rbmsUtils.extractSpeciesData(
          transformedData,
          regionTransectIds,
          species
        );

        if (speciesData.visits.length < 10 || speciesData.counts.length < 5) {
          console.log(`    ${region}: skipped (insufficient data)`);
          continue;
        }

        // Prepare temporary files
        const sanitized = rbmsUtils.sanitizeFilename(species);
        const regionSanitized = region.replace(/\s+/g, '_').toLowerCase();
        const visitsFile = path.join(TEMP_RBMS_DIR, `visits_${sanitized}_${regionSanitized}.csv`);
        const countsFile = path.join(TEMP_RBMS_DIR, `counts_${sanitized}_${regionSanitized}.csv`);
        const outputFile = path.join(TEMP_RBMS_DIR, `output_${sanitized}_${regionSanitized}.json`);

        rbmsUtils.writeCSV(visitsFile, speciesData.visits, ['site_id', 'date', 'year']);
        rbmsUtils.writeCSV(countsFile, speciesData.counts, ['site_id', 'date', 'count']);

        const args = [visitsFile, countsFile, outputFile, species, baselineYear.toString()];

        // Call rbms R script with caching
        await rbmsUtils.callRbms(rScriptPath, args, 120000, {
          visitsFile,
          countsFile,
          sourceDataFiles: [ALL_DATA_FILE, METADATA_FILE]
        });

        // Check if R script created the output file
        if (!fs.existsSync(outputFile)) {
          throw new Error('R script did not produce output file (likely insufficient data for model fitting)');
        }

        // Read results
        const outputJSON = fs.readFileSync(outputFile, 'utf8');
        const rbmsOutput = JSON.parse(outputJSON);

        // Store phenology curves for this region
        if (rbmsOutput.phenology_curves) {
          regionalResults[species].regions[region] = {
            phenologyCurves: rbmsOutput.phenology_curves,
            dataQuality: {
              transectCount: regionTransects.length,
              totalVisits: speciesData.visits.length,
              totalCounts: speciesData.counts.length
            }
          };
          console.log(`    ${region}: ✓ ${Object.keys(rbmsOutput.phenology_curves).length} years`);
          totalProcessed++;
        }

        // Clean up temp files
        fs.unlinkSync(visitsFile);
        fs.unlinkSync(countsFile);
        fs.unlinkSync(outputFile);

      } catch (error) {
        console.log(`    ${region}: failed (${error.message})`);
        continue;
      }
    }

    // If no regions succeeded, remove the species
    if (Object.keys(regionalResults[species].regions).length === 0) {
      delete regionalResults[species];
    }
  }

  console.log(`\n  ✓ Successfully processed ${totalProcessed} species-region combinations`);

  if (Object.keys(regionalResults).length === 0) {
    console.warn('  Warning: No regional phenology curves calculated');
    return null;
  }

  // Step 6: Compile metadata
  const metadata = {
    processingDate: new Date().toISOString(),
    baselineYear,
    regions: REGIONS,
    transectsByRegion: Object.fromEntries(
      REGIONS.map(region => [region, transectsByRegion[region].length])
    ),
    qualityCriteria: {
      minYearsActive: 5,
      minVisitsPerYear: 10,
      minCountsPerSpecies: 20,
      minYearsPerSpecies: 3,
      minTransectsPerRegion: 2
    },
    method: 'rbms (GAM flight curves with regional filtering)'
  };

  return {
    metadata,
    species: regionalResults,
    speciesList: Object.keys(regionalResults).sort()
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
    transectDiversityByYear: {},
    observationsByYearDate: {}  // For filtering butterfly frequency by transect
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

    // 4. Store observations by date for abundance (include ALL species, not just valid ones)
    // For abundance calculations, we want to count all butterflies, not just validated species
    const yearDataAllSpecies = allData.filter(row => {
      const date = row['Date'];
      if (!date) return false;

      const parts = date.split('/');
      if (parts.length !== 3) return false;

      const rowYear = parseInt(parts[2], 10);
      const month = parseInt(parts[1], 10);
      const species = row['Preferred Species Name'];

      return rowYear === year &&
             month >= 3 && month <= 9 &&
             species;  // Only check that species exists, don't filter by VALID_SPECIES
    });

    const observationsByDate = {};
    yearDataAllSpecies.forEach(row => {
      const date = row['Date'];
      const transectId = row['Transect ID'];
      const species = row['Preferred Species Name'].trim();
      const abundance = parseInt(row['Abundance Count'], 10) || 0;

      if (!observationsByDate[date]) {
        observationsByDate[date] = [];
      }

      // Store as compact array [transectId, species, abundance]
      observationsByDate[date].push([transectId, species, abundance]);
    });

    timelineData.observationsByYearDate[year] = observationsByDate;
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

  // Track filtered species (those not in the whitelist) with record counts and total individuals
  const filteredSpeciesMap = new Map();
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
      const count = parseInt(row['Abundance Count'], 10) || 0;
      const existing = filteredSpeciesMap.get(trimmedSpecies) || { recordCount: 0, totalIndividuals: 0 };
      filteredSpeciesMap.set(trimmedSpecies, {
        recordCount: existing.recordCount + 1,
        totalIndividuals: existing.totalIndividuals + count
      });
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

  // Prepare filtered species list with record counts and total individuals
  const filteredSpeciesList = Array.from(filteredSpeciesMap.entries())
    .map(([species, data]) => ({
      species,
      recordCount: data.recordCount,
      totalIndividuals: data.totalIndividuals
    }))
    .sort((a, b) => a.species.localeCompare(b.species));

  // Calculate total butterflies with valid species only
  const totalButterfliesValidSpecies = results.reduce((sum, t) => sum + t.totalAbundance, 0);

  // Calculate total butterflies including all species (even invalid ones)
  const totalButterfliesAllSpecies = allData.reduce((sum, row) => {
    const count = parseInt(row['Abundance Count'], 10);
    return sum + (isNaN(count) ? 0 : count);
  }, 0);

  // Create output object with transects and metadata
  const output = {
    transects: results,
    metadata: {
      totalValidTransects: results.length,
      activeTransects: results.filter(t => t.isActive).length,
      inactiveTransects: results.filter(t => !t.isActive).length,
      filteredSpeciesCount: filteredSpeciesList.length,
      filteredSpecies: filteredSpeciesList,
      totalButterfliesValidSpecies,
      totalButterfliesAllSpecies,
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

  // Calculate and save GBI data
  const gbiData = await calculateGBI(allData, results, 2021);

  // Calculate and save flight curves for all species
  const flightCurvesData = await calculateAllFlightCurves(allData, results, 2021);

  // Calculate and save regional phenology curves
  const phenologyData = await calculateRegionalPhenology(allData, results, 2021);

  // Write GBI data to file
  if (gbiData) {
    const GBI_OUTPUT_FILE = path.join(OUTPUT_DIR, 'gbi-data.json');
    console.log(`\nWriting GBI data to ${GBI_OUTPUT_FILE}...`);
    fs.writeFileSync(GBI_OUTPUT_FILE, JSON.stringify(gbiData, null, 2), 'utf-8');
    console.log(`GBI data saved (${(fs.statSync(GBI_OUTPUT_FILE).size / 1024).toFixed(2)} KB)`);
  } else {
    console.warn('\nWarning: GBI calculation failed or returned no data');
  }

  // Write flight curves data to file
  if (flightCurvesData) {
    const FLIGHT_CURVES_OUTPUT_FILE = path.join(OUTPUT_DIR, 'flight-curves-data.json');
    console.log(`\nWriting flight curves data to ${FLIGHT_CURVES_OUTPUT_FILE}...`);
    fs.writeFileSync(FLIGHT_CURVES_OUTPUT_FILE, JSON.stringify(flightCurvesData, null, 2), 'utf-8');
    console.log(`Flight curves data saved (${(fs.statSync(FLIGHT_CURVES_OUTPUT_FILE).size / 1024).toFixed(2)} KB)`);
    console.log(`  - Species with flight curves: ${flightCurvesData.speciesList.length}`);
  } else {
    console.warn('\nWarning: Flight curves calculation failed or returned no data');
  }

  // Write phenology data to file
  if (phenologyData) {
    const PHENOLOGY_OUTPUT_FILE = path.join(OUTPUT_DIR, 'phenology-curves-data.json');
    console.log(`\nWriting regional phenology data to ${PHENOLOGY_OUTPUT_FILE}...`);
    fs.writeFileSync(PHENOLOGY_OUTPUT_FILE, JSON.stringify(phenologyData, null, 2), 'utf-8');
    console.log(`Phenology data saved (${(fs.statSync(PHENOLOGY_OUTPUT_FILE).size / 1024).toFixed(2)} KB)`);
    console.log(`  - Species with regional phenology: ${phenologyData.speciesList.length}`);
  } else {
    console.warn('\nWarning: Regional phenology calculation failed or returned no data');
  }

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
