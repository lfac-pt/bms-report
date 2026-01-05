/* eslint-env browser */
import { useState, useEffect } from "react";
import { Button, Card, Space, Typography, Spin, Alert, Row, Col, Select, Switch, Tooltip, Divider, Tag } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { SPECIES_FAMILIES } from "../constants";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";
import { calculateSpeciesPresenceByYear } from "../utils/speciesMapUtils";
import SpeciesMap from "./SpeciesMap";
import endangeredSpeciesPT from "../utils/endangered_pt";
import endangeredSpeciesEurope from "../utils/endangered_eu";
import { FlightCurvesDisplay } from "./charts/FlightCurveChart";
import { SpeciesTrendChart } from "./charts/SpeciesTrendChart";
import TrendClassificationBadge from "./TrendClassificationBadge";
import { getPlantFamilyIcon, getPlantFamilyCommonName } from "../utils/plantFamilyIcons";
import { getHabitatTypeIcon } from "../utils/habitatTypeIcons";

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
  const [ecologyData, setEcologyData] = useState<any>(null);
  const [commonNames, setCommonNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showOnlyQualityTransects, setShowOnlyQualityTransects] = useState(true);

  // Decode the species name from URL
  const decodedSpeciesName = speciesName ? decodeURIComponent(speciesName) : "";
  const family = SPECIES_FAMILIES[decodedSpeciesName] || "Informação não disponível";

  // Load timeline, transect, and flight curves data
  // Note: Regional phenology data is now included in flight-curves-data.json
  useEffect(() => {
    Promise.all([
      // eslint-disable-next-line no-undef
      fetch("data/timeline-data.json").then(res => res.json()),
      // eslint-disable-next-line no-undef
      fetch("data/processed-transects.json").then(res => res.json()),
      // eslint-disable-next-line no-undef
      fetch("data/flight-curves-data.json")
        .then(res => res.json())
        .catch(() => null),
      // eslint-disable-next-line no-undef
      fetch("data/species-ecology.json")
        .then(res => res.json())
        .catch(() => null),
      // eslint-disable-next-line no-undef
      fetch("data/common-names.json")
        .then(res => res.json())
        .catch(() => ({})),
    ])
      .then(([timeline, transects, flightCurves, ecology, commonNamesData]) => {
        setTimelineData(timeline);
        setTransectData(transects);
        setFlightCurvesData(flightCurves);
        setEcologyData(ecology);
        setCommonNames(commonNamesData);
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
      const hasFlightCurves = flightCurvesData?.species?.[species] != null;

      // Check if species is endangered
      let endangeredLabel = "";
      if (endangeredSpeciesPT[species]) {
        endangeredLabel = ` (${endangeredSpeciesPT[species]} - PT)`;
      } else if (endangeredSpeciesEurope[species]) {
        endangeredLabel = ` (${endangeredSpeciesEurope[species]} - UE)`;
      }

      const recordsLabel = hasRecords ? "" : " (sem registos)";
      const flightCurvesLabel = hasFlightCurves ? " (curvas de voo)" : "";
      const label = `${species}${endangeredLabel}${flightCurvesLabel}${recordsLabel}`;

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
        <Row gutter={24}>
          {/* Species Photo */}
          <Col xs={24} md={8}>
            <div style={{
              width: '100%',
              height: '100%',
              minHeight: 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,.1), 0 4px 12px rgba(0,0,0,.06)'
            }}>
              <img
                src={`imgs/sp/${family}/${decodedSpeciesName}.jpg`}
                alt={`Fotografia de ${decodedSpeciesName}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 12
                }}
                onError={(e) => {
                  // Hide image if it fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </Col>

          {/* Species Information */}
          <Col xs={24} md={16}>
            {/* Species Name and Family */}
            <div style={{ marginBottom: 20 }}>
              <Title
                level={1}
                italic
                style={{
                  marginBottom: 4,
                  color: '#262626',
                  fontFamily: 'Baskerville, "Baskerville Old Face", "Hoefler Text", Garamond, "Times New Roman", serif',
                  fontSize: 52,
                  fontWeight: 400
                }}
              >
                {decodedSpeciesName}
              </Title>
              {commonNames[decodedSpeciesName] && (
                <Text
                  style={{
                    fontSize: 20,
                    color: '#595959',
                    display: 'block',
                    marginBottom: 12
                  }}
                >
                  {commonNames[decodedSpeciesName]}
                </Text>
              )}
              <Space size={8} wrap>
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                  {family}
                </Tag>
                {endangeredSpeciesPT[decodedSpeciesName] && (
                  <Tooltip title={`${getEndangermentDescription(endangeredSpeciesPT[decodedSpeciesName])} em Portugal`}>
                    <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px', cursor: 'help' }}>
                      {endangeredSpeciesPT[decodedSpeciesName]} - PT
                    </Tag>
                  </Tooltip>
                )}
                {!endangeredSpeciesPT[decodedSpeciesName] && endangeredSpeciesEurope[decodedSpeciesName] && (
                  <Tooltip title={`${getEndangermentDescription(endangeredSpeciesEurope[decodedSpeciesName])} na União Europeia`}>
                    <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px', cursor: 'help' }}>
                      {endangeredSpeciesEurope[decodedSpeciesName]} - UE
                    </Tag>
                  </Tooltip>
                )}
                {(() => {
                  const trendClassification =
                    flightCurvesData?.species?.[decodedSpeciesName]?.trendClassification;

                  if (trendClassification) {
                    return (
                      <TrendClassificationBadge
                        classification={trendClassification}
                        showDetails={true}
                        style={{ fontSize: 14, padding: '4px 12px' }}
                      />
                    );
                  }
                  return null;
                })()}
              </Space>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            {/* Ecology Information */}
            {ecologyData && ecologyData[decodedSpeciesName] && (
              <Row gutter={24}>
                {/* Habitat */}
                <Col xs={24} sm={12}>
                  <div>
                    <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>
                      Habitat
                    </Text>
                    <Tooltip title={
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                          {ecologyData[decodedSpeciesName].habitatType}
                        </div>
                        <div style={{ fontSize: 12 }}>
                          {ecologyData[decodedSpeciesName].habitats.join(', ')}
                        </div>
                      </div>
                    }>
                      <Tag
                        color="green"
                        style={{
                          fontSize: 28,
                          padding: '8px 16px',
                          cursor: 'help',
                          border: '2px solid #52c41a',
                          borderRadius: 8
                        }}
                      >
                        {getHabitatTypeIcon(ecologyData[decodedSpeciesName].habitatType)}
                      </Tag>
                    </Tooltip>
                  </div>
                </Col>

                {/* Host Plants */}
                {ecologyData[decodedSpeciesName].hostPlantFamilies &&
                 ecologyData[decodedSpeciesName].hostPlantFamilies.length > 0 && (
                  <Col xs={24} sm={12}>
                    <div>
                      <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>
                        Plantas Hospedeiras
                      </Text>
                      <Space size={12} wrap>
                        {ecologyData[decodedSpeciesName].hostPlantFamilies.map((family: string) => {
                          const speciesList = ecologyData[decodedSpeciesName].hostPlantSpecies || [];
                          const commonName = getPlantFamilyCommonName(family);
                          const familyDisplay = commonName ? `${family} (${commonName})` : family;
                          const tooltipContent = (
                            <div>
                              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{familyDisplay}</div>
                              {speciesList.length > 0 && (
                                <div style={{ fontSize: 12, fontStyle: 'italic' }}>
                                  {speciesList.map((species: string) => (
                                    <div key={species}>{species}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                          return (
                            <Tooltip key={family} title={tooltipContent}>
                              <Tag
                                color="orange"
                                style={{
                                  fontSize: 28,
                                  padding: '8px 16px',
                                  cursor: 'help',
                                  border: '2px solid #fa8c16',
                                  borderRadius: 8
                                }}
                              >
                                {getPlantFamilyIcon(family)}
                              </Tag>
                            </Tooltip>
                          );
                        })}
                      </Space>
                    </div>
                  </Col>
                )}

                {/* Sources */}
                {ecologyData[decodedSpeciesName].sources &&
                 ecologyData[decodedSpeciesName].sources.length > 0 && (
                  <Col xs={24} style={{ marginTop: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Fontes:{' '}
                      {ecologyData[decodedSpeciesName].sources.map((source: string, idx: number) => (
                        <span key={idx}>
                          <a
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12, fontWeight: 500 }}
                          >
                            [{idx + 1}]
                          </a>
                          {idx < ecologyData[decodedSpeciesName].sources.length - 1 ? ' ' : ''}
                        </span>
                      ))}
                    </Text>
                  </Col>
                )}
              </Row>
            )}
          </Col>
        </Row>
      </Card>

      {/* Trend Chart Card - shows only when flight curves data exists */}
      {(() => {
        const flightCurvesTrend = flightCurvesData?.species?.[decodedSpeciesName];

        if (!flightCurvesTrend) return null;

        return (
          <>
            <Card title="Tendência Populacional">
              <SpeciesTrendChart speciesData={flightCurvesTrend} />
            </Card>
            {flightCurvesTrend.ciExceedsThreshold && (
              <Alert
                message="Intervalos de Confiança Muito Amplos"
                description={
                  <>
                    Esta espécie apresenta intervalos de confiança extremamente amplos (range
                    máximo: {flightCurvesTrend.maxCIRange?.toFixed(0)}), o que indica que as
                    estimativas têm baixa precisão. Isto pode dever-se a uma taxa de deteção muito
                    baixa ({((flightCurvesTrend.dataQuality?.detectionRate || 0) * 100).toFixed(2)}
                    %) ou dados esparsos. Os intervalos de confiança podem não ser confiáveis para
                    esta espécie.
                  </>
                }
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </>
        );
      })()}

      <Card title="Curvas de Voo (Regionais)">
        <FlightCurvesDisplay
          speciesName={decodedSpeciesName}
          phenologyData={
            flightCurvesData?.species?.[decodedSpeciesName]?.regionalPhenologyCurves
              ? { regions: flightCurvesData.species[decodedSpeciesName].regionalPhenologyCurves }
              : null
          }
          loading={loading}
        />
      </Card>

      <Card
        title="Distribuição por Ano"
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {showOnlyQualityTransects
                ? "Apenas transectos usados no cálculo de tendências"
                : "Todos os transectos"}
            </Text>
            <Switch
              checked={showOnlyQualityTransects}
              onChange={setShowOnlyQualityTransects}
              checkedChildren="Qualidade"
              unCheckedChildren="Todos"
            />
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          {years.map(year => {
            // Get quality transect IDs from flight curves metadata
            const qualityTransectIds = new Set(
              flightCurvesData?.metadata?.transectsUsed?.map((t: any) => t.transectId) || []
            );

            // Calculate species presence for all transects
            let speciesData = calculateSpeciesPresenceByYear(
              decodedSpeciesName,
              year,
              timelineData,
              transectData.transects
            );

            // Filter to only quality transects if toggle is enabled
            if (showOnlyQualityTransects && qualityTransectIds.size > 0) {
              speciesData = speciesData.filter(t => qualityTransectIds.has(t.transectId));
            }

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
    </Space>
  );
}

export default SpeciesPage;
