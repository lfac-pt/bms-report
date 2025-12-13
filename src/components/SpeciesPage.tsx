import { useState, useEffect } from "react";
import { Button, Card, Space, Typography, Spin, Alert, Row, Col, Select, Radio } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { SPECIES_FAMILIES } from "../utils/speciesFamilies";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";
import { calculateSpeciesPresenceByYear } from "../utils/speciesMapUtils";
import SpeciesMap from "./SpeciesMap";
import { SERIES_COLORS } from "../utils/utils";
import endangeredSpeciesPT from "../utils/endangered_pt";
import endangeredSpeciesEurope from "../utils/endangered_eu";
import { FlightCurvesDisplay } from "./charts/FlightCurveChart";

const { Title, Text } = Typography;

// Define the canonical family order
const FAMILY_ORDER = ["Hesperiidae", "Papilionidae", "Pieridae", "Nymphalidae", "Lycaenidae"];

// Helper function to get full endangerment description
function getEndangermentDescription(status: string): string {
  const descriptions: Record<string, string> = {
    CR: "Criticamente em Perigo",
    EN: "Em Perigo",
    VU: "Vulnerável",
    NT: "Quase Ameaçada",
    DD: "Dados Insuficientes",
    LC: "Pouco Preocupante",
  };
  return descriptions[status] || status;
}

