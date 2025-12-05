import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Bar } from "react-chartjs-2";
import {
  SpeciesTransectData,
  MonthlyAbundance,
  calculateMonthlyAbundance,
} from "../utils/speciesMapUtils";
import { TimelineData } from "../types/timelineData";
import "leaflet/dist/leaflet.css";

interface SpeciesMapProps {
  transects: SpeciesTransectData[];
  speciesName: string;
  year: number;
  timelineData: TimelineData;
}

interface MonthlyChartProps {
  monthlyData: MonthlyAbundance[];
}

function MonthlyAbundanceChart({ monthlyData }: MonthlyChartProps) {
  if (monthlyData.length === 0) {
    return <div style={{ fontSize: 12, color: "#8c8c8c" }}>Sem dados mensais</div>;
  }

  const chartData = {
    labels: monthlyData.map(m => m.monthName),
    datasets: [
      {
        label: "Abundância média/visita",
        data: monthlyData.map(m => m.averageAbundance),
        backgroundColor: "#1890ff",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: false },
      },
      x: {
        title: { display: false },
      },
    },
  };

  return (
    <div style={{ height: 120, marginTop: 12 }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

function SpeciesMap({ transects, speciesName, year, timelineData }: SpeciesMapProps) {
  if (transects.length === 0) {
    return <div style={{ padding: 20, textAlign: "center" }}>Sem dados para este ano</div>;
  }

  // Calculate map center based on transects
  const avgLat = transects.reduce((sum, t) => sum + t.lat, 0) / transects.length;
  const avgLon = transects.reduce((sum, t) => sum + t.lon, 0) / transects.length;

  return (
    <div>
      <MapContainer center={[avgLat, avgLon]} zoom={6} style={{ height: "300px", width: "100%" }}>
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

          // Calculate monthly abundance data for this transect
          const monthlyData = transect.hasSpecies
            ? calculateMonthlyAbundance(speciesName, transect.transectId, year, timelineData)
            : [];

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
                      <div>
                        Avistada em {transect.visitCount} de {transect.totalVisits} visitas
                      </div>
                      <div>
                        Frequência:{" "}
                        {((transect.visitCount / transect.totalVisits) * 100).toFixed(1)}%
                      </div>
                      <MonthlyAbundanceChart monthlyData={monthlyData} />
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
