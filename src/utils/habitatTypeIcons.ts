// Sprite positions for habitat types
// The habitats.jpg sprite is 2816px × 1536px (4 columns × 2 rows)
// Each cell is 704px × 768px
// Scaled to 88px icons: backgroundSize is 352px × 192px, each cell is 88px × 96px

export interface HabitatSpritePosition {
  x: number;
  y: number;
}

export const HABITAT_TYPE_SPRITES: Record<string, HabitatSpritePosition> = {
  Grassland: { x: -4, y: -8 }, // PRADO - Row 1, Col 1
  Woodland: { x: -89, y: -8 }, // FLORESTA - Row 1, Col 2
  Scrubland: { x: -175, y: -8 }, // MATAGAL - Row 1, Col 3
  Wetland: { x: -260, y: -8 }, // ZONA HÚMIDA - Row 1, Col 4
  "Urban/Agricultural": { x: -4, y: -99 }, // RURAL/AGRÍCOLA - Row 2, Col 1
  "Rocky/Mountain": { x: -89, y: -99 }, // ROCHOSO/MONTANHA - Row 2, Col 2
  Coastal: { x: -174, y: -99 }, // COSTEIRO - Row 2, Col 3
  Generalist: { x: -260, y: -99 }, // GENERALISTA - Row 2, Col 4
};

// Get sprite position for a habitat type, with fallback to Generalist
export function getHabitatSpritePosition(habitatType: string): HabitatSpritePosition {
  return HABITAT_TYPE_SPRITES[habitatType] || HABITAT_TYPE_SPRITES["Generalist"];
}
