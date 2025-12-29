import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Space, Typography, Button, Row, Col, Card, Statistic, Popover, List } from "antd";
import { ArrowLeftOutlined, InfoCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { GBIData } from "../types/gbiData";
import { TransectData } from "../types/transectStats";
import GrasslandButterflyIndex from "./charts/GrasslandButterflyIndex";
import SpeciesLink from "./SpeciesLink";
import { GRASSLAND_SPECIES } from "../constants";

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

      <Row gutter={16}>
        <Col span={12}>
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
        <Col span={12}>
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
