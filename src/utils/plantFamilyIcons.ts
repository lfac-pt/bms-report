// Icons/emojis for plant families
// Each family is mapped to an appropriate emoji that represents common plants in that family

export const PLANT_FAMILY_ICONS: Record<string, string> = {
  // Grasses
  'Poaceae': '🌾', // Sheaf of rice - represents grasses

  // Legumes/Peas
  'Fabaceae': '🫘', // Beans - represents legumes

  // Cabbage family
  'Brassicaceae': '🥬', // Leafy green - represents crucifers

  // Rose family (includes roses, cherries, apples)
  'Rosaceae': '🌹', // Rose

  // Sunflower/Daisy family
  'Asteraceae': '🌻', // Sunflower

  // Carrot/Parsley family
  'Apiaceae': '🥕', // Carrot

  // Mint family
  'Lamiaceae': '🌿', // Herb

  // Violet family
  'Violaceae': '💜', // Purple heart - violets are purple

  // Willow family
  'Salicaceae': '🌳', // Deciduous tree - willows and poplars

  // Oak/Beech family
  'Fagaceae': '🍂', // Fallen leaf - represents oak

  // Birch family
  'Betulaceae': '🌳', // Deciduous tree - birches

  // Elm family
  'Ulmaceae': '🌳', // Deciduous tree - elms

  // Nettle family
  'Urticaceae': '🪴', // Potted plant - nettles are common weedy plants

  // Knotweed family (includes sorrels and docks)
  'Polygonaceae': '🌿', // Herb

  // Mallow family
  'Malvaceae': '🌺', // Hibiscus - a mallow

  // Heather family (includes heathers, rhododendrons, blueberries)
  'Ericaceae': '🫐', // Blueberries

  // Buckthorn family
  'Rhamnaceae': '🌳', // Tree/shrub

  // Geranium family
  'Geraniaceae': '🌸', // Cherry blossom - represents geranium flowers

  // Plantain family
  'Plantaginaceae': '🌿', // Herb - plantains are herbaceous

  // Figwort family (now mostly moved to Plantaginaceae)
  'Scrophulariaceae': '🌿', // Herb

  // Rockrose family
  'Cistaceae': '🌸', // Cherry blossom - rockroses have simple flowers

  // Milkweed/Dogbane family
  'Apocynaceae': '🦋', // Butterfly - milkweed is famous for monarch butterflies

  // Birthwort family
  'Aristolochiaceae': '🌿', // Herb

  // Honeysuckle family
  'Caprifoliaceae': '🌸', // Cherry blossom - honeysuckle flowers

  // Laurel family (includes bay laurel, avocado)
  'Lauraceae': '🥑', // Avocado - a well-known member
};

// Common names for plant families (Portuguese)
export const PLANT_FAMILY_COMMON_NAMES: Record<string, string> = {
  'Poaceae': 'Gramíneas',
  'Fabaceae': 'Leguminosas',
  'Brassicaceae': 'Crucíferas',
  'Rosaceae': 'Rosáceas',
  'Asteraceae': 'Compostas',
  'Apiaceae': 'Umbelíferas',
  'Lamiaceae': 'Labiadas',
  'Violaceae': 'Violetas',
  'Salicaceae': 'Salgueiros',
  'Fagaceae': 'Fagáceas',
  'Betulaceae': 'Betuláceas',
  'Ulmaceae': 'Ulmáceas',
  'Urticaceae': 'Urticáceas',
  'Polygonaceae': 'Poligonáceas',
  'Malvaceae': 'Malváceas',
  'Ericaceae': 'Ericáceas',
  'Rhamnaceae': 'Ramnáceas',
  'Geraniaceae': 'Geraniáceas',
  'Plantaginaceae': 'Plantagináceas',
  'Scrophulariaceae': 'Escrofulariáceas',
  'Cistaceae': 'Cistáceas',
  'Apocynaceae': 'Apocináceas',
  'Aristolochiaceae': 'Aristoloquiáceas',
  'Caprifoliaceae': 'Caprifoliáceas',
  'Lauraceae': 'Lauráceas',
};

// Get icon for a plant family, with fallback to generic plant
export function getPlantFamilyIcon(family: string): string {
  return PLANT_FAMILY_ICONS[family] || '🌱'; // Default to seedling
}

// Get common name for a plant family
export function getPlantFamilyCommonName(family: string): string | undefined {
  return PLANT_FAMILY_COMMON_NAMES[family];
}

// Get all families with their icons
export function getAllPlantFamilyIcons(): Array<{ family: string; icon: string }> {
  return Object.entries(PLANT_FAMILY_ICONS).map(([family, icon]) => ({
    family,
    icon,
  }));
}
