import { Line } from "react-chartjs-2";
import { Collapse, Row, Col } from "antd";
import type { RegionalGBICollection } from "../../types/gbiData";
import { BASELINE_YEAR, getTrendColor, getTrendLabel } from "../../constants";

interface RegionalGBITrendsProps {
  regionalGBIData: RegionalGBICollection | null;
}

export function RegionalGBITrends({ regionalGBIData }: RegionalGBITrendsProps) {
  if (!regionalGBIData || Object.keys(regionalGBIData.regions).length === 0) {
    return null;
  }

  const regions = Object.values(regionalGBIData.regions).sort((a, b) =>
    a.region.localeCompare(b.region)
  );

  // Calculate global min/max for consistent y-axis across all charts
  let globalMin = Infinity;
  let globalMax = -Infinity;

  regions.forEach(region => {
    region.years.forEach(year => {
      const yearData = region.gbiByYear[year];
      if (yearData) {
        // Include GBI values
        if (yearData.gbiValue != null) {
          globalMin = Math.min(globalMin, yearData.gbiValue);
          globalMax = Math.max(globalMax, yearData.gbiValue);
        }
        // Include smoothed values
        if (yearData.smoothedValue != null) {
          globalMin = Math.min(globalMin, yearData.smoothedValue);
          globalMax = Math.max(globalMax, yearData.smoothedValue);
        }
        // Include CI bounds
        if (yearData.ci_lower != null) {
          globalMin = Math.min(globalMin, yearData.ci_lower);
        }
        if (yearData.ci_upper != null) {
          globalMax = Math.max(globalMax, yearData.ci_upper);
        }
      }
    });
  });

  // Add padding to the range (10%)
  const range = globalMax - globalMin;
  const padding = range * 0.1;
  const yMin = Math.floor(globalMin - padding);
  const yMax = Math.ceil(globalMax + padding);

  // Base chart options factory
  const getChartOptions = (isFirstChart: boolean, regionInfo: { name: string; transectCount: number; trend: string; trendColor: string }) => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: isFirstChart ? 0 : 10, // Add padding to align with first chart's y-axis labels
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const datasetLabel = context.dataset.label || "";
            const year = context.parsed.x;
            const indexValue = context.parsed.y;

            if (datasetLabel === "CI Upper") return undefined;

            if (datasetLabel === "IC 95%") {
              const yearData = context.chart.data.yearData?.[year];
              if (yearData?.ci_lower != null && yearData?.ci_upper != null) {
                return `IC 95%: ${yearData.ci_lower.toFixed(1)} - ${yearData.ci_upper.toFixed(1)}`;
              }
              return undefined;
            }

            if (datasetLabel.includes("GBI")) {
              const yearData = context.chart.data.yearData?.[year];
              const lines = [`${datasetLabel}: ${indexValue.toFixed(2)}`];
              if (yearData?.ci_lower != null && yearData?.ci_upper != null) {
                lines.push(
                  `IC 95%: [${yearData.ci_lower.toFixed(1)}, ${yearData.ci_upper.toFixed(1)}]`
                );
              }
              if (yearData?.transectCount) {
                lines.push(`Transectos: ${yearData.transectCount}`);
              }
              if (yearData?.totalVisits) {
                lines.push(`Visitas: ${yearData.totalVisits}`);
              }
              return lines;
            }

            return `${datasetLabel}: ${indexValue.toFixed(2)}`;
          },
        },
        filter: (item: any) => item.dataset.label !== "CI Upper",
      },
    },
    scales: {
      y: {
        min: yMin,
        max: yMax,
        title: {
          display: isFirstChart,
          text: "Índice (Base = 100)",
        },
        ticks: {
          display: isFirstChart,
        },
      },
      x: {
        title: {
          display: true,
          text: `${regionInfo.name} (${regionInfo.transectCount} transecto${regionInfo.transectCount !== 1 ? "s" : ""}) - ${regionInfo.trend}`,
          color: regionInfo.trendColor,
          font: {
            size: 12,
            weight: "bold" as const,
          },
        },
      },
    },
  });

  const items = [
    {
      key: "1",
      label: "Tendências Regionais",
      children: (
        <Row gutter={[16, 16]}>
          {regions.map((region, idx) => {
            const years = region.years;
            const gbiValues = years.map(year => region.gbiByYear[year]?.gbiValue);

            // Prepare CI data
            const ciLowerData = years.map(year => region.gbiByYear[year]?.ci_lower);
            const ciUpperData = years.map(year => region.gbiByYear[year]?.ci_upper);

            // Prepare smoothed values (trend line)
            const smoothedValues = years.map(year => region.gbiByYear[year]?.smoothedValue);

            const datasets = [];

            // CI Upper bound (hidden)
            datasets.push({
              label: "CI Upper",
              data: ciUpperData,
              borderColor: "transparent",
              backgroundColor: "transparent",
              borderWidth: 0,
              pointRadius: 0,
              fill: false,
              order: 4,
            });

            // CI Lower bound with fill
            datasets.push({
              label: "IC 95%",
              data: ciLowerData,
              borderColor: "rgb(208,224,230)",
              backgroundColor: "rgba(208,224,230, 0.45)",
              borderWidth: 1,
              pointRadius: 0,
              fill: "-1",
              order: 4,
            });

            // Trend line (smoothed)
            datasets.push({
              label: "Linha de Tendência",
              data: smoothedValues,
              borderColor: "rgb(44,103,135)",
              backgroundColor: "rgb(44,103,135)",
              borderWidth: 4,
              pointRadius: 0,
              pointHoverRadius: 0,
              tension: 0.4,
              fill: false,
              order: 2,
            });

            // Main data points (solid circles without connecting line)
            datasets.push({
              label: `GBI Regional (${BASELINE_YEAR} = 100)`,
              data: gbiValues,
              borderColor: "rgb(44,103,135)",
              backgroundColor: "rgb(44,103,135)",
              borderWidth: 0,
              pointRadius: 5,
              pointHoverRadius: 7,
              showLine: false,
              fill: false,
              order: 1,
            });

            const chartData = {
              labels: years.map(String),
              datasets,
              yearData: region.gbiByYear,
            };

            const trendCategory = region.gbiTrend?.category;
            const trendColor = trendCategory ? getTrendColor(trendCategory) : "#8c8c8c";
            const trendText = region.gbiTrend
              ? `${getTrendLabel(region.gbiTrend.category)}: ${region.gbiTrend.pc1 > 0 ? "+" : ""}${region.gbiTrend.pc1.toFixed(1)}%/ano`
              : "Sem tendência";

            const regionInfo = {
              name: region.region,
              transectCount: region.transectCount,
              trend: trendText,
              trendColor: trendColor,
            };

            return (
              <Col span={8} key={region.region}>
                <div style={{ height: "350px" }}>
                  <Line data={chartData} options={getChartOptions(idx === 0, regionInfo)} />
                </div>
              </Col>
            );
          })}
        </Row>
      ),
    },
  ];

  return <Collapse items={items} style={{ marginTop: 24 }} />;
}
