import { Line } from "react-chartjs-2";
import { Card, Alert, Row, Col, Statistic, Space, Tooltip, Typography, Switch } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { GBIData } from "../../types/gbiData";
import { useState } from "react";
import { BASELINE_YEAR } from "../../constants";

interface GrasslandButterflyIndexProps {
  gbiData: GBIData | null;
  loading: boolean;
}

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

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "top" as const,
      labels: {
        filter: (legendItem: any) => {
          // Hide CI Upper datasets from legend (technical datasets)
          return (
            legendItem.text !== "CI Upper" &&
            legendItem.text !== "Generalistas CI Upper" &&
            legendItem.text !== "Especialistas CI Upper"
          );
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

          // Skip CI Upper datasets in tooltip (technical datasets)
          if (
            datasetLabel === "CI Upper" ||
            datasetLabel === "Generalistas CI Upper" ||
            datasetLabel === "Especialistas CI Upper"
          )
            return undefined;

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
      filter: (item: any) =>
        item.dataset.label !== "CI Upper" &&
        item.dataset.label !== "Generalistas CI Upper" &&
        item.dataset.label !== "Especialistas CI Upper",
    },
  },
  scales: {
    y: {
      beginAtZero: false,
      title: {
        display: true,
        text: `Índice (${BASELINE_YEAR} = 100)`,
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

  const { metadata, gbiByYear, years } = gbiData;

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

  // Create datasets based on mode
  let datasets;

  if (showGroupComparison) {
    // Group comparison mode: show overall, widespread MSI, and specialist MSI
    // Use the properly calculated MSI values from R script instead of manual geometric means
    const widespreadIndices = gbiData.widespreadMSI
      ? years.map(year => gbiData.widespreadMSI!.gbiByYear[year]?.smoothedValue ?? 100)
      : [];

    const specialistIndices = gbiData.specialistMSI
      ? years.map(year => gbiData.specialistMSI!.gbiByYear[year]?.smoothedValue ?? 100)
      : [];

    // Extract CI data for widespread MSI
    const widespreadCILower = gbiData.widespreadMSI
      ? years.map(
          year =>
            gbiData.widespreadMSI!.gbiByYear[year]?.ci_lower ??
            gbiData.widespreadMSI!.gbiByYear[year]?.smoothedValue ??
            100
        )
      : [];
    const widespreadCIUpper = gbiData.widespreadMSI
      ? years.map(
          year =>
            gbiData.widespreadMSI!.gbiByYear[year]?.ci_upper ??
            gbiData.widespreadMSI!.gbiByYear[year]?.smoothedValue ??
            100
        )
      : [];

    // Extract CI data for specialist MSI
    const specialistCILower = gbiData.specialistMSI
      ? years.map(
          year =>
            gbiData.specialistMSI!.gbiByYear[year]?.ci_lower ??
            gbiData.specialistMSI!.gbiByYear[year]?.smoothedValue ??
            100
        )
      : [];
    const specialistCIUpper = gbiData.specialistMSI
      ? years.map(
          year =>
            gbiData.specialistMSI!.gbiByYear[year]?.ci_upper ??
            gbiData.specialistMSI!.gbiByYear[year]?.smoothedValue ??
            100
        )
      : [];

    const baseDatasets = [];

    // Don't show overall GBI CI bands in group comparison mode

    // Check if widespread MSI has CI data
    const hasWidespreadCI =
      gbiData.widespreadMSI &&
      years.some(
        year =>
          gbiData.widespreadMSI!.gbiByYear[year]?.ci_lower !== null &&
          gbiData.widespreadMSI!.gbiByYear[year]?.ci_lower !== undefined
      );

    // Add CI bands for Widespread MSI if available
    if (hasWidespreadCI) {
      // Widespread CI Upper (hidden)
      baseDatasets.push({
        label: "Generalistas CI Upper",
        data: widespreadCIUpper,
        borderColor: "transparent",
        backgroundColor: "transparent",
        borderWidth: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        order: 4,
      });

      // Widespread CI Lower (filled)
      baseDatasets.push({
        label: "IC 95% Generalistas",
        data: widespreadCILower,
        borderColor: "rgba(82, 196, 26, 0.3)",
        backgroundColor: "rgba(82, 196, 26, 0.15)",
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: "-1",
        order: 4,
      });
    }

    // Check if specialist MSI has CI data
    const hasSpecialistCI =
      gbiData.specialistMSI &&
      years.some(
        year =>
          gbiData.specialistMSI!.gbiByYear[year]?.ci_lower !== null &&
          gbiData.specialistMSI!.gbiByYear[year]?.ci_lower !== undefined
      );

    // Add CI bands for Specialist MSI if available
    if (hasSpecialistCI) {
      // Specialist CI Upper (hidden)
      baseDatasets.push({
        label: "Especialistas CI Upper",
        data: specialistCIUpper,
        borderColor: "transparent",
        backgroundColor: "transparent",
        borderWidth: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        order: 4,
      });

      // Specialist CI Lower (filled)
      baseDatasets.push({
        label: "IC 95% Especialistas",
        data: specialistCILower,
        borderColor: "rgba(114, 46, 209, 0.3)",
        backgroundColor: "rgba(114, 46, 209, 0.15)",
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: "-1",
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
        data: widespreadIndices,
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
        label: `Baseline ${BASELINE_YEAR}`,
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
    // When group comparison is off, show only overall GBI
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

    // Add baseline reference line at 100
    baseDatasets.push({
      label: `Baseline ${BASELINE_YEAR}`,
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
  const speciesCount = metadata.grasslandSpecies.length;
  const transectCount = metadata.transectsUsed.length;

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
        <Col xs={24} sm={12}>
          {gbiData.gbiTrend ? (
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
                    fontSize: 16,
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
        <Col xs={24} sm={12}>
          <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Space>
              <Switch checked={showGroupComparison} onChange={setShowGroupComparison} />
              <Typography.Text style={{ whiteSpace: "nowrap" }}>
                Generalistas vs. especialistas
              </Typography.Text>
            </Space>
          </div>
        </Col>
      </Row>

      <div style={{ height: "400px", marginBottom: "16px" }}>
        <Line options={chartOptions} data={chartData} />
      </div>
    </Card>
  );
}

export default GrasslandButterflyIndex;
