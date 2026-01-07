/**
 * Shared constants for BMS data processing and visualization
 *
 * This file contains configuration values used across both:
 * - Data processing scripts (scripts/process-butterfly-data.js, R scripts)
 * - Frontend application (src/)
 *
 * Centralizing these values ensures consistency and makes it easier to update
 * quality criteria and baseline years.
 */

// R-specific quality criteria (used in rbms-collated-index.R)
export const MIN_VISITS_FOR_FLIGHT_CURVE = 3; // Minimum visits required for GAM flight curve

// Baseline year for index normalization (all indices are normalized to this year = 100)
export const BASELINE_YEAR = 2020;

// Monitoring season definition
export const MONITORING_START_MONTH = 3; // March (1-indexed)
export const MONITORING_END_MONTH = 9; // September (1-indexed)

// Species-level quality criteria
export const MIN_COUNTS_PER_SPECIES = 20; // Minimum total counts for species analysis
export const MIN_YEARS_PER_SPECIES = 3; // Minimum years of data for species analysis
export const CI_RANGE_THRESHOLD = 2000; // Maximum acceptable CI range (upper - lower) for reliable estimates
export const MAX_ABSOLUTE_INDEX = 1000000; // Maximum absolute index value - species exceeding this are excluded (modeling artifacts)

// Regional GBI quality criteria
export const MIN_TRANSECTS_FOR_REGIONAL_GBI = 3; // Minimum transects per region for GBI calculation
export const MIN_YEARS_FOR_REGIONAL_GBI = 3; // Minimum years with data for regional GBI

