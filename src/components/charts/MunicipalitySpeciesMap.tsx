import React, { useEffect, useState, useRef } from "react";
import { Collapse, Typography, Spin, Slider, Button, Checkbox } from "antd";
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const { Title, Text } = Typography;

interface TransectInfo {
  name: string;
  isActive: boolean;
}

interface MunicipalityProperties {
  Concelho: string;
  speciesCount: number;
  transectCount: number;
  transects: TransectInfo[];
  monthlySpeciesCount: { [month: number]: number }; // { 1: 5, 2: 8, ... 12: 3 }
  species: string[]; // Array of species names
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

const MunicipalitySpeciesMap: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState<MunicipalityGeoJSON | null>(null);
  const [maxSpecies, setMaxSpecies] = useState(0);
  const [filterByMonth, setFilterByMonth] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(MONITORING_MONTHS[0]); // Default to first monitoring month
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchGeoJSONData();
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  const fetchGeoJSONData = async () => {
    try {
      // eslint-disable-next-line no-undef
      const response = await fetch("data/municipalities-species-map.geojson");
      const data: MunicipalityGeoJSON = await response.json();
      setGeoData(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error loading municipality data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Play/pause control for month animation
  const handlePlayPause = () => {
    if (isPlaying) {
      // Stop playing
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // Start playing - always start from the beginning
      setSelectedMonth(MONITORING_MONTHS[0]); // Reset to March
      setIsPlaying(true);
      playIntervalRef.current = setInterval(() => {
        setSelectedMonth(prev => {
          const currentIndex = MONITORING_MONTHS.indexOf(prev);
          const nextIndex = currentIndex + 1;

          // Stop at the end of monitoring season
          if (nextIndex >= MONITORING_MONTHS.length) {
            if (playIntervalRef.current) {
              clearInterval(playIntervalRef.current);
              playIntervalRef.current = null;
            }
            setIsPlaying(false);
            return prev; // Stay at last month
          }

          return MONITORING_MONTHS[nextIndex];
        });
      }, 800);
    }
  };

  // Update maxSpecies when geoData loads - always use same scale
  useEffect(() => {
    if (!geoData) return;

    // Always calculate max across all months for consistent color scale
    let max = 0;
    geoData.features.forEach(feature => {
      const { speciesCount, monthlySpeciesCount } = feature.properties;
      // Check overall species count
      max = Math.max(max, speciesCount);
      // Check each month's count
      if (monthlySpeciesCount) {
        Object.values(monthlySpeciesCount).forEach(count => {
          max = Math.max(max, count);
        });
      }
    });
    setMaxSpecies(max);
  }, [geoData]);

  const getColor = (speciesCount: number): string => {
    if (speciesCount === 0) return "#d9d9d9"; // Grey for no data

    // Color scale from light yellow to dark orange (6 levels)
    const ratio = maxSpecies > 0 ? speciesCount / maxSpecies : 0;
    if (ratio < 0.167) return "#ffffd4"; // Very light yellow
    if (ratio < 0.333) return "#fee391"; // Light yellow
    if (ratio < 0.5) return "#fec44f"; // Yellow-orange
    if (ratio < 0.667) return "#fe9929"; // Orange
    if (ratio < 0.833) return "#ec7014"; // Dark orange
    return "#cc4c02"; // Very dark orange
  };

  const style = (feature: GeoJSONFeature | undefined) => {
    if (!feature) return {};

    // Get species count based on filter mode
    let speciesCount: number;
    if (!filterByMonth) {
      // All year
      speciesCount = feature.properties.speciesCount ?? 0;
    } else {
      // Specific month
      speciesCount = feature.properties.monthlySpeciesCount?.[selectedMonth] ?? 0;
    }

    return {
      fillColor: getColor(speciesCount),
      weight: 1,
      opacity: 1,
      color: "#666",
      fillOpacity: 0.7,
    };
  };

  const onEachFeature = (feature: GeoJSONFeature, layer: any) => {
    const { Concelho, speciesCount, transectCount, transects, monthlySpeciesCount } =
      feature.properties;

    let popupContent = `<strong>${Concelho}</strong><br/>`;

    // Show month-specific or all-year data
    if (!filterByMonth) {
      // All year view
      if (speciesCount > 0) {
        popupContent += `Espécies: ${speciesCount}<br/>`;
        popupContent += `Transectos: ${transectCount}<br/>`;

        // Add transect list with active/inactive status
        if (transects && transects.length > 0) {
          popupContent += `<br/><strong>Transectos:</strong><br/>`;
          transects.forEach((transect: TransectInfo) => {
            const statusIcon = transect.isActive ? "✓" : "✗";
            const statusColor = transect.isActive ? "green" : "red";
            popupContent += `<span style="color: ${statusColor}">${statusIcon}</span> ${transect.name}<br/>`;
          });
        }

        // Add link to municipality page
        const municipalityUrl = `#/municipality/${encodeURIComponent(Concelho.toLowerCase())}`;
        popupContent += `<br/><a href="${municipalityUrl}" style="color: #1890ff; text-decoration: none;">Ver detalhes do município →</a>`;
      } else {
        popupContent += `Sem dados`;
      }
    } else {
      // Month-specific view
      const monthSpeciesCount = monthlySpeciesCount?.[selectedMonth] ?? 0;
      if (monthSpeciesCount > 0) {
        popupContent += `Espécies: ${monthSpeciesCount}<br/>`;
        popupContent += `Transectos: ${transectCount}<br/>`;

        // Add link to municipality page with month parameter
        const municipalityUrl = `#/municipality/${encodeURIComponent(Concelho.toLowerCase())}?month=${selectedMonth}`;
        popupContent += `<br/><a href="${municipalityUrl}" style="color: #1890ff; text-decoration: none;">Ver detalhes do município →</a>`;
      } else {
        popupContent += `Sem dados para este mês`;
      }
    }

    layer.bindPopup(popupContent);

    // Highlight on hover
    layer.on({
      mouseover: (e: any) => {
        const layer = e.target;
        layer.setStyle({
          weight: 3,
          color: "#333",
          fillOpacity: 0.9,
        });
      },
      mouseout: (e: any) => {
        const layer = e.target;
        layer.setStyle(style(feature));
      },
    });
  };

  if (loading) {
    return (
      <Collapse
        items={[
          {
            key: "1",
            label: (
              <div>
                <Title level={4} style={{ marginBottom: 0, display: "inline" }}>
                  Mapa de Espécies por Município
                </Title>
              </div>
            ),
            children: (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Spin size="large" />
              </div>
            ),
          },
        ]}
      />
    );
  }

  if (!geoData) {
    return (
      <Collapse
        items={[
          {
            key: "1",
            label: (
              <div>
                <Title level={4} style={{ marginBottom: 0, display: "inline" }}>
                  Mapa de Espécies por Município
                </Title>
              </div>
            ),
            children: (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Text type="secondary">Erro ao carregar dados do mapa</Text>
              </div>
            ),
          },
        ]}
      />
    );
  }

  // Calculate stats based on filter mode
  let municipalitiesWithData: number;
  let municipalitiesWithoutData: number;

  if (!filterByMonth) {
    // All year stats
    municipalitiesWithData = geoData.features.filter(f => f.properties.speciesCount > 0).length;
    municipalitiesWithoutData = geoData.features.filter(
      f => f.properties.speciesCount === 0
    ).length;
  } else {
    // Month-specific stats
    municipalitiesWithData = geoData.features.filter(
      f => (f.properties.monthlySpeciesCount?.[selectedMonth] ?? 0) > 0
    ).length;
    municipalitiesWithoutData = geoData.features.filter(
      f => (f.properties.monthlySpeciesCount?.[selectedMonth] ?? 0) === 0
    ).length;
  }

  const items = [
    {
      key: "1",
      label: (
        <div>
          <Title level={4} style={{ marginBottom: 0, display: "inline" }}>
            Mapa de Espécies por Município
          </Title>
          <Text type="secondary" style={{ marginLeft: 16 }}>
            {municipalitiesWithData} municípios com dados (inclui transectos inativos) •{" "}
            {municipalitiesWithoutData} sem dados
          </Text>
        </div>
      ),
      children: (
        <div>
          {/* Month Filter Controls */}
          <div
            style={{
              marginBottom: 24,
              padding: "16px",
              backgroundColor: "#f5f5f5",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* Checkbox on the left */}
            <Checkbox
              checked={filterByMonth}
              onChange={e => {
                const checked = e.target.checked;
                setFilterByMonth(checked);
                // Stop playing when toggling off
                if (!checked && isPlaying) {
                  if (playIntervalRef.current) {
                    clearInterval(playIntervalRef.current);
                    playIntervalRef.current = null;
                  }
                  setIsPlaying(false);
                }
              }}
            >
              Por mês
            </Checkbox>

            {/* Slider in the middle */}
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
                  // Stop playing when user manually changes the month
                  if (isPlaying) {
                    if (playIntervalRef.current) {
                      clearInterval(playIntervalRef.current);
                      playIntervalRef.current = null;
                    }
                    setIsPlaying(false);
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

            {/* Animate button on the right */}
            <Button
              type="primary"
              icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handlePlayPause}
              size="small"
              disabled={!filterByMonth}
            >
              {isPlaying ? "Pausar" : "Animar"}
            </Button>
          </div>

          <div style={{ height: 600, marginBottom: 16 }}>
            <MapContainer center={[39.5, -8.0]} zoom={7} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {geoData && (
                <GeoJSON
                  key={`${filterByMonth}-${selectedMonth}`}
                  data={geoData as any}
                  style={style}
                  onEachFeature={onEachFeature}
                />
              )}
            </MapContainer>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Text strong>Legenda:</Text>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: "#d9d9d9",
                  border: "1px solid #666",
                }}
              />
              <Text>Sem dados</Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: "#ffffd4",
                  border: "1px solid #666",
                }}
              />
              <Text>1-{Math.ceil(maxSpecies * 0.167)} espécies</Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: "#fee391",
                  border: "1px solid #666",
                }}
              />
              <Text>
                {Math.ceil(maxSpecies * 0.167 + 1)}-{Math.ceil(maxSpecies * 0.333)} espécies
              </Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: "#fec44f",
                  border: "1px solid #666",
                }}
              />
              <Text>
                {Math.ceil(maxSpecies * 0.333 + 1)}-{Math.ceil(maxSpecies * 0.5)} espécies
              </Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: "#fe9929",
                  border: "1px solid #666",
                }}
              />
              <Text>
                {Math.ceil(maxSpecies * 0.5 + 1)}-{Math.ceil(maxSpecies * 0.667)} espécies
              </Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: "#ec7014",
                  border: "1px solid #666",
                }}
              />
              <Text>
                {Math.ceil(maxSpecies * 0.667 + 1)}-{Math.ceil(maxSpecies * 0.833)} espécies
              </Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: "#cc4c02",
                  border: "1px solid #666",
                }}
              />
              <Text>{Math.ceil(maxSpecies * 0.833 + 1)}+ espécies</Text>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return <Collapse items={items} />;
};

export default MunicipalitySpeciesMap;
