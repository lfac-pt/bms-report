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

interface GrasslandButterflyIndexProps {
  gbiData: GBIData | null;
  loading: boolean;
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "top" as const,
    },
    tooltip: {
      callbacks: {
        label: function (context: any) {
          const datasetLabel = context.dataset.label || "";
          const year = context.parsed.x;
          const indexValue = context.parsed.y;
          const yearData = context.chart.data.yearData?.[year];

          // For the main GBI line, show detailed data quality info
          if (datasetLabel === "GBI (Todas as Espécies)" && yearData) {
            return [
              `${datasetLabel}: ${indexValue.toFixed(2)}`,
              `Transectos: ${yearData.transectCount}`,
              `Visitas: ${yearData.totalVisits}`,
              `Espécies: ${yearData.speciesWithData}`,
            ];
          }

          // For individual species and baseline, show name and value
          return `${datasetLabel}: ${indexValue.toFixed(2)}`;
        },
      },
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
  if (loading) {
    return (
      <Card title="Índice de Borboletas de Pastagens (GBI)" size="small" loading={true}>
        <div style={{ height: "300px" }} />
      </Card>
    );
  }

  if (!gbiData || !gbiData.years || gbiData.years.length === 0) {
    return (
      <Card title="Índice de Borboletas de Pastagens (GBI)" size="small">
        <Alert
          message="Dados insuficientes"
          description="Não há dados suficientes para calcular o Índice de Borboletas de Pastagens."
          type="warning"
          showIcon
        />
      </Card>
    );
  }

  const { metadata, gbiByYear, years, speciesTrends } = gbiData;

  // State for selected species
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [showGroupComparison, setShowGroupComparison] = useState(false);

  // Prepare chart data
  const labels = years.map(year => year.toString());
  const gbiValues = years.map(year => gbiByYear[year].gbiValue);
  const yearData = years.reduce(
    (acc, year) => {
      acc[year] = gbiByYear[year].dataQuality;
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

    datasets = [
      {
        label: "GBI (Todas as Espécies)",
        data: gbiValues,
        borderColor: "#1890ff",
        backgroundColor: "#1890ff",
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.2,
        fill: false,
      },
      {
        label: "Generalistas",
        data: generalistIndices,
        borderColor: "#52c41a",
        backgroundColor: "#52c41a",
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.2,
        fill: false,
      },
      {
        label: "Especialistas",
        data: specialistIndices,
        borderColor: "#722ed1",
        backgroundColor: "#722ed1",
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.2,
        fill: false,
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
      },
    ];
  } else {
    // Manual selection mode
    datasets = [
      {
        label: "GBI (Todas as Espécies)",
        data: gbiValues,
        borderColor: "#1890ff",
        backgroundColor: "#1890ff",
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.2,
        fill: false,
      },
      // Add individual species datasets
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
        };
      }),
      // Add baseline reference line at 100
      {
        label: "Baseline 2021",
        data: Array(years.length).fill(100),
        borderColor: "#d9d9d9",
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      },
    ];
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
          Índice de Borboletas de Pastagens (GBI)
          <Tooltip title={gbiCardTitleTooltip}>
            <InfoCircleOutlined style={{ color: "#1890ff" }} />
          </Tooltip>
        </Space>
      }
      size="small"
    >
      <Row gutter={[16, 16]} style={{ marginBottom: "16px" }}>
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="Índice Atual"
            value={latestGBI.toFixed(2)}
            suffix={`(${latestYear})`}
            valueStyle={{ color: trendPercent >= 0 ? "#3f8600" : "#cf1322" }}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="Tendência"
            value={Math.abs(trendPercent).toFixed(1)}
            prefix={trendPercent >= 0 ? "+" : "-"}
            suffix="%"
            valueStyle={{ color: trendPercent >= 0 ? "#3f8600" : "#cf1322" }}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
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
                    Generalistas (
                    {metadata.grasslandSpecies.filter(s => s.type === "widespread").length})
                  </Typography.Text>
                  <List
                    size="small"
                    dataSource={metadata.grasslandSpecies
                      .filter(s => s.type === "widespread")
                      .map(s => s.scientificName)
                      .sort()}
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
                    Especialistas (
                    {metadata.grasslandSpecies.filter(s => s.type === "specialist").length})
                  </Typography.Text>
                  <List
                    size="small"
                    dataSource={metadata.grasslandSpecies
                      .filter(s => s.type === "specialist")
                      .map(s => s.scientificName)
                      .sort()}
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
                suffix={`de ${metadata.grasslandSpecies.length}`}
              />
            </div>
          </Popover>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Popover
            content={
              <div style={{ maxWidth: 400, maxHeight: 400, overflowY: "auto" }}>
                <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
                  Transectos Qualificados ({transectCount})
                </Typography.Text>
                <Typography.Text
                  style={{ fontSize: 12, color: "#8c8c8c", display: "block", marginBottom: 8 }}
                >
                  Critérios: 5+ anos ativos, 10+ visitas/ano
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
