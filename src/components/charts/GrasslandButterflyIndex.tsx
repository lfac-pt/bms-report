import { Line } from "react-chartjs-2";
import {
  Card,
  Alert,
  Row,
  Col,
  Statistic,
  Space,
  Tooltip,
  Popover,
  List,
  Typography,
  Select,
  Button,
  Switch,
} from "antd";
import { InfoCircleOutlined, MinusCircleOutlined } from "@ant-design/icons";
import { GBIData } from "../../types/gbiData";
import SpeciesLink from "../SpeciesLink";
import { useState } from "react";
import { GRASSLAND_SPECIES } from "../../utils/grasslandSpecies";

interface GrasslandButterflyIndexProps {
  gbiData: GBIData | null;
  loading: boolean;
}

// Helper function to translate trend categories to Portuguese
const getTrendCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    "Strong increase": "Aumento Forte",
    "Moderate increase": "Aumento Moderado",
    "Stable": "Estável",
    "Uncertain": "Incerto",
    "Moderate decline": "Declínio Moderado",
    "Strong decline": "Declínio Forte"
  };
  return labels[category] || category;
};

// Helper function to get color based on trend category
const getTrendColor = (category: string): string => {
  const colors: Record<string, string> = {
    "Strong increase": "#52c41a",
    "Moderate increase": "#95de64",
    "Stable": "#1890ff",
    "Uncertain": "#faad14",
    "Moderate decline": "#ff7875",
    "Strong decline": "#cf1322"
  };
  return colors[category] || "#8c8c8c";
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "top" as const,
      labels: {
        filter: (legendItem: any) => {
          // Hide CI Upper from legend (technical dataset)
          return legendItem.text !== "CI Upper";
        },
      },
    },
    tooltip: {
      callbacks: {
        label: function (context: any) {
          const datasetLabel = context.dataset.label || "";
          const year = context.parsed.x;
          const indexValue = context.parsed.y;
          const yearData = context.chart.data.yearData?.[year];

          // Skip CI Upper in tooltip (technical dataset)
          if (datasetLabel === "CI Upper") return undefined;

          // For CI band, show range
          if (datasetLabel === "IC 95%" && yearData) {
            if (yearData.ci_lower != null && yearData.ci_upper != null) {
              return `IC 95%: ${yearData.ci_lower.toFixed(1)} - ${yearData.ci_upper.toFixed(1)}`;
            }
            return undefined;
          }

          // For the main GBI line, show detailed data quality info with CI
          if (datasetLabel === "GBI (Todas as Espécies)" && yearData) {
            const lines = [`${datasetLabel}: ${indexValue.toFixed(2)}`];
            if (yearData.ci_lower != null && yearData.ci_upper != null) {
              lines.push(
                `IC 95%: [${yearData.ci_lower.toFixed(1)}, ${yearData.ci_upper.toFixed(1)}]`
              );
            }
            lines.push(`Transectos: ${yearData.transectCount}`);
            lines.push(`Visitas: ${yearData.totalVisits}`);
            lines.push(`Espécies: ${yearData.speciesWithData}`);
            return lines;
          }

          // For individual species and baseline, show name and value
          return `${datasetLabel}: ${indexValue.toFixed(2)}`;
        },
      },
      filter: (item: any) => item.dataset.label !== "CI Upper",
    },
  },
  scales: {
    y: {
      beginAtZero: false,
      title: {
        display: true,
        text: "Índice (2021 = 100)",
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

function GrasslandButterflyIndex({ gbiData, loading }: GrasslandButterflyIndexProps) {
  // State for selected species - must be before any early returns
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [showGroupComparison, setShowGroupComparison] = useState(false);

  if (loading) {
    return (
      <Card title="Índice de Borboletas de Prados (GBI)" size="small" loading={true}>
        <div style={{ height: "300px" }} />
      </Card>
    );
  }

  if (!gbiData || !gbiData.years || gbiData.years.length === 0) {
    return (
      <Card title="Índice de Borboletas de Prados (GBI)" size="small">
        <Alert
          message="Dados insuficientes"
          description="Não há dados suficientes para calcular o Índice de Borboletas de Prados."
          type="warning"
          showIcon
        />
      </Card>
    );
  }

  const { metadata, gbiByYear, years, speciesTrends } = gbiData;

  // Prepare chart data
  const labels = years.map(year => year.toString());
  const gbiValues = years.map(year => gbiByYear[year].gbiValue);
  const smoothedValues = years.map(year => gbiByYear[year].smoothedValue);

  // Prepare CI band data
  const ciLowerData = years.map(
    year => gbiByYear[year]?.ci_lower ?? gbiByYear[year]?.gbiValue ?? 100
  );
  const ciUpperData = years.map(
    year => gbiByYear[year]?.ci_upper ?? gbiByYear[year]?.gbiValue ?? 100
  );
  const hasConfidenceIntervals = years.some(
    year => gbiByYear[year]?.ci_lower !== null && gbiByYear[year]?.ci_lower !== undefined
  );

  const yearData = years.reduce(
    (acc, year) => {
      acc[year] = {
        ...gbiByYear[year].dataQuality,
        ci_lower: gbiByYear[year].ci_lower,
        ci_upper: gbiByYear[year].ci_upper,
      };
      return acc;
    },
    {} as Record<number, any>
  );

  // Helper function to calculate geometric mean for a group of species
  const calculateGroupIndex = (speciesList: string[]) => {
    return years.map(year => {
      const indices = speciesList
        .filter(species => speciesTrends[species])
        .map(species => speciesTrends[species].annualIndices[year])
        .filter(val => val > 0);

      if (indices.length === 0) return 100;

      const logSum = indices.reduce((sum, val) => sum + Math.log(val), 0);
      const logMean = logSum / indices.length;
      return Math.exp(logMean);
    });
  };

  // Color palette for species
  const speciesColors = [
    "#52c41a",
    "#fa8c16",
    "#722ed1",
    "#13c2c2",
    "#eb2f96",
    "#faad14",
    "#a0d911",
    "#f5222d",
    "#2f54eb",
    "#fadb14",
  ];

  // Create datasets based on mode
  let datasets;

  if (showGroupComparison) {
    // Group comparison mode: show overall, generalists, and specialists
    const generalistSpecies = metadata.grasslandSpecies
      .filter(s => s.type === "widespread" && speciesTrends[s.scientificName])
      .map(s => s.scientificName);

    const specialistSpecies = metadata.grasslandSpecies
      .filter(s => s.type === "specialist" && speciesTrends[s.scientificName])
      .map(s => s.scientificName);

    const generalistIndices = calculateGroupIndex(generalistSpecies);
    const specialistIndices = calculateGroupIndex(specialistSpecies);

    const baseDatasets = [];

    // Add CI band datasets if available
    if (hasConfidenceIntervals) {
      // CI Upper bound (hidden line - serves as fill target)
      baseDatasets.push({
        label: "CI Upper",
        data: ciUpperData,
        borderColor: "transparent",
        backgroundColor: "transparent",
        borderWidth: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        order: 4,
      });

      // CI Lower bound with fill to upper
      baseDatasets.push({
        label: "IC 95%",
        data: ciLowerData,
        borderColor: "rgba(24, 144, 255, 0.3)",
        backgroundColor: "rgba(24, 144, 255, 0.15)",
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: "-1", // Fill to previous dataset (CI Upper)
        order: 4,
      });
    }

    // Add trend line (LOESS smoothed)
    baseDatasets.push({
      label: "Linha de Tendência",
      data: smoothedValues,
      borderColor: "#1890ff",
      backgroundColor: "#1890ff",
      borderWidth: 4,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.4,
      fill: false,
      order: 2,
    });

    baseDatasets.push(
      {
        label: "GBI (Todas as Espécies)",
        data: gbiValues,
        borderColor: "#1890ff",
        backgroundColor: "#1890ff",
        borderWidth: 0,
        pointRadius: 5,
        pointHoverRadius: 7,
        showLine: false,
        fill: false,
        order: 1,
      },
      {
        label: "Generalistas",
        data: generalistIndices,
        borderColor: "#52c41a",
        backgroundColor: "#52c41a",
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.2,
        fill: false,
        order: 2,
      },
      {
        label: "Especialistas",
        data: specialistIndices,
        borderColor: "#722ed1",
        backgroundColor: "#722ed1",
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.2,
        fill: false,
        order: 2,
      },
      {
        label: "Baseline 2021",
        data: Array(years.length).fill(100),
        borderColor: "#d9d9d9",
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        order: 5,
      }
    );

    datasets = baseDatasets;
  } else {
    // Manual selection mode
    const baseDatasets = [];

    // Add CI band datasets if available
    if (hasConfidenceIntervals) {
      // CI Upper bound (hidden line - serves as fill target)
      baseDatasets.push({
        label: "CI Upper",
        data: ciUpperData,
        borderColor: "transparent",
        backgroundColor: "transparent",
        borderWidth: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        order: 4,
      });

      // CI Lower bound with fill to upper
      baseDatasets.push({
        label: "IC 95%",
        data: ciLowerData,
        borderColor: "rgba(24, 144, 255, 0.3)",
        backgroundColor: "rgba(24, 144, 255, 0.15)",
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: "-1", // Fill to previous dataset (CI Upper)
        order: 4,
      });
    }

    // Add trend line (LOESS smoothed)
    baseDatasets.push({
      label: "Linha de Tendência",
      data: smoothedValues,
      borderColor: "#1890ff",
      backgroundColor: "#1890ff",
      borderWidth: 4,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.4,
      fill: false,
      order: 2,
    });

    // Main GBI line
    baseDatasets.push({
      label: "GBI (Todas as Espécies)",
      data: gbiValues,
      borderColor: "#1890ff",
      backgroundColor: "#1890ff",
      borderWidth: 0,
      pointRadius: 5,
      pointHoverRadius: 7,
      showLine: false,
      fill: false,
      order: 1,
    });

    // Add individual species datasets
    baseDatasets.push(
      ...selectedSpecies.map((species, index) => {
        const speciesTrend = speciesTrends[species];
        const speciesData = years.map(year => speciesTrend.annualIndices[year]);
        const color = speciesColors[index % speciesColors.length];

        return {
          label: species,
          data: speciesData,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.2,
          fill: false,
          order: 2,
        };
      })
    );

    // Add baseline reference line at 100
    baseDatasets.push({
      label: "Baseline 2021",
      data: Array(years.length).fill(100),
      borderColor: "#d9d9d9",
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      order: 5,
    });

    datasets = baseDatasets;
  }

  const chartData = {
    labels,
    datasets,
    yearData, // Attach year data for tooltip
  };

  // Calculate summary statistics
  const latestYear = years[years.length - 1];
  const latestGBI = gbiByYear[latestYear].gbiValue;
  const firstYear = years[0];
  const firstGBI = gbiByYear[firstYear].gbiValue;
  const trendPercent = ((latestGBI - firstGBI) / firstGBI) * 100;
  const speciesCount = Object.keys(gbiData.speciesTrends).length;
  const transectCount = metadata.transectsUsed.length;

  // Get species with valid trends for highlighting
  const speciesWithTrends = new Set(Object.keys(gbiData.speciesTrends));

  const gbiCardTitleTooltip = `Este índice rastreia a saúde das populações de borboletas de pastagens em Portugal
              usando uma média geométrica de tendências log-lineares de ${speciesCount} espécies (
              ${metadata.grasslandSpecies.filter(s => s.type === "widespread").length} generalistas,${" "}
              ${metadata.grasslandSpecies.filter(s => s.type === "specialist").length} especialistas)
              de ${transectCount} transectos de alta qualidade. Ano base ${metadata.baselineYear} =
              100. Os valores acima de 100 indicam crescimento populacional; abaixo de 100 indicam
              declínio.`;

  return (
    <Card
      title={
        <Space>
          Índice de Borboletas de Prados (GBI)
          <Tooltip title={gbiCardTitleTooltip}>
            <InfoCircleOutlined style={{ color: "#1890ff" }} />
          </Tooltip>
        </Space>
      }
      size="small"
    >
      <Row gutter={[16, 16]} style={{ marginBottom: "16px" }}>
        <Col xs={24} sm={12} md={8}>
          {gbiData.gbiTrend ? (
            <Tooltip
              title={
                <div>
                  <div>Taxa anual: {gbiData.gbiTrend.pc1.toFixed(1)}% [{gbiData.gbiTrend.pc1CI.lower.toFixed(1)}%, {gbiData.gbiTrend.pc1CI.upper.toFixed(1)}%]</div>
                  <div>Mudança total: {gbiData.gbiTrend.pcn.toFixed(1)}% [{gbiData.gbiTrend.pcnCI.lower.toFixed(1)}%, {gbiData.gbiTrend.pcnCI.upper.toFixed(1)}%]</div>
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
                    fontSize: 16
                  }}
                />
              </div>
            </Tooltip>
          ) : (
            <Statistic
              title="Tendência"
              value={Math.abs(trendPercent).toFixed(1)}
              prefix={trendPercent >= 0 ? "+" : "-"}
              suffix="%"
              valueStyle={{ color: trendPercent >= 0 ? "#3f8600" : "#cf1322" }}
            />
          )}
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Popover
            content={
              <div style={{ maxWidth: 400, maxHeight: 400, overflowY: "auto" }}>
                <Typography.Text
                  style={{
                    fontSize: 11,
                    color: "#8c8c8c",
                    display: "block",
                    marginBottom: 12,
                    fontStyle: "italic",
                  }}
                >
                  Critério: Espécies com dados em pelo menos 3 anos para calcular tendências
                </Typography.Text>
                <div style={{ marginBottom: 16 }}>
                  <Typography.Text
                    strong
                    style={{ display: "block", marginBottom: 8, color: "#52c41a" }}
                  >
                    Generalistas ({GRASSLAND_SPECIES.widespread.length})
                  </Typography.Text>
                  <List
                    size="small"
                    dataSource={[...GRASSLAND_SPECIES.widespread].sort()}
                    renderItem={species => {
                      const hasData = speciesWithTrends.has(species);
                      return (
                        <List.Item style={{ padding: "4px 0" }}>
                          <div
                            style={{
                              fontSize: 12,
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            {!hasData && (
                              <MinusCircleOutlined
                                style={{ color: "#ff4d4f", fontSize: 14, flexShrink: 0 }}
                              />
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
                    Especialistas ({GRASSLAND_SPECIES.specialist.length})
                  </Typography.Text>
                  <List
                    size="small"
                    dataSource={[...GRASSLAND_SPECIES.specialist].sort()}
                    renderItem={species => {
                      const hasData = speciesWithTrends.has(species);
                      return (
                        <List.Item style={{ padding: "4px 0" }}>
                          <div
                            style={{
                              fontSize: 12,
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            {!hasData && (
                              <MinusCircleOutlined
                                style={{ color: "#ff4d4f", fontSize: 14, flexShrink: 0 }}
                              />
                            )}
                            <SpeciesLink species={species} />
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                </div>
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
                suffix={`de ${GRASSLAND_SPECIES.widespread.length + GRASSLAND_SPECIES.specialist.length}`}
              />
            </div>
          </Popover>
        </Col>
        <Col xs={24} sm={12} md={8}>
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
                  dataSource={metadata.transectsUsed}
                  renderItem={transect => (
                    <List.Item style={{ padding: "4px 0" }}>
                      <Typography.Text style={{ fontSize: 12 }}>
                        {transect.transectName}
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
        </Col>
      </Row>

      <div style={{ marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
        <Space>
          <Switch checked={showGroupComparison} onChange={setShowGroupComparison} />
          <Typography.Text style={{ whiteSpace: "nowrap" }}>
            Generalistas vs. especialistas
          </Typography.Text>
        </Space>
        <Select
          mode="multiple"
          placeholder="Selecione espécies individuais para comparar"
          value={selectedSpecies}
          onChange={setSelectedSpecies}
          style={{ flex: 1 }}
          allowClear
          showSearch
          disabled={showGroupComparison}
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          options={Object.keys(speciesTrends)
            .sort()
            .map(species => ({
              value: species,
              label: species,
            }))}
        />
        <Button
          size="middle"
          disabled={showGroupComparison}
          onClick={() => {
            const generalists = metadata.grasslandSpecies
              .filter(s => s.type === "widespread" && speciesTrends[s.scientificName])
              .map(s => s.scientificName)
              .sort();
            setSelectedSpecies(generalists);
          }}
        >
          Generalistas
        </Button>
        <Button
          size="middle"
          disabled={showGroupComparison}
          onClick={() => {
            const specialists = metadata.grasslandSpecies
              .filter(s => s.type === "specialist" && speciesTrends[s.scientificName])
              .map(s => s.scientificName)
              .sort();
            setSelectedSpecies(specialists);
          }}
        >
          Especialistas
        </Button>
        <Button
          size="middle"
          disabled={showGroupComparison}
          onClick={() => setSelectedSpecies(Object.keys(speciesTrends).sort())}
        >
          Todas
        </Button>
      </div>

      <div style={{ height: "400px", marginBottom: "16px" }}>
        <Line options={chartOptions} data={chartData} />
      </div>
    </Card>
  );
}

export default GrasslandButterflyIndex;
