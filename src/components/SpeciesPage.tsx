/* eslint-env browser */
import { useState, useEffect } from "react";
import { Button, Card, Space, Typography, Spin, Alert, Row, Col, Select } from "antd";
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
import type { GBIData } from "../types/gbiData";

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
  const [gbiData, setGbiData] = useState<GBIData | null>(null);
  const [loading, setLoading] = useState(true);

  // Decode the species name from URL
  const decodedSpeciesName = speciesName ? decodeURIComponent(speciesName) : "";
  const family = SPECIES_FAMILIES[decodedSpeciesName] || "Informação não disponível";

  // Load timeline, transect, flight curves, phenology, and GBI data
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
      fetch("data/phenology-curves-data.json")
        .then(res => res.json())
        .catch(() => null),
      // eslint-disable-next-line no-undef
      fetch("data/gbi-data.json")
        .then(res => res.json())
        .catch(() => null),
    ])
      .then(([timeline, transects, flightCurves, phenology, gbi]) => {
        setTimelineData(timeline);
        setTransectData(transects);
        setFlightCurvesData(flightCurves);
        setPhenologyData(phenology);
        setGbiData(gbi);
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
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Title level={2} italic style={{ marginBottom: 0 }}>
            {decodedSpeciesName}
          </Title>
          <Text strong style={{ fontSize: 16 }}>
            Família: {family}
          </Text>
          {/* Show trend classification from GBI data (for GBI species) or flight curves data (for all other species) */}
          {(() => {
            const gbiTrend = gbiData?.speciesTrends?.[decodedSpeciesName]?.trendClassification;
            const flightCurvesTrend =
              flightCurvesData?.species?.[decodedSpeciesName]?.trendClassification;
            const trendClassification = gbiTrend || flightCurvesTrend;

            if (trendClassification) {
              return (
                <div style={{ marginTop: 8 }}>
                  <Text strong>Tendência Populacional: </Text>
                  <TrendClassificationBadge
                    classification={trendClassification}
                    showDetails={true}
                  />
                </div>
              );
            }
            return null;
          })()}
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

      {/* Trend Chart Card - shows whenever trend data exists (from flight curves or GBI) */}
      {(() => {
        const flightCurvesTrend = flightCurvesData?.species?.[decodedSpeciesName];
        const gbiTrend = gbiData?.speciesTrends?.[decodedSpeciesName];

        // Use flight curves data if available, otherwise GBI data
        const trendData =
          flightCurvesTrend ||
          (gbiTrend
            ? {
                collatedIndices: gbiTrend.annualIndices,
                trendLine: gbiTrend.trendLine,
                confidenceIntervals: gbiTrend.confidenceIntervals,
              }
            : null);

        if (!trendData) return null;

        return (
          <Card title="Tendência Populacional">
            <SpeciesTrendChart speciesData={trendData} />
          </Card>
        );
      })()}

      <Card title="Curvas de Voo (Regionais)">
        <FlightCurvesDisplay
          speciesName={decodedSpeciesName}
          phenologyData={phenologyData?.species?.[decodedSpeciesName]}
          loading={loading}
        />
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
    </Space>
  );
}

export default SpeciesPage;
