import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { TransectStats } from "../types/transectStats";
import "leaflet/dist/leaflet.css";

interface TransectMapProps {
  transects: TransectStats[];
}

function TransectMap({ transects }: TransectMapProps) {
  // Filter transects with coordinates
  const transectsWithCoords = transects.filter(t => t.coordinates !== null);

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
          {transectsWithCoords.map(transect => (
            <CircleMarker
              key={transect.transectId}
              center={[transect.coordinates!.lat, transect.coordinates!.lon]}
              radius={6}
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
