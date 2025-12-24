/**
 * Grassland butterfly species for GBI calculation
 * Based on European Grassland Butterfly Indicator
 * Source: https://www.eea.europa.eu/en/analysis/indicators/grassland-butterfly-index-in-europe-1
 */

export const GRASSLAND_SPECIES = {
  // Widespread species (7)
  widespread: [
    "Anthocharis cardamines",
    "Coenonympha pamphilus",
    "Lasiommata megera",
    "Lycaena phlaeas",
    "Maniola jurtina",
    "Ochlodes sylvanus",
    "Polyommatus icarus",
  ],
  // Specialist species (7)
  specialist: [
    "Cupido minimus",
    "Cyaniris semiargus", // Also known as Polyommatus semiargus
    "Erynnis tages",
    "Euphydryas aurinia",
    "Lysandra bellargus",
    "Spialia sertorius",
    "Thymelicus acteon",
  ],
};

export const ALL_GRASSLAND_SPECIES = [
  ...GRASSLAND_SPECIES.widespread,
  ...GRASSLAND_SPECIES.specialist,
];
