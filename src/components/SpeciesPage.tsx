import { useState, useEffect } from "react";
import { Button, Card, Space, Typography, Spin, Alert, Row, Col, Select } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { SPECIES_FAMILIES } from "../utils/speciesFamilies";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";
import { calculateSpeciesPresenceByYear } from "../utils/speciesMapUtils";
import SpeciesMap from "./SpeciesMap";

const { Title, Text } = Typography;

function SpeciesPage() {
  const { speciesName } = useParams<{ speciesName: string }>();
  const navigate = useNavigate();

  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [transectData, setTransectData] = useState<TransectData | null>(null);
  const [loading, setLoading] = useState(true);

  // Decode the species name from URL
  const decodedSpeciesName = speciesName ? decodeURIComponent(speciesName) : "";
  const family = SPECIES_FAMILIES[decodedSpeciesName] || "Informação não disponível";

  // Load timeline and transect data
  useEffect(() => {
    Promise.all([
      fetch("/data/timeline-data.json").then(res => res.json()),
      fetch("/data/processed-transects.json").then(res => res.json()),
    ])
      .then(([timeline, transects]) => {
        setTimelineData(timeline);
        setTransectData(transects);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleGoBack = () => {
    navigate(-1);
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

  // Sort families and species within each family
  const sortedFamilies = Object.keys(speciesByFamily).sort();
  const speciesOptions = sortedFamilies.map(family => ({
    label: family,
    options: speciesByFamily[family].sort().map(species => {
      const hasRecords = speciesWithRecords.has(species);
      return {
        label: hasRecords ? species : `${species} (sem registos)`,
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
          style={{ width: 300 }}
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
                  <SpeciesMap transects={speciesData} />
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
