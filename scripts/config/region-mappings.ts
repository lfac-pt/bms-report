/**
 * Region mappings for data processing
 */

/**
 * Known mapping of localities/freguesias to their correct concelhos
 */
export const LOCALITY_TO_CONCELHO: Record<string, string> = {
  Amora: "Seixal",
  "Costa da Caparica": "Almada",
  Minde: "Alcanena",
  "Quinta do Conde": "Sesimbra",
  "Santo André": "Santiago do Cacém",
  "Vila Nova de Milfontes": "Odemira",
  Azeitão: "Setúbal",
};

/**
 * Mapping of distritos to climatic regions
 * Based on Portugal's geographic and climatic divisions
 */
export const DISTRITO_TO_CLIMATIC_REGION: Record<string, string> = {
  // Norte (North) - Atlantic climate
  "Viana do Castelo": "Norte",
  Braga: "Norte",
  Porto: "Norte",
  "Vila Real": "Norte",
  Bragança: "Norte",

  // Centro (Center) - Transition zone
  Aveiro: "Centro",
  Viseu: "Centro",
  Guarda: "Centro",
  Coimbra: "Centro",
  "Castelo Branco": "Centro",
  Leiria: "Centro",

  // Lisboa e Vale do Tejo - Mediterranean influence
  Lisboa: "Lisboa e Vale do Tejo",
  Santarém: "Lisboa e Vale do Tejo",
  Setúbal: "Lisboa e Vale do Tejo",

  // Alentejo - Mediterranean/Continental
  Portalegre: "Alentejo",
  Évora: "Alentejo",
  Beja: "Alentejo",

  // Algarve - Mediterranean
  Faro: "Algarve",
};

/**
 * Get climatic region from distrito
 */
export function getClimaticRegion(distrito: string): string {
  return DISTRITO_TO_CLIMATIC_REGION[distrito] || "Desconhecido";
}
