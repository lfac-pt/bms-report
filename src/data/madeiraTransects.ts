import type { TransectStats } from "../types/transectStats";

export type AnnualTransect = Pick<
  TransectStats,
  "transectId" | "transectName" | "coordinates" | "concelho" | "entidade"
>;

// From the transect catalogue. Coordinates are rounded for the public maps.
export const madeiraTransects: AnnualTransect[] = [
  {
    transectId: "306734",
    transectName: "Poço da Neve",
    coordinates: { lat: 32.73, lon: -16.92 },
    concelho: "Funchal",
    entidade: "",
  },
  {
    transectId: "306737",
    transectName: "Casa do Burro",
    coordinates: { lat: 32.71, lon: -16.91 },
    concelho: "Funchal",
    entidade: "",
  },
  {
    transectId: "306739",
    transectName: "Barracão",
    coordinates: { lat: 32.7, lon: -16.9 },
    concelho: "Funchal",
    entidade: "",
  },
];

export const madeiraTransectIds = new Set(madeiraTransects.map(item => item.transectId));
