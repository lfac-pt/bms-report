import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Space, Typography, Button, Row, Col, Card, Statistic, Popover, List, Alert, Tooltip } from "antd";
import { ArrowLeftOutlined, InfoCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { GBIData } from "../types/gbiData";
import { TransectData } from "../types/transectStats";
import GrasslandButterflyIndex from "./charts/GrasslandButterflyIndex";
import SpeciesLink from "./SpeciesLink";
import { GRASSLAND_SPECIES } from "../constants";

// Helper function to translate trend categories to Portuguese
const getTrendCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    "Strong increase": "Aumento Forte",
    "Moderate increase": "Aumento Moderado",
    Stable: "Estável",
    Uncertain: "Incerto",
    "Moderate decline": "Declínio Moderado",
    "Strong decline": "Declínio Forte",
  };
  return labels[category] || category;
};

// Helper function to get color based on trend category
const getTrendColor = (category: string): string => {
  const colors: Record<string, string> = {
    "Strong increase": "#52c41a",
    "Moderate increase": "#95de64",
    Stable: "#1890ff",
    Uncertain: "#faad14",
    "Moderate decline": "#ff7875",
    "Strong decline": "#cf1322",
  };
  return colors[category] || "#8c8c8c";
};

function GBIPage() {
  const navigate = useNavigate();
  const [gbiData, setGbiData] = useState<GBIData | null>(null);
  const [transectData, setTransectData] = useState<TransectData | null>(null);
  const [loading, setLoading] = useState(true);

  // Load GBI data and transect data
  useEffect(() => {
    Promise.all([
      // eslint-disable-next-line no-undef
      fetch("data/gbi-data.json").then(res => res.json()),
      // eslint-disable-next-line no-undef
      fetch("data/processed-transects.json").then(res => res.json()),
    ])
      .then(([gbi, transects]) => {
        setGbiData(gbi);
        setTransectData(transects);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleGoBack = () => {
    navigate("/transects");
  };

  const speciesCount = gbiData?.metadata?.grasslandSpecies?.length || 0;
  const transectCount = gbiData?.metadata?.transectsUsed?.length || 0;

  // Create a mapping from transectId to transectName
  const transectIdToName: Record<string, string> = {};
  if (transectData) {
    transectData.transects.forEach(t => {
      transectIdToName[t.transectId] = t.transectName;
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={handleGoBack}>
          Voltar
        </Button>
      </div>

      <Alert
        message="Índice de Borboletas de Prados (GBI)"
        description={
          gbiData ? (
            <>
              Este índice rastreia a saúde das populações de borboletas de pastagens em Portugal
              usando uma média geométrica de tendências log-lineares de {speciesCount} espécies (
              {gbiData.metadata.grasslandSpecies.filter((s: any) => s.type === "widespread").length}{" "}
              generalistas, {gbiData.metadata.grasslandSpecies.filter((s: any) => s.type === "specialist").length}{" "}
              especialistas) de {transectCount} transectos de alta qualidade. Ano base{" "}
              {gbiData.metadata.baselineYear} = 100. Os valores acima de 100 indicam crescimento
              populacional; abaixo de 100 indicam declínio.
            </>
          ) : (
            "A carregar informação..."
          )
        }
        type="info"
        showIcon
      />

      <Row gutter={16}>
        <Col span={8}>
          <Card loading={loading}>
            {gbiData?.gbiTrend ? (
              <Tooltip
                title={
                  <div>
                    <div>
                      Taxa anual: {gbiData.gbiTrend.pc1.toFixed(1)}% [
                      {gbiData.gbiTrend.pc1CI.lower.toFixed(1)}%,{" "}
                      {gbiData.gbiTrend.pc1CI.upper.toFixed(1)}%]
                    </div>
                    <div>
                      Mudança total: {gbiData.gbiTrend.pcn.toFixed(1)}% [
                      {gbiData.gbiTrend.pcnCI.lower.toFixed(1)}%,{" "}
                      {gbiData.gbiTrend.pcnCI.upper.toFixed(1)}%]
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>
                      Classificação baseada em intervalos de confiança de 95% da taxa de mudança anual
                    </div>
                  </div>
                }
              >
                <div style={{ cursor: "help" }}>
                  <Statistic
                    title={
                      <span>
                        Tendência <InfoCircleOutlined style={{ fontSize: 12 }} />
                      </span>
                    }
                    value={`${getTrendCategoryLabel(gbiData.gbiTrend.category)} (${gbiData.gbiTrend.pc1.toFixed(1)}%/ano)`}
                    valueStyle={{
                      color: getTrendColor(gbiData.gbiTrend.category),
                    }}
                  />
                </div>
              </Tooltip>
            ) : (
              <Statistic title="Tendência" value="N/A" />
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Popover
              content={
                <div style={{ maxWidth: 400, maxHeight: 400, overflowY: "auto" }}>
                  {/* Get included species from GBI metadata */}
                  {(() => {
                    const includedSpeciesNames = new Set(
                      gbiData?.metadata?.grasslandSpecies?.map(s => s.scientificName) || []
                    );

                    // Get all species sorted, with inclusion status
                    const widespreadAll = [...GRASSLAND_SPECIES.widespread].sort();
                    const specialistAll = [...GRASSLAND_SPECIES.specialist].sort();

                    const widespreadIncludedCount = widespreadAll.filter(s => includedSpeciesNames.has(s)).length;
                    const specialistIncludedCount = specialistAll.filter(s => includedSpeciesNames.has(s)).length;

                    return (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <Typography.Text
                            strong
                            style={{ display: "block", marginBottom: 8, color: "#52c41a" }}
                          >
                            Generalistas ({widespreadIncludedCount} de {GRASSLAND_SPECIES.widespread.size})
                          </Typography.Text>
                          <List
                            size="small"
                            dataSource={widespreadAll}
                            renderItem={species => {
                              const isIncluded = includedSpeciesNames.has(species);
                              return (
                                <List.Item style={{ padding: "4px 0" }}>
                                  <div style={{
                                    fontSize: 12,
                                    color: isIncluded ? "inherit" : "#8c8c8c",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4
                                  }}>
                                    {!isIncluded && (
                                      <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 12 }} />
                                    )}
                                    <SpeciesLink species={species} />
                                  </div>
                                </List.Item>
                              );
                            }}
                          />
                        </div>
                        <div>
                          <Typography.Text
                            strong
                            style={{ display: "block", marginBottom: 8, color: "#1890ff" }}
                          >
                            Especialistas ({specialistIncludedCount} de {GRASSLAND_SPECIES.specialist.size})
                          </Typography.Text>
                          <List
                            size="small"
                            dataSource={specialistAll}
                            renderItem={species => {
                              const isIncluded = includedSpeciesNames.has(species);
                              return (
                                <List.Item style={{ padding: "4px 0" }}>
                                  <div style={{
                                    fontSize: 12,
                                    color: isIncluded ? "inherit" : "#8c8c8c",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4
                                  }}>
                                    {!isIncluded && (
                                      <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 12 }} />
                                    )}
                                    <SpeciesLink species={species} />
                                  </div>
                                </List.Item>
                              );
                            }}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              }
              title="Espécies de Pastagens"
              trigger="click"
              placement="bottom"
            >
              <div style={{ cursor: "pointer" }}>
                <Statistic
                  title={
                    <span>
                      Espécies <InfoCircleOutlined style={{ fontSize: 12 }} />
                    </span>
                  }
                  value={speciesCount}
                  suffix={`de ${GRASSLAND_SPECIES.widespread.size + GRASSLAND_SPECIES.specialist.size}`}
                />
              </div>
            </Popover>
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Popover
              content={
                <div style={{ maxWidth: 400, maxHeight: 400, overflowY: "auto" }}>
                  <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
                    Transectos Qualificados ({transectCount})
                  </Typography.Text>
                  <Typography.Text
                    style={{ fontSize: 12, color: "#8c8c8c", display: "block", marginBottom: 8 }}
                  >
                    Critérios: 5+ anos ativos, 5+ visitas/ano
                  </Typography.Text>
                  <List
                    size="small"
                    dataSource={gbiData?.metadata?.transectsUsed || []}
                    renderItem={transect => (
                      <List.Item style={{ padding: "4px 0" }}>
                        <Typography.Text style={{ fontSize: 12 }}>
                          {transectIdToName[transect.transectId] || transect.transectId}
                        </Typography.Text>
                      </List.Item>
                    )}
                  />
                </div>
              }
              title="Transectos Utilizados no GBI"
              trigger="click"
              placement="bottom"
            >
              <div style={{ cursor: "pointer" }}>
                <Statistic
                  title={
                    <span>
                      Transectos <InfoCircleOutlined style={{ fontSize: 12 }} />
                    </span>
                  }
                  value={transectCount}
                  suffix="qualificados"
                />
              </div>
            </Popover>
          </Card>
        </Col>
      </Row>

      <GrasslandButterflyIndex gbiData={gbiData} loading={loading} />
    </Space>
  );
}

export default GBIPage;
