// Icons/emojis for habitat types
// Each habitat type is mapped to an appropriate emoji

export const HABITAT_TYPE_ICONS: Record<string, string> = {
  'Grassland': '🌾',              // Sheaf of wheat - represents grasslands and meadows
  'Woodland': '🌳',               // Deciduous tree - represents woodlands and forests
  'Scrubland': '🌿',              // Herb - represents scrub, heathland, and shrubs
  'Wetland': '💧',                // Water droplet - represents wetlands and wet areas
  'Urban/Agricultural': '🏘️',    // Houses - represents urban and agricultural areas
  'Rocky/Mountain': '⛰️',        // Mountain - represents rocky and mountainous areas
  'Coastal': '🏖️',               // Beach - represents coastal habitats
  'Generalist': '🦋',             // Butterfly - represents species using diverse habitats
};

// Get icon for a habitat type, with fallback to generic butterfly
export function getHabitatTypeIcon(habitatType: string): string {
  return HABITAT_TYPE_ICONS[habitatType] || '🦋'; // Default to butterfly
}
