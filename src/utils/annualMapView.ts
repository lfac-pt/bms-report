import type { LatLngBoundsLiteral } from "leaflet";

const bounds: LatLngBoundsLiteral = [
  [32.35, -17.3],
  [42.2, -6.1],
];

export const annualMapView = {
  bounds,
  boundsOptions: { padding: [20, 20] as [number, number] },
  zoomSnap: 0.25,
};
