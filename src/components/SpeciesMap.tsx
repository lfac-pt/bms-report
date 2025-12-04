import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { SpeciesTransectData } from "../utils/speciesMapUtils";
import "leaflet/dist/leaflet.css";

interface SpeciesMapProps {
  transects: SpeciesTransectData[];
}

function SpeciesMap({ transects }: SpeciesMapProps) {
  if (transects.length === 0) {
    return <div style={{ padding: 20, textAlign: "center" }}>Sem dados para este ano</div>;
  }

  // Calculate map center based on transects
  const avgLat = transects.reduce((sum, t) => sum + t.lat, 0) / transects.length;
  const avgLon = transects.reduce((sum, t) => sum + t.lon, 0) / transects.length;

  return (
    <div>
      <MapContainer
        center={[avgLat, avgLon]}
        zoom={6}
        style={{ height: "300px", width: "100%" }}
      >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {transects.map(transect => {
        // Grey for absent, blue for present
        const color = transect.hasSpecies ? "#1890ff" : "#d9d9d9";

        // Calculate radius based on average abundance
        // Absent species: small grey circle (radius 5)
        // Present species with <10 visits: minimum size (radius 8)
        // Present species with >=10 visits: radius based on abundance (min 8, max 25)
        let radius = 5;
        if (transect.hasSpecies) {
          if (transect.totalVisits < 10) {
            radius = 8; // Minimum size for low sample size
          } else {
            radius = Math.max(8, Math.min(25, 8 + transect.averageAbundance * 1.5));
          }
        }

        return (
          <CircleMarker
            key={transect.transectId}
            center={[transect.lat, transect.lon]}
            radius={radius}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: transect.hasSpecies ? 0.6 : 0.3,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <strong>{transect.transectName}</strong>
                <br />
                <br />
                {transect.hasSpecies ? (
                  <>
                    <div>Avistada em {transect.visitCount} de {transect.totalVisits} visitas</div>
                    <div>
                      Frequência: {((transect.visitCount / transect.totalVisits) * 100).toFixed(1)}%
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#8c8c8c" }}>Espécie não avistada</div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
      </MapContainer>
    </div>
  );
}

export default SpeciesMap;