function SpeciesPage() {
  const { speciesName } = useParams<{ speciesName: string }>();
  const navigate = useNavigate();

  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [transectData, setTransectData] = useState<TransectData | null>(null);
  const [flightCurvesData, setFlightCurvesData] = useState<any>(null);
  const [phenologyData, setPhenologyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataViewMode, setDataViewMode] = useState<"flightCurves" | "phenologyCurves">(
    "flightCurves"
  );

  // Decode the species name from URL
  const decodedSpeciesName = speciesName ? decodeURIComponent(speciesName) : "";
  const family = SPECIES_FAMILIES[decodedSpeciesName] || "Informação não disponível";

  // Load timeline, transect, flight curves, and phenology data
  useEffect(() => {
    Promise.all([
      fetch("/data/timeline-data.json").then(res => res.json()),
      fetch("/data/processed-transects.json").then(res => res.json()),
      fetch("/data/flight-curves-data.json")
        .then(res => res.json())
        .catch(() => null),
      fetch("/data/phenology-curves-data.json")
        .then(res => res.json())
        .catch(() => null),
    ])
      .then(([timeline, transects, flightCurves, phenology]) => {
        setTimelineData(timeline);
        setTransectData(transects);
        setFlightCurvesData(flightCurves);
        setPhenologyData(phenology);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleGoBack = () => {
    navigate("/transects");
  };

  const handleSpeciesChange = (selectedSpecies: string) => {
    navigate(`/species/${encodeURIComponent(selectedSpecies)}`);
  };

  // Get all species with observations from timeline data
  const speciesWithRecords = new Set<string>();
  if (timelineData) {
    Object.values(timelineData.observationsByYearDate).forEach(yearData => {
      Object.values(yearData).forEach(observations => {
        observations.forEach(([, species]) => {
          speciesWithRecords.add(species);
        });
      });
    });
  }

  // Group species by family and sort alphabetically within each family
  const speciesByFamily: Record<string, string[]> = {};
  Object.entries(SPECIES_FAMILIES).forEach(([species, family]) => {
    if (!speciesByFamily[family]) {
      speciesByFamily[family] = [];
    }
    speciesByFamily[family].push(species);
  });

  // Sort families by canonical order and species within each family
  const sortedFamilies = Object.keys(speciesByFamily).sort((a, b) => {
    const indexA = FAMILY_ORDER.indexOf(a);
    const indexB = FAMILY_ORDER.indexOf(b);
    // If both families are in the order list, sort by their index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    // If only one is in the list, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    // If neither is in the list, sort alphabetically
    return a.localeCompare(b);
  });
  const speciesOptions = sortedFamilies.map(family => ({
    label: family,
    options: speciesByFamily[family].sort().map(species => {
      const hasRecords = speciesWithRecords.has(species);

      // Check if species is endangered
      let endangeredLabel = "";
      if (endangeredSpeciesPT[species]) {
        endangeredLabel = ` (${endangeredSpeciesPT[species]} - PT)`;
      } else if (endangeredSpeciesEurope[species]) {
        endangeredLabel = ` (${endangeredSpeciesEurope[species]} - UE)`;
      }

      const recordsLabel = hasRecords ? "" : " (sem registos)";
      const label = `${species}${endangeredLabel}${recordsLabel}`;

      return {
        label,
        value: species,
      };
    }),
  }));

  if (loading) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
        <Spin size="large" />
      </Space>
    );
  }

  if (!timelineData || !transectData) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
        <Alert message="Erro ao carregar dados" type="error" />
      </Space>
    );
  }

  // Get available years and calculate species data for each year
  const years = [...timelineData.years].reverse(); // Most recent first

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Button type="default" icon={<ArrowLeftOutlined />} onClick={handleGoBack} size="large">
          Voltar à Visão Geral
        </Button>
        <Select
          showSearch
          value={decodedSpeciesName}
          onChange={handleSpeciesChange}
          placeholder="Escolher espécie..."
          style={{ width: 450 }}
          size="large"
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          options={speciesOptions}
        />
      </div>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Title level={2} italic style={{ marginBottom: 0 }}>
            {decodedSpeciesName}
          </Title>
          <Text strong style={{ fontSize: 16 }}>
            Família: {family}
          </Text>
          {(endangeredSpeciesPT[decodedSpeciesName] ||
            endangeredSpeciesEurope[decodedSpeciesName]) && (
            <Alert
              message={
                endangeredSpeciesPT[decodedSpeciesName]
                  ? `Espécie Ameaçada: ${endangeredSpeciesPT[decodedSpeciesName]} (${getEndangermentDescription(endangeredSpeciesPT[decodedSpeciesName])}) em Portugal.`
                  : `Espécie Ameaçada: ${endangeredSpeciesEurope[decodedSpeciesName]} (${getEndangermentDescription(endangeredSpeciesEurope[decodedSpeciesName])}) na União Europeia.`
              }
              type="warning"
              showIcon
            />
          )}
        </Space>
      </Card>

      <Card title="Distribuição por Ano">
        <Row gutter={[16, 16]}>
          {years.map(year => {
            const speciesData = calculateSpeciesPresenceByYear(
              decodedSpeciesName,
              year,
              timelineData,
              transectData.transects
            );

            const withSpecies = speciesData.filter(t => t.hasSpecies).length;
            const totalTransects = speciesData.length;

            return (
              <Col key={year} xs={24} sm={24} md={12} lg={8} xl={6}>
                <Card
                  type="inner"
                  title={`${year} (${withSpecies} de ${totalTransects} transectos)`}
                  size="small"
                >
                  <SpeciesMap
                    transects={speciesData}
                    speciesName={decodedSpeciesName}
                    year={year}
                    timelineData={timelineData}
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      <Card title="Curvas de Voo">
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* Data view mode switcher */}
          <Radio.Group
            value={dataViewMode}
            onChange={e => setDataViewMode(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button
              value="flightCurves"
              disabled={!flightCurvesData?.species?.[decodedSpeciesName]}
            >
              Curvas de Voo (Anuais)
            </Radio.Button>
            <Radio.Button
              value="phenologyCurves"
              disabled={!phenologyData?.species?.[decodedSpeciesName]}
            >
              Curvas de Voo (Regionais)
            </Radio.Button>
          </Radio.Group>

          {dataViewMode === "phenologyCurves" ? (
            // Regional Phenology Curves View
            <FlightCurvesDisplay
              speciesName={decodedSpeciesName}
              phenologyData={phenologyData?.species?.[decodedSpeciesName]}
              loading={loading}
            />
          ) : (
            // Annual Flight Curves View
            (() => {
              const speciesData = flightCurvesData?.species?.[decodedSpeciesName];

              if (!speciesData) {
                return (
                  <Alert
                    message="Curvas de voo não disponíveis"
                    description="Esta espécie não tem dados suficientes para calcular curvas de voo (mínimo 20 contagens em 3 anos)."
                    type="info"
                    showIcon
                  />
                );
              }

              const years = Object.keys(speciesData.collatedIndices).map(Number).sort();
              const indices = years.map(year => speciesData.collatedIndices[year]);

              const chartData = {
                labels: years.map(String),
                datasets: [
                  {
                    label: "Índice Populacional (2021 = 100)",
                    data: indices,
                    borderColor: SERIES_COLORS[0],
                    backgroundColor: SERIES_COLORS[0] + "33",
                    fill: true,
                    tension: 0.3,
                  },
                ],
              };

              const options = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: "top" as const },
                  tooltip: {
                    callbacks: {
                      label: (context: any) => {
                        return `Índice: ${context.parsed.y.toFixed(2)}`;
                      },
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: false,
                    title: {
                      display: true,
                      text: "Índice Populacional",
                    },
                  },
                  x: {
                    title: {
                      display: true,
                      text: "Ano",
                    },
                  },
                },
              };

              return (
                <>
                  <Alert
                    message="Sobre as Curvas de Voo"
                    description={
                      <>
                        <p style={{ marginBottom: 8 }}>
                          As curvas de voo são calculadas usando a biblioteca <strong>rbms</strong>{" "}
                          (Regional Butterfly Monitoring Scheme) com modelos GAM (Generalized
                          Additive Models) e GLM (Generalized Linear Models).
                        </p>
                        <p style={{ marginBottom: 8 }}>
                          <strong>Dados utilizados:</strong>
                        </p>
                        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                          <li>
                            {speciesData.dataQuality.site_count} transectos de qualidade (5+ anos,
                            10+ visitas/ano)
                          </li>
                          <li>
                            {speciesData.dataQuality.total_counts} contagens ao longo de{" "}
                            {speciesData.dataQuality.years_with_data} anos
                          </li>
                          <li>Baseline: {speciesData.dataQuality.baseline_year} = 100</li>
                          <li>
                            Imputação: {speciesData.dataQuality.imputation_success ? "Sim" : "Não"}
                          </li>
                        </ul>
                      </>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <Card type="inner" title="Tendência Populacional">
                    <div style={{ height: 400 }}>
                      <Line data={chartData} options={options} />
                    </div>
                  </Card>
                </>
              );
            })()
          )}
        </Space>
      </Card>
    </Space>
  );
}

export default SpeciesPage;
