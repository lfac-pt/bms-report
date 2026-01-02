import { useState, useEffect } from "react";
import { Button, Card, Space, Typography, Spin, Alert, Checkbox, Slider } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from "react-leaflet";
import { SPECIES_FAMILIES } from "../constants";
import { TransectStats } from "../types/transectStats";
import SpeciesCard from "./SpeciesCard";
import "leaflet/dist/leaflet.css";

const { Title, Text } = Typography;

const MONTH_NAMES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

// Monitoring season: March through September (months 3-9)
const MONITORING_MONTHS = [3, 4, 5, 6, 7, 8, 9];

interface MunicipalityProperties {
  Concelho: string;
  speciesCount: number;
  transectCount: number;
  transects: { name: string; isActive: boolean; firstMonitoringYear?: number }[];
  monthlySpeciesCount: { [month: number]: number };
  monthlySpeciesLists: { [month: number]: string[] };
  species: string[];
  monitoringSinceYear?: number | null;
}

interface GeoJSONFeature {
  type: string;
  properties: MunicipalityProperties;
  geometry: any;
}

interface MunicipalityGeoJSON {
  type: string;
  features: GeoJSONFeature[];
}

// Helper function to convert all-caps text to title case
// Keeps Portuguese prepositions lowercase (de, da, do, das, dos)
const toTitleCase = (text: string): string => {
  const lowercaseWords = ["de", "da", "do", "das", "dos"];

  return text
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      // Always capitalize first word, otherwise check if it's a preposition
      if (index === 0 || !lowercaseWords.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
};

// Helper function to group species by family and sort
const groupSpeciesByFamily = (speciesList: string[]) => {
  const familyGroups: Record<string, string[]> = {};

  speciesList.forEach(species => {
    const family = SPECIES_FAMILIES[species] || "Unknown";
    if (!familyGroups[family]) {
      familyGroups[family] = [];
    }
    familyGroups[family].push(species);
  });

  // Sort species within each family
  Object.keys(familyGroups).forEach(family => {
    familyGroups[family].sort();
  });

  // Sort families alphabetically
  const sortedFamilies = Object.keys(familyGroups).sort();

  return { familyGroups, sortedFamilies };
};

function MunicipalityPage() {
  const { municipalityName } = useParams<{ municipalityName: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [geoData, setGeoData] = useState<MunicipalityGeoJSON | null>(null);
  const [transects, setTransects] = useState<TransectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [commonNamesMap, setCommonNamesMap] = useState<Record<string, string>>({});
  const [flightCurvesData, setFlightCurvesData] = useState<any>(null);

  // Initialize month from URL or default
  const monthParam = searchParams.get("month");
  const initialMonth = monthParam ? parseInt(monthParam) : MONITORING_MONTHS[0];
  const initialFilterByMonth = monthParam !== null;

  const [filterByMonth, setFilterByMonth] = useState(initialFilterByMonth);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);

  // Decode the municipality name from URL
  const decodedMunicipalityName = municipalityName ? decodeURIComponent(municipalityName) : "";

  // Load GeoJSON, transects, common names, and flight curves data
  useEffect(() => {
    Promise.all([
      // eslint-disable-next-line no-undef
      fetch("data/municipalities-species-map.geojson").then(res => res.json()),
      // eslint-disable-next-line no-undef
      fetch("data/processed-transects.json").then(res => res.json()),
      // eslint-disable-next-line no-undef
      fetch("data/common-names.json").then(res => res.json()).catch(() => ({})),
      // eslint-disable-next-line no-undef
      fetch("data/flight-curves-data.json").then(res => res.json()).catch(() => null),
    ])
      .then(([geoJsonData, transectsData, commonNames, flightCurves]) => {
        setGeoData(geoJsonData);
        setTransects(transectsData.transects || []);
        setCommonNamesMap(commonNames);
        setFlightCurvesData(flightCurves);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleGoBack = () => {
    navigate("/transects");
  };

  if (loading) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
        <Spin size="large" />
      </Space>
    );
  }

  if (!geoData) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
        <Alert message="Erro ao carregar dados" type="error" />
      </Space>
    );
  }

  // Find the municipality in the GeoJSON data (case-insensitive)
  const municipalityFeature = geoData.features.find(
    f => f.properties.Concelho.toLowerCase() === decodedMunicipalityName.toLowerCase()
  );

  if (!municipalityFeature) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
        <Button type="default" icon={<ArrowLeftOutlined />} onClick={handleGoBack} size="large">
          Voltar à Visão Geral
        </Button>
        <Alert message="Município não encontrado" type="warning" />
      </Space>
    );
  }

  const {
    Concelho,
    species,
    speciesCount,
    transectCount,
    transects: municipalityTransectsInfo,
    monthlySpeciesCount,
    monthlySpeciesLists,
    monitoringSinceYear,
  } = municipalityFeature.properties;

  // Get species list based on filter mode
  const displayedSpecies = filterByMonth ? (monthlySpeciesLists?.[selectedMonth] ?? []) : species;

  const displayedSpeciesCount = filterByMonth
    ? (monthlySpeciesCount?.[selectedMonth] ?? 0)
    : speciesCount;

  // Group species by family
  const { familyGroups, sortedFamilies } = groupSpeciesByFamily(displayedSpecies);

  // Filter transects for this municipality
  const municipalityTransects = transects.filter(
    t => t.concelho.toLowerCase() === decodedMunicipalityName.toLowerCase()
  );

  // Determine municipality's climatic region from first transect
  const firstTransect = municipalityTransects.find(t => t.climaticRegion);
  const municipalityClimaticRegion = firstTransect?.climaticRegion || 'Lusitano'; // Default fallback

  // Filter transects with coordinates
  const transectsWithCoords = municipalityTransects.filter(t => t.coordinates !== null);

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
    const minRadius = 4;
    const maxRadius = 15;
    const scaleFactor = 1.3;
    return Math.min(maxRadius, minRadius + Math.sqrt(speciesCount) * scaleFactor);
  };

  // Calculate center for map
  const mapCenter: [number, number] =
    transectsWithCoords.length > 0
      ? [
          transectsWithCoords.reduce((sum, t) => sum + t.coordinates!.lat, 0) /
            transectsWithCoords.length,
          transectsWithCoords.reduce((sum, t) => sum + t.coordinates!.lon, 0) /
            transectsWithCoords.length,
        ]
      : [39.5, -8.0]; // Default center of Portugal

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
      <Button type="default" icon={<ArrowLeftOutlined />} onClick={handleGoBack} size="large">
        Voltar à Visão Geral
      </Button>

      <Card>
        <div style={{ display: "flex", gap: 24 }}>
          {/* Left column: Municipality info */}
          <div style={{ flex: 1 }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Title level={2} style={{ marginBottom: 0 }}>
                {toTitleCase(Concelho)}
              </Title>
              <div>
                <Text strong style={{ fontSize: 16 }}>
                  Espécies registadas: {displayedSpeciesCount}
                </Text>
                <br />
                <Text strong style={{ fontSize: 16 }}>
                  Transectos: {transectCount}
                </Text>
                {monitoringSinceYear && (
                  <>
                    <br />
                    <Text strong style={{ fontSize: 16 }}>
                      Monitorização desde: {monitoringSinceYear}
                    </Text>
                  </>
                )}
              </div>

              {municipalityTransectsInfo && municipalityTransectsInfo.length > 0 && (
                <div>
                  <Text strong>Transectos:</Text>
                  <ul style={{ marginTop: 8 }}>
                    {municipalityTransectsInfo.map((transect, idx) => (
                      <li key={idx}>
                        <span style={{ color: transect.isActive ? "green" : "red" }}>
                          {transect.isActive ? "✓" : "✗"}
                        </span>{" "}
                        {transect.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Space>
          </div>

          {/* Right column: Map */}
          <div style={{ width: 400, height: 400 }}>
            <MapContainer
              center={mapCenter}
              zoom={11}
              style={{ height: "100%", width: "100%", borderRadius: 8 }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Municipality border */}
              {municipalityFeature && (
                <GeoJSON
                  key={municipalityFeature.properties.Concelho}
                  data={municipalityFeature as any}
                  style={{
                    fillColor: "#1890ff",
                    fillOpacity: 0.1,
                    color: "#1890ff",
                    weight: 2,
                  }}
                />
              )}
              {/* Transect markers */}
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
                    <div style={{ minWidth: 150 }}>
                      <strong>{transect.transectName}</strong>
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
          </div>
        </div>
      </Card>

      {/* Month Filter Controls */}
      <div
        style={{
          padding: "16px",
          backgroundColor: "#f5f5f5",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Checkbox
          checked={filterByMonth}
          onChange={e => {
            const checked = e.target.checked;
            setFilterByMonth(checked);
            if (checked) {
              setSearchParams({ month: selectedMonth.toString() });
            } else {
              setSearchParams({});
            }
          }}
        >
          Filtrar por mês
        </Checkbox>

        <div style={{ flex: 1 }}>
          <Slider
            disabled={!filterByMonth}
            min={MONITORING_MONTHS[0]}
            max={MONITORING_MONTHS[MONITORING_MONTHS.length - 1]}
            value={selectedMonth}
            trackStyle={{ display: "none" }}
            onChange={(value: number) => {
              // Find the closest monitoring month
              const closest = MONITORING_MONTHS.reduce((prev, curr) =>
                Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
              );
              setSelectedMonth(closest);
              if (filterByMonth) {
                setSearchParams({ month: closest.toString() });
              }
            }}
            marks={MONITORING_MONTHS.reduce(
              (acc, month) => {
                acc[month] = MONTH_NAMES[month - 1];
                return acc;
              },
              {} as Record<number, string>
            )}
            tooltip={{
              formatter: (value?: number) => {
                if (value === undefined) return "";
                return MONTH_NAMES[value - 1];
              },
            }}
          />
        </div>
      </div>

      <Card title={`Espécies Registadas (${displayedSpeciesCount})`}>
        {displayedSpecies.length === 0 ? (
          <Alert message="Sem dados de espécies para este município" type="info" />
        ) : (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {sortedFamilies.map(family => (
              <div key={family}>
                <Title level={4} style={{ marginBottom: 12 }}>{family}</Title>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "8px",
                  }}
                >
                  {familyGroups[family].map(speciesName => (
                    <SpeciesCard
                      key={speciesName}
                      speciesName={speciesName}
                      commonName={commonNamesMap[speciesName]}
                      family={family}
                      climaticRegion={municipalityClimaticRegion}
                      municipalityTransects={municipalityTransects}
                      flightCurvesData={flightCurvesData}
                    />
                  ))}
                </div>
              </div>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  );
}

export default MunicipalityPage;
