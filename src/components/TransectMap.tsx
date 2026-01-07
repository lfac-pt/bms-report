import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from "react-leaflet";
import { TransectStats } from "../types/transectStats";
import { useEffect, useState, useMemo } from "react";
import type { FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";

interface TransectMapProps {
  transects: TransectStats[];
}

// Mapping from zone numbers (DN) to Portuguese region names
const ZONE_NAMES: Record<number, string> = {
  9: "Lusitânico",
  11: "Mediterrânico Montanhoso",
  12: "Mediterrânico Norte",
  13: "Mediterrânico Sul",
};

// Colors for climatic regions (light hues)
const REGION_COLORS: Record<string, string> = {
  Lusitânico: "#FFD699", // Peach/amber - Atlantic influence
  "Mediterrânico Norte": "#99C2FF", // Light blue - Northern Mediterranean
  "Mediterrânico Sul": "#FF99B3", // Light pink - Southern Mediterranean
  "Mediterrânico Montanhoso": "#C299FF", // Light purple - Mountains
};

function TransectMap({ transects }: TransectMapProps) {
  const [protectedAreas, setProtectedAreas] = useState<FeatureCollection | null>(null);
  const [environmentalZones, setEnvironmentalZones] = useState<FeatureCollection | null>(null);

  // Load protected areas GeoJSON
  useEffect(() => {
    // eslint-disable-next-line no-undef
    fetch("data/protected-areas.geojson")
      .then(res => res.json())
      .then(data => setProtectedAreas(data))
      // eslint-disable-next-line no-console
      .catch(err => console.warn("Could not load protected areas:", err));
  }, []);

  // Load environmental zones GeoJSON
  useEffect(() => {
    // eslint-disable-next-line no-undef
    fetch("data/environmental-zones.geojson")
      .then(res => res.json())
      .then(data => setEnvironmentalZones(data))
      // eslint-disable-next-line no-console
      .catch(err => console.warn("Could not load environmental zones:", err));
  }, []);

  // Filter transects with coordinates
  const transectsWithCoords = transects.filter(t => t.coordinates !== null);

  // All climatic regions for legend (always show all regions)
  const allRegions = useMemo(() => {
    // Count transects per region
    const regionCounts: Record<string, number> = {};
    transectsWithCoords.forEach(t => {
      if (t.climaticRegion) {
        regionCounts[t.climaticRegion] = (regionCounts[t.climaticRegion] || 0) + 1;
      }
    });

    // Always show all 4 regions in sorted order
    const allRegionNames = Object.values(ZONE_NAMES).sort();

    return allRegionNames.map(region => ({
      region,
      color: REGION_COLORS[region] || "#E0E0E0",
      transectCount: regionCounts[region] || 0,
    }));
  }, [transectsWithCoords]);

  // Helper function to get region name from zone DN
  const getRegionName = (dn: number): string => {
    return ZONE_NAMES[dn] || "Desconhecido";
  };

  // Helper function to get region color from zone DN
  const getRegionColor = (dn: number): string => {
    const regionName = getRegionName(dn);
    return REGION_COLORS[regionName] || "#E0E0E0";
  };

  // Find the most recent year
  const mostRecentYear =
    transects.length > 0
      ? Math.max(...transects.map(t => t.lastMonitoringYear || 0).filter(y => y > 0))
      : null;

  // Helper function to determine marker color
  const getMarkerColor = (transect: TransectStats) => {
    // New transect (started in most recent year)
    if (mostRecentYear && transect.firstMonitoringYear === mostRecentYear) {
      return "#1890ff"; // Blue for new transects
    }
    // Active (monitored in most recent year)
    if (transect.isActive) {
      return "#52c41a"; // Green for active
    }
    // Inactive (not monitored in most recent year)
    return "#ff4d4f"; // Red for inactive
  };

  // Helper function to calculate marker radius based on species count
  const getMarkerRadius = (transect: TransectStats) => {
    const speciesCount = transect.totalSpecies || 0;
    // Scale radius between 2.5 (minimum) and 40 (maximum)
    // Using square root for better visual scaling
    const minRadius = 2.5;
    const maxRadius = 50;
    const scaleFactor = 1.3; // Adjust this to control how aggressively size scales

    return Math.min(maxRadius, minRadius + Math.sqrt(speciesCount) * scaleFactor);
  };

  // Calculate center and bounds
  const center: [number, number] =
    transectsWithCoords.length > 0
      ? [
          transectsWithCoords.reduce((sum, t) => sum + t.coordinates!.lat, 0) /
            transectsWithCoords.length,
          transectsWithCoords.reduce((sum, t) => sum + t.coordinates!.lon, 0) /
            transectsWithCoords.length,
        ]
      : [39.5, -8.0]; // Default center of Portugal

  return (
    <div style={{ height: "800px", width: "100%", borderRadius: "8px", overflow: "hidden" }}>
      <div style={{ position: "relative", height: "100%", width: "100%" }}>
        <MapContainer
          center={center}
          zoom={7}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Regional climatic zones - rendered as background layer */}
          {environmentalZones && (
            <GeoJSON
              data={environmentalZones}
              style={feature => {
                const dn = feature?.properties?.DN as number;
                const color = getRegionColor(dn);
                return {
                  fillColor: color,
                  fillOpacity: 0.2,
                  color: color,
                  weight: 1.5,
                  opacity: 0.4,
                };
              }}
              pane="tilePane"
            />
          )}

          {/* Protected Areas Layer - rendered behind transects */}
          {protectedAreas && (
            <GeoJSON
              data={protectedAreas}
              style={{
                fillColor: "#2d5016",
                fillOpacity: 0.25,
                color: "#2d5016",
                weight: 2,
                opacity: 0.6,
              }}
              pane="tilePane"
              onEachFeature={(feature, layer) => {
                if (feature.properties && feature.properties.nome_ap) {
                  layer.bindPopup(`
                    <strong>${feature.properties.nome_ap}</strong><br/>
                    <small>${feature.properties.classifica || ""}</small>
                  `);
                }
              }}
            />
          )}

          {transectsWithCoords.map(transect => (
            <CircleMarker
              key={transect.transectId}
              center={[transect.coordinates!.lat, transect.coordinates!.lon]}
              radius={getMarkerRadius(transect)}
              pathOptions={{
                fillColor: getMarkerColor(transect),
                color: "#fff",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.7,
              }}
            >
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <strong>{transect.transectName}</strong>
                  <br />
                  <small>
                    {transect.concelho}, {transect.distrito}
                  </small>
                  <br />
                  <div style={{ marginTop: 8 }}>
                    Espécies: {transect.totalSpecies}
                    <br />
                    Visitas: {transect.totalVisits}
                    <br />
                    Anos Ativos: {transect.yearsActive}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Legend */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 10,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            padding: "10px 12px",
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            fontSize: 12,
            zIndex: 1000,
            border: "1px solid #d9d9d9",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Legenda</div>

          {/* Climatic Regions */}
          {allRegions.length > 0 && (
            <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 4, color: "#666" }}>
                Regiões Climáticas
              </div>
              {allRegions.map((region, idx) => (
                <div
                  key={`legend-region-${idx}`}
                  style={{ display: "flex", alignItems: "center", marginBottom: 2 }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      backgroundColor: region.color,
                      border: `1px solid ${region.color}`,
                      marginRight: 6,
                      opacity: 0.6,
                    }}
                  />
                  <span style={{ fontSize: 11 }}>
                    {region.region.replace("Mediterrânico", "Med.")} ({region.transectCount})
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Protected Areas */}
          {protectedAreas && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 6,
                paddingBottom: 6,
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: "rgba(45, 80, 22, 0.25)",
                  border: "2px solid #2d5016",
                  marginRight: 6,
                }}
              />
              <span>Áreas Protegidas</span>
            </div>
          )}

          {/* Transects */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: "#1890ff",
                border: "1px solid #fff",
                marginRight: 6,
              }}
            />
            <span>Novo em {mostRecentYear}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: "#52c41a",
                border: "1px solid #fff",
                marginRight: 6,
              }}
            />
            <span>Ativo em {mostRecentYear}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: "#ff4d4f",
                border: "1px solid #fff",
                marginRight: 6,
              }}
            />
            <span>Inativo</span>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#8c8c8c", marginTop: 8 }}>
        Mostrando {transectsWithCoords.length} transecto(s) • Localização aproximada para
        privacidade
      </div>
    </div>
  );
}

export default TransectMap;