// Mapping of species to their families
export const SPECIES_FAMILIES: Record<string, string> = {
  "Carcharodus alceae": "Hesperiidae",
  "Carcharodus baeticus": "Hesperiidae",
  "Carcharodus tripolinus": "Hesperiidae",
  "Erynnis tages": "Hesperiidae",
  "Gegenes nostrodamus": "Hesperiidae",
  "Hesperia comma": "Hesperiidae",
  "Muschampia proto": "Hesperiidae",
  "Ochlodes sylvanus": "Hesperiidae",
  "Pyrgus alveus": "Hesperiidae",
  "Pyrgus armoricanus": "Hesperiidae",
  "Pyrgus malvoides": "Hesperiidae",
  "Pyrgus onopordi": "Hesperiidae",
  "Pyrgus serratulae": "Hesperiidae",
  "Spialia sertorius": "Hesperiidae",
  "Thymelicus acteon": "Hesperiidae",
  "Thymelicus lineola": "Hesperiidae",
  "Thymelicus sylvestris": "Hesperiidae",
  "Aricia cramera": "Lycaenidae",
  "Aricia montensis": "Lycaenidae",
  "Cacyreus marshalli": "Lycaenidae",
  "Callophrys avis": "Lycaenidae",
  "Callophrys rubi": "Lycaenidae",
  "Celastrina argiolus": "Lycaenidae",
  "Cupido lorquinii": "Lycaenidae",
  "Cupido minimus": "Lycaenidae",
  "Eumedonia eumedon": "Lycaenidae",
  "Favonius quercus": "Lycaenidae",
  "Glaucopsyche alexis": "Lycaenidae",
  "Glaucopsyche melanops": "Lycaenidae",
  "Hamearis lucina": "Lycaenidae",
  "Laeosopis roboris": "Lycaenidae",
  "Lampides boeticus": "Lycaenidae",
  "Leptotes pirithous": "Lycaenidae",
  "Lycaena alciphron": "Lycaenidae",
  "Lycaena bleusei": "Lycaenidae",
  "Lycaena phlaeas": "Lycaenidae",
  "Lycaena tityrus": "Lycaenidae",
  "Lycaena virgaureae": "Lycaenidae",
  "Lysandra bellargus": "Lycaenidae",
  "Phengaris alcon": "Lycaenidae",
  "Plebejus argus": "Lycaenidae",
  "Polyommatus celina": "Lycaenidae",
  "Polyommatus icarus": "Lycaenidae",
  "Polyommatus icarus/celina": "Lycaenidae",
  "Polyommatus semiargus": "Lycaenidae",
  "Cyaniris semiargus": "Lycaenidae", // Synonym for Polyommatus semiargus
  "Polyommatus thersites": "Lycaenidae",
  "Pseudophilotes abencerragus": "Lycaenidae",
  "Pseudophilotes baton": "Lycaenidae",
  "Pseudophilotes panoptes": "Lycaenidae",
  "Satyrium esculi": "Lycaenidae",
  "Satyrium ilicis": "Lycaenidae",
  "Satyrium spini": "Lycaenidae",
  "Thecla betulae": "Lycaenidae",
  "Tomares ballus": "Lycaenidae",
  "Zizeeria knysna": "Lycaenidae",
  "Aglais io": "Nymphalidae",
  "Aglais urticae": "Nymphalidae",
  "Apatura ilia": "Nymphalidae",
  "Argynnis pandora": "Nymphalidae",
  "Argynnis paphia": "Nymphalidae",
  "Boloria dia": "Nymphalidae",
  "Boloria euphrosyne": "Nymphalidae",
  "Boloria selene": "Nymphalidae",
  "Brenthis daphne": "Nymphalidae",
  "Brenthis hecate": "Nymphalidae",
  "Brenthis ino": "Nymphalidae",
  "Charaxes jasius": "Nymphalidae",
  "Danaus chrysippus": "Nymphalidae",
  "Danaus plexippus": "Nymphalidae",
  "Euphydryas aurinia": "Nymphalidae",
  "Euphydryas desfontainii": "Nymphalidae",
  "Fabriciana adippe": "Nymphalidae",
  "Fabriciana niobe": "Nymphalidae",
  "Issoria lathonia": "Nymphalidae",
  "Libythea celtis": "Nymphalidae",
  "Limenitis camilla": "Nymphalidae",
  "Limenitis reducta": "Nymphalidae",
  "Melitaea aetherie": "Nymphalidae",
  "Melitaea cinxia": "Nymphalidae",
  "Melitaea deione": "Nymphalidae",
  "Melitaea didyma": "Nymphalidae",
  "Melitaea celadussa": "Nymphalidae",
  "Melitaea parthenoides": "Nymphalidae",
  "Melitaea phoebe": "Nymphalidae",
  "Melitaea trivia": "Nymphalidae",
  "Nymphalis antiopa": "Nymphalidae",
  "Nymphalis polychloros": "Nymphalidae",
  "Polygonia c-album": "Nymphalidae",
  "Speyeria aglaja": "Nymphalidae",
  "Vanessa atalanta": "Nymphalidae",
  "Vanessa cardui": "Nymphalidae",
  "Vanessa virginiensis": "Nymphalidae",
  "Iphiclides feisthamelii": "Papilionidae",
  "Papilio machaon": "Papilionidae",
  "Zerynthia rumina": "Papilionidae",
  "Anthocharis cardamines": "Pieridae",
  "Anthocharis euphenoides": "Pieridae",
  "Aporia crataegi": "Pieridae",
  "Colias crocea": "Pieridae",
  "Euchloe belemia": "Pieridae",
  "Euchloe crameri": "Pieridae",
  "Euchloe tagis": "Pieridae",
  "Gonepteryx cleopatra": "Pieridae",
  "Gonepteryx rhamni": "Pieridae",
  "Leptidea sinapis": "Pieridae",
  "Pieris brassicae": "Pieridae",
  "Pieris napi": "Pieridae",
  "Pieris rapae": "Pieridae",
  "Pontia daplidice": "Pieridae",
  "Arethusana arethusa": "Nymphalidae",
  "Brintesia circe": "Nymphalidae",
  "Coenonympha arcania": "Nymphalidae",
  "Coenonympha dorus": "Nymphalidae",
  "Coenonympha glycerion": "Nymphalidae",
  "Coenonympha pamphilus": "Nymphalidae",
  "Erebia triarius": "Nymphalidae",
  "Hipparchia fidia": "Nymphalidae",
  "Hipparchia hermione": "Nymphalidae",
  "Hipparchia semele": "Nymphalidae",
  "Hipparchia statilinus": "Nymphalidae",
  "Hyponephele lupinus": "Nymphalidae",
  "Hyponephele lycaon": "Nymphalidae",
  "Lasiommata maera": "Nymphalidae",
  "Lasiommata megera": "Nymphalidae",
  "Maniola jurtina": "Nymphalidae",
  "Melanargia ines": "Nymphalidae",
  "Melanargia lachesis": "Nymphalidae",
  "Melanargia occitanica": "Nymphalidae",
  "Melanargia russiae": "Nymphalidae",
  "Pararge aegeria": "Nymphalidae",
  "Pyronia bathseba": "Nymphalidae",
  "Pyronia cecilia": "Nymphalidae",
  "Pyronia tithonus": "Nymphalidae",
  "Satyrus actaea": "Nymphalidae",
};

// Valid species - all species with family classifications (derived from SPECIES_FAMILIES keys)
export const VALID_SPECIES = new Set(Object.keys(SPECIES_FAMILIES));

// Grassland butterfly species for GBI calculation
// Based on European Grassland Butterfly Indicator
// Source: https://www.eea.europa.eu/en/analysis/indicators/grassland-butterfly-index-in-europe-1
export const GRASSLAND_SPECIES = {
  // Widespread species (7)
  widespread: new Set([
    "Anthocharis cardamines",
    "Coenonympha pamphilus",
    "Lasiommata megera",
    "Lycaena phlaeas",
    "Maniola jurtina",
    "Ochlodes sylvanus",
    "Polyommatus icarus/celina",
  ]),
  // Specialist species (7)
  specialist: new Set([
    "Cupido minimus",
    "Cyaniris semiargus", // Also known as Polyommatus semiargus
    "Erynnis tages",
    "Euphydryas aurinia",
    "Lysandra bellargus",
    "Spialia sertorius",
    "Thymelicus acteon",
  ]),
};

export const ALL_GRASSLAND_SPECIES = new Set([
  ...GRASSLAND_SPECIES.widespread,
  ...GRASSLAND_SPECIES.specialist,
]);

// Trend category color scheme
export const TREND_COLORS: Record<string, string> = {
  "Strong increase": "#52c41a",
  "Moderate increase": "#95de64",
  Stable: "#1890ff",
  Uncertain: "#8c8c8c",
  "Moderate decline": "#ff7875",
  "Strong decline": "#cf1322",
};

// Portuguese labels for trend categories
export const TREND_LABELS: Record<string, string> = {
  "Strong increase": "Aumento Forte",
  "Moderate increase": "Aumento Moderado",
  Stable: "Estável",
  Uncertain: "Incerto",
  "Moderate decline": "Declínio Moderado",
  "Strong decline": "Declínio Forte",
};

// Helper function to get color based on trend category
export function getTrendColor(category: string): string {
  return TREND_COLORS[category] || "#1890ff"; // Default to blue
}

// Helper function to get Portuguese label for trend category
export function getTrendLabel(category: string): string {
  return TREND_LABELS[category] || category;
}

// Helper function to group species by family and sort them
export function groupSpeciesByFamily(speciesList: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  speciesList.forEach(species => {
    const family = SPECIES_FAMILIES[species] || "Outras";
    if (!grouped[family]) {
      grouped[family] = [];
    }
    grouped[family].push(species);
  });

  // Sort species alphabetically within each family
  Object.keys(grouped).forEach(family => {
    grouped[family].sort();
  });

  return grouped;
}

// Data quality criteria for transect filtering
export const MIN_YEARS_ACTIVE = 2; // Minimum number of years a transect must be active
export const MIN_VISITS_PER_YEAR = 5; // Minimum average visits per year

// Helper function to filter for quality active transects
export function getQualityFilteredTransects<
  T extends {
    yearsActive: number;
    avgVisitsPerYear: number;
    isActive: boolean;
  },
>(transects: T[]): T[] {
  return transects.filter(
    t =>
      t.yearsActive >= MIN_YEARS_ACTIVE && t.avgVisitsPerYear >= MIN_VISITS_PER_YEAR
  );
}
