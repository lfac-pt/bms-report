import { Line, Bar } from "react-chartjs-2";
import { Card, Alert, Collapse, Row, Col, Divider, Typography } from "antd";
import { GBIData, RegionalGBICollection } from "../../types/gbiData";
import { BASELINE_YEAR, getTrendColor, TREND_COLORS, TREND_LABELS } from "../../constants";
import { RegionalGBITrends } from "./RegionalGBITrends";

const { Panel } = Collapse;
const { Text } = Typography;

interface FlightCurvesData {
  species: Record<
    string,
    {
      collatedIndices: Record<number, number>;
      confidenceIntervals?: Record<
        number,
        {
          ci_lower: number | null;
          ci_upper: number | null;
        }
      >;
      trendClassification?: {
        category: string;
        annualRateOfChange?: number | null;
        confidenceInterval?: {
          lower: number | null;
          upper: number | null;
        };
        confidenceInterval80?: {
          lower: number | null;
          upper: number | null;
        };
      };
    }
  >;
}

interface GrasslandButterflyIndexProps {
  gbiData: GBIData | null;
  flightCurvesData: FlightCurvesData | null;
  regionalGBIData: RegionalGBICollection | null;
  loading: boolean;
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "bottom" as const,
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

function GrasslandButterflyIndex({
  gbiData,
  flightCurvesData,
  regionalGBIData,
  loading,
}: GrasslandButterflyIndexProps) {
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

  const { gbiByYear, years } = gbiData;

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

  // Create datasets for main GBI chart
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
      borderColor: "rgb(208,224,230)",
      backgroundColor: "rgba(208,224,230, 0.45)",
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
    borderColor: "rgb(44,103,135)",
    backgroundColor: "rgb(44,103,135)",
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
    borderColor: "rgb(44,103,135)",
    backgroundColor: "rgb(44,103,135)",
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

  const chartData = {
    labels,
    datasets: baseDatasets,
    yearData, // Attach year data for tooltip
  };

  // Prepare data for group comparison charts
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

  // Calculate max value across all charts for shared y-axis scale
  const allValues = [
    ...gbiValues,
    ...widespreadIndices,
    ...specialistIndices,
    ...widespreadCIUpper,
    ...widespreadCILower,
    ...specialistCIUpper,
    ...specialistCILower,
  ];
  const maxValue = Math.max(...allValues);
  const minValue = Math.min(...allValues);
  const yAxisMax = Math.ceil(maxValue * 1.1);
  const yAxisMin = Math.floor(minValue * 0.9);

  // Check if widespread MSI has CI data
  const hasWidespreadCI =
    gbiData.widespreadMSI &&
    years.some(
      year =>
        gbiData.widespreadMSI!.gbiByYear[year]?.ci_lower !== null &&
        gbiData.widespreadMSI!.gbiByYear[year]?.ci_lower !== undefined
    );

  // Check if specialist MSI has CI data
  const hasSpecialistCI =
    gbiData.specialistMSI &&
    years.some(
      year =>
        gbiData.specialistMSI!.gbiByYear[year]?.ci_lower !== null &&
        gbiData.specialistMSI!.gbiByYear[year]?.ci_lower !== undefined
    );

  // Create chart data for Widespread MSI
  const widespreadDatasets = [];
  if (hasWidespreadCI) {
    // CI Upper (hidden)
    widespreadDatasets.push({
      label: "CI Upper",
      data: widespreadCIUpper,
      borderColor: "transparent",
      backgroundColor: "transparent",
      borderWidth: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
    });
    // CI Lower (filled)
    widespreadDatasets.push({
      label: "IC 95%",
      data: widespreadCILower,
      borderColor: "rgba(82, 196, 26, 0.3)",
      backgroundColor: "rgba(82, 196, 26, 0.15)",
      borderWidth: 1,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: "-1",
    });
  }
  widespreadDatasets.push(
    {
      label: "Generalistas",
      data: widespreadIndices,
      borderColor: "#52c41a",
      backgroundColor: "#52c41a",
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.2,
    },
    {
      label: `Baseline ${BASELINE_YEAR}`,
      data: Array(years.length).fill(100),
      borderColor: "#d9d9d9",
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 0,
    }
  );

  const widespreadChartData = {
    labels,
    datasets: widespreadDatasets,
  };

  // Create chart data for Specialist MSI
  const specialistDatasets = [];
  if (hasSpecialistCI) {
    // CI Upper (hidden)
    specialistDatasets.push({
      label: "CI Upper",
      data: specialistCIUpper,
      borderColor: "transparent",
      backgroundColor: "transparent",
      borderWidth: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
    });
    // CI Lower (filled)
    specialistDatasets.push({
      label: "IC 95%",
      data: specialistCILower,
      borderColor: "rgba(114, 46, 209, 0.3)",
      backgroundColor: "rgba(114, 46, 209, 0.15)",
      borderWidth: 1,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: "-1",
    });
  }
  specialistDatasets.push(
    {
      label: "Especialistas",
      data: specialistIndices,
      borderColor: "#722ed1",
      backgroundColor: "#722ed1",
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.2,
    },
    {
      label: `Baseline ${BASELINE_YEAR}`,
      data: Array(years.length).fill(100),
      borderColor: "#d9d9d9",
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 0,
    }
  );

  const specialistChartData = {
    labels,
    datasets: specialistDatasets,
  };

  // Chart options with shared y-axis scale
  const groupChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        min: yAxisMin,
        max: yAxisMax,
      },
    },
  };

  return (
    <>
      <Card title="Índice de Borboletas de Prados (GBI)" size="small">
        <div style={{ height: "400px", marginBottom: "16px", paddingTop: "16px" }}>
          <Line options={chartOptions} data={chartData} />
        </div>
      </Card>

      <Card title="Tendências por Espécie" size="small" style={{ marginTop: 16 }}>
        {(() => {
          // Separate species by type
          const widespreadSpecies = gbiData.metadata.grasslandSpecies
            .filter(s => s.type === "widespread")
            .map(s => s.scientificName)
            .sort();
          const specialistSpecies = gbiData.metadata.grasslandSpecies
            .filter(s => s.type === "specialist")
            .map(s => s.scientificName)
            .sort();

          // Helper function to create species chart data
          const createSpeciesChartData = (speciesName: string) => {
            const speciesData = years.map(year => {
              return flightCurvesData?.species?.[speciesName]?.collatedIndices?.[year] ?? null;
            });

            // Extract CI data
            const ciLower = years.map(year => {
              return (
                flightCurvesData?.species?.[speciesName]?.confidenceIntervals?.[year]?.ci_lower ??
                null
              );
            });
            const ciUpper = years.map(year => {
              return (
                flightCurvesData?.species?.[speciesName]?.confidenceIntervals?.[year]?.ci_upper ??
                null
              );
            });

            // Get trend category and color
            const trendCategory =
              flightCurvesData?.species?.[speciesName]?.trendClassification?.category || "Stable";
            const trendColor = getTrendColor(trendCategory);

            // Check if this species has CI data
            const hasCI = ciLower.some(val => val !== null && val !== undefined);

            const datasets = [];

            // Add CI bands if available
            if (hasCI) {
              // CI Upper (hidden)
              datasets.push({
                label: "CI Upper",
                data: ciUpper,
                borderColor: "transparent",
                backgroundColor: "transparent",
                borderWidth: 0,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
              });
              // CI Lower (filled) - use trend color with transparency
              datasets.push({
                label: "IC 95%",
                data: ciLower,
                borderColor: trendColor + "4D", // 30% opacity
                backgroundColor: trendColor + "26", // 15% opacity
                borderWidth: 1,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: "-1",
                spanGaps: true,
              });
            }

            // Main species line - use trend color
            datasets.push({
              label: speciesName,
              data: speciesData,
              borderColor: trendColor,
              backgroundColor: trendColor,
              borderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 5,
              tension: 0.2,
              spanGaps: true,
            });

            // Baseline
            datasets.push({
              label: `Baseline ${BASELINE_YEAR}`,
              data: Array(years.length).fill(100),
              borderColor: "#d9d9d9",
              borderWidth: 1,
              borderDash: [3, 3],
              pointRadius: 0,
              pointHoverRadius: 0,
            });

            return {
              labels,
              datasets,
            };
          };

          // Helper function to create mini chart options with individual y-axis scale
          const createMiniChartOptions = (speciesName: string) => {
            // Get all values for this species to calculate scale
            const speciesValues = years
              .map(year => flightCurvesData?.species?.[speciesName]?.collatedIndices?.[year])
              .filter((v): v is number => v !== null && v !== undefined);

            const ciLowerValues = years
              .map(
                year =>
                  flightCurvesData?.species?.[speciesName]?.confidenceIntervals?.[year]?.ci_lower
              )
              .filter((v): v is number => v !== null && v !== undefined);

            const ciUpperValues = years
              .map(
                year =>
                  flightCurvesData?.species?.[speciesName]?.confidenceIntervals?.[year]?.ci_upper
              )
              .filter((v): v is number => v !== null && v !== undefined);

            const allValues = [...speciesValues, ...ciLowerValues, ...ciUpperValues, 100]; // Include baseline
            const minVal = Math.min(...allValues);
            const maxVal = Math.max(...allValues);
            const speciesYAxisMin = Math.floor(minVal * 0.9);
            const speciesYAxisMax = Math.ceil(maxVal * 1.1);

            return {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  callbacks: {
                    title: (context: any) => `${context[0].label}`,
                    label: (context: any) => {
                      const datasetLabel = context.dataset.label || "";

                      // Skip CI Upper and Baseline in tooltips
                      if (
                        datasetLabel === "CI Upper" ||
                        datasetLabel === `Baseline ${BASELINE_YEAR}`
                      ) {
                        return undefined;
                      }

                      // For CI band, show range
                      if (datasetLabel === "IC 95%") {
                        const yearIdx = context.dataIndex;
                        const datasets = context.chart.data.datasets;
                        const ciUpperDataset = datasets.find((d: any) => d.label === "CI Upper");
                        if (ciUpperDataset) {
                          const lower = context.parsed.y;
                          const upper = ciUpperDataset.data[yearIdx];
                          if (lower != null && upper != null) {
                            return `IC 95%: ${lower.toFixed(1)} - ${upper.toFixed(1)}`;
                          }
                        }
                        return undefined;
                      }

                      return `Índice: ${context.parsed.y?.toFixed(1) ?? "N/A"}`;
                    },
                  },
                  filter: (item: any) =>
                    item.dataset.label !== `Baseline ${BASELINE_YEAR}` &&
                    item.dataset.label !== "CI Upper",
                },
              },
              scales: {
                y: {
                  beginAtZero: false,
                  min: speciesYAxisMin,
                  max: speciesYAxisMax,
                  ticks: {
                    font: {
                      size: 10,
                    },
                  },
                },
                x: {
                  ticks: {
                    font: {
                      size: 10,
                    },
                  },
                },
              },
            };
          };

          return (
            <>
              <Text strong style={{ display: "block", marginBottom: 16, color: "#52c41a" }}>
                Generalistas
              </Text>
              <Row gutter={[16, 16]}>
                {widespreadSpecies.map(species => (
                  <Col span={8} key={species}>
                    <Card size="small" title={<span style={{ fontSize: 12 }}>{species}</span>}>
                      <div style={{ height: "200px" }}>
                        <Line
                          options={createMiniChartOptions(species)}
                          data={createSpeciesChartData(species)}
                        />
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>

              <Divider />

              <Text strong style={{ display: "block", marginBottom: 16, color: "#722ed1" }}>
                Especialistas
              </Text>
              <Row gutter={[16, 16]}>
                {specialistSpecies.map(species => (
                  <Col span={8} key={species}>
                    <Card size="small" title={<span style={{ fontSize: 12 }}>{species}</span>}>
                      <div style={{ height: "200px" }}>
                        <Line
                          options={createMiniChartOptions(species)}
                          data={createSpeciesChartData(species)}
                        />
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>

              <Divider />

              <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
                {Object.entries(TREND_COLORS).map(([category, color]) => (
                  <div key={category} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{ width: 16, height: 16, backgroundColor: color, borderRadius: 2 }}
                    />
                    <Text style={{ fontSize: 12 }}>{TREND_LABELS[category]}</Text>
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </Card>

      {/* Species Annual Change Chart */}
      <Card title="Taxa Anual de Alteração por Espécie" size="small" style={{ marginTop: 16 }}>
        {(() => {
          // Gather species data with trend classification
          const speciesWithTrends: Array<{
            species: string;
            type: "widespread" | "specialist";
            annualChange: number | null;
            ciLower: number | null;
            ciUpper: number | null;
            ci80Lower: number | null;
            ci80Upper: number | null;
            yearsWithData: number[];
            trendCategory: string;
          }> = [];

          // Collect data from grassland species
          gbiData.metadata.grasslandSpecies.forEach(speciesInfo => {
            const speciesName = speciesInfo.scientificName;
            const trendClassification =
              flightCurvesData?.species?.[speciesName]?.trendClassification;

            // Get years with data for this species
            const yearsWithData: number[] = [];
            years.forEach(year => {
              const index = flightCurvesData?.species?.[speciesName]?.collatedIndices?.[year];
              if (index !== null && index !== undefined) {
                yearsWithData.push(year);
              }
            });

            if (
              trendClassification?.annualRateOfChange !== null &&
              trendClassification?.annualRateOfChange !== undefined
            ) {
              speciesWithTrends.push({
                species: speciesName,
                type: speciesInfo.type,
                annualChange: trendClassification.annualRateOfChange,
                ciLower: trendClassification.confidenceInterval?.lower ?? null,
                ciUpper: trendClassification.confidenceInterval?.upper ?? null,
                ci80Lower: trendClassification.confidenceInterval80?.lower ?? null,
                ci80Upper: trendClassification.confidenceInterval80?.upper ?? null,
                yearsWithData,
                trendCategory: trendClassification.category || "Stable",
              });
            }
          });

          // Sort by annual change (most declining first, most increasing last)
          speciesWithTrends.sort((a, b) => (a.annualChange ?? 0) - (b.annualChange ?? 0));

          if (speciesWithTrends.length === 0) {
            return (
              <Alert
                message="Dados insuficientes"
                description="Nao ha dados de tendencia suficientes para gerar este grafico."
                type="warning"
                showIcon
              />
            );
          }

          // Prepare data for horizontal bar chart
          const speciesLabels = speciesWithTrends.map(s => s.species);
          const annualChangeValues = speciesWithTrends.map(s => s.annualChange ?? 0);
          const trendCategories = speciesWithTrends.map(s => s.trendCategory);

          // Calculate error bar data for 95% CI (distance from value to CI bounds)
          const errorBarsLower = speciesWithTrends.map(s => {
            if (s.ciLower !== null && s.annualChange !== null) {
              return s.annualChange - s.ciLower;
            }
            return 0;
          });
          const errorBarsUpper = speciesWithTrends.map(s => {
            if (s.ciUpper !== null && s.annualChange !== null) {
              return s.ciUpper - s.annualChange;
            }
            return 0;
          });

          // Calculate error bar data for 80% CI (distance from value to CI bounds)
          const errorBars80Lower = speciesWithTrends.map(s => {
            if (s.ci80Lower !== null && s.annualChange !== null) {
              return s.annualChange - s.ci80Lower;
            }
            return 0;
          });
          const errorBars80Upper = speciesWithTrends.map(s => {
            if (s.ci80Upper !== null && s.annualChange !== null) {
              return s.ci80Upper - s.annualChange;
            }
            return 0;
          });

          // Calculate x-axis range to accommodate all CI bars
          const allValues: number[] = [];
          speciesWithTrends.forEach(s => {
            if (s.ciLower !== null) allValues.push(s.ciLower);
            if (s.ciUpper !== null) allValues.push(s.ciUpper);
            if (s.annualChange !== null) allValues.push(s.annualChange);
          });

          // Find the range and cap at ±110
          const minValue = Math.max(Math.min(...allValues, 0), -110);
          const maxValue = Math.min(Math.max(...allValues, 0), 110);
          const xAxisMin = Math.floor(minValue - 2);
          const xAxisMax = Math.ceil(maxValue + 2);

          // Calculate time periods for each species
          const timePeriods = speciesWithTrends.map(s => {
            if (s.yearsWithData.length > 0) {
              const minYear = Math.min(...s.yearsWithData);
              const maxYear = Math.max(...s.yearsWithData);
              return `${minYear}-${maxYear}`;
            }
            return "";
          });

          // Custom plugin to draw error bars and point estimates
          const errorBarPlugin = {
            id: "errorBarPlugin",
            beforeDatasetsDraw: (chart: any) => {
              // Draw dashed zero line
              const ctx = chart.ctx;
              const chartArea = chart.chartArea;
              const xScale = chart.scales.x;
              const zeroX = xScale.getPixelForValue(0);

              ctx.save();
              ctx.setLineDash([8, 4]);
              ctx.strokeStyle = "#595959";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(zeroX, chartArea.top);
              ctx.lineTo(zeroX, chartArea.bottom);
              ctx.stroke();
              ctx.restore();
            },
            afterDatasetsDraw: (chart: any) => {
              const ctx = chart.ctx;
              const meta = chart.getDatasetMeta(0);
              const chartArea = chart.chartArea;

              // Set up clipping to chart area
              ctx.save();
              ctx.beginPath();
              ctx.rect(
                chartArea.left,
                chartArea.top,
                chartArea.right - chartArea.left,
                chartArea.bottom - chartArea.top
              );
              ctx.clip();

              meta.data.forEach((bar: any, index: number) => {
                const y = bar.y;
                const value = annualChangeValues[index];
                const errorLower = errorBarsLower[index];
                const errorUpper = errorBarsUpper[index];
                const error80Lower = errorBars80Lower[index];
                const error80Upper = errorBars80Upper[index];

                // Calculate error bar positions
                const xScale = chart.scales.x;

                // 95% CI positions
                const xLower = xScale.getPixelForValue(value - errorLower);
                const xUpper = xScale.getPixelForValue(value + errorUpper);

                // 80% CI positions
                const x80Lower = xScale.getPixelForValue(value - error80Lower);
                const x80Upper = xScale.getPixelForValue(value + error80Upper);

                ctx.save();

                // Draw 95% CI error bar (thinner, lighter - outer bar)
                ctx.strokeStyle = "#8c8c8c";
                ctx.lineWidth = 1;

                // Horizontal line (95% CI error bar)
                ctx.beginPath();
                ctx.moveTo(xLower, y);
                ctx.lineTo(xUpper, y);
                ctx.stroke();

                // Left cap (95% CI)
                ctx.beginPath();
                ctx.moveTo(xLower, y - 3);
                ctx.lineTo(xLower, y + 3);
                ctx.stroke();

                // Right cap (95% CI)
                ctx.beginPath();
                ctx.moveTo(xUpper, y - 3);
                ctx.lineTo(xUpper, y + 3);
                ctx.stroke();

                // Draw 80% CI error bar (thicker, darker - inner bar)
                ctx.strokeStyle = "#333";
                ctx.lineWidth = 2;

                // Horizontal line (80% CI error bar)
                ctx.beginPath();
                ctx.moveTo(x80Lower, y);
                ctx.lineTo(x80Upper, y);
                ctx.stroke();

                // Left cap (80% CI)
                ctx.beginPath();
                ctx.moveTo(x80Lower, y - 5);
                ctx.lineTo(x80Lower, y + 5);
                ctx.stroke();

                // Right cap (80% CI)
                ctx.beginPath();
                ctx.moveTo(x80Upper, y - 5);
                ctx.lineTo(x80Upper, y + 5);
                ctx.stroke();

                // Draw point estimate (orange diamond)
                const xPoint = xScale.getPixelForValue(value);
                const diamondSize = 6;
                ctx.beginPath();
                ctx.moveTo(xPoint, y - diamondSize); // Top
                ctx.lineTo(xPoint + diamondSize, y); // Right
                ctx.lineTo(xPoint, y + diamondSize); // Bottom
                ctx.lineTo(xPoint - diamondSize, y); // Left
                ctx.closePath();
                ctx.fillStyle = "#d46b08";
                ctx.fill();
                ctx.strokeStyle = "#ad4e00";
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.restore();
              });

              // Restore clipping
              ctx.restore();

              // Draw time periods outside clipping region
              meta.data.forEach((bar: any, index: number) => {
                const y = bar.y;
                const timePeriod = timePeriods[index];
                if (timePeriod) {
                  ctx.font = "11px sans-serif";
                  ctx.fillStyle = "#595959";
                  ctx.textAlign = "left";
                  ctx.textBaseline = "middle";
                  ctx.fillText(timePeriod, chartArea.right + 10, y);
                }
              });
            },
          };

          // Chart data
          const chartData = {
            labels: speciesLabels,
            datasets: [
              {
                label: "Taxa de Alteracao Anual (%)",
                data: annualChangeValues,
                backgroundColor: "transparent",
                borderColor: "transparent",
                borderWidth: 0,
                barThickness: 18,
              },
            ],
          };

          // Chart options
          const horizontalBarOptions = {
            indexAxis: "y" as const,
            responsive: true,
            maintainAspectRatio: false,
            layout: {
              padding: {
                left: 20,
                right: 80,
              },
            },
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const idx = context.dataIndex;
                    const species = speciesWithTrends[idx];
                    const lines = [`Taxa: ${species.annualChange?.toFixed(1)}%/ano`];
                    if (species.ci80Lower !== null && species.ci80Upper !== null) {
                      lines.push(
                        `IC 80%: [${species.ci80Lower.toFixed(1)}%, ${species.ci80Upper.toFixed(1)}%]`
                      );
                    }
                    if (species.ciLower !== null && species.ciUpper !== null) {
                      lines.push(
                        `IC 95%: [${species.ciLower.toFixed(1)}%, ${species.ciUpper.toFixed(1)}%]`
                      );
                    }
                    if (species.yearsWithData.length > 0) {
                      lines.push(
                        `Periodo: ${Math.min(...species.yearsWithData)}-${Math.max(...species.yearsWithData)}`
                      );
                    }
                    return lines;
                  },
                  title: (items: any) => items[0]?.label || "",
                },
              },
            },
            scales: {
              x: {
                min: xAxisMin,
                max: xAxisMax,
                title: {
                  display: true,
                  text: "Taxa de Alteracao Anual (%)",
                  font: {
                    size: 12,
                  },
                },
                grid: {
                  color: (context: any) => {
                    if (context.tick.value === 0) {
                      return "transparent"; // Hide the solid zero line
                    }
                    return "rgba(0, 0, 0, 0.1)";
                  },
                  lineWidth: (context: any) => {
                    if (context.tick.value === 0) {
                      return 0; // Don't draw the solid zero line
                    }
                    return 1;
                  },
                },
              },
              y: {
                title: {
                  display: false,
                },
                ticks: {
                  font: {
                    size: 11,
                    style: "italic" as const,
                  },
                  color: (context: any) => {
                    const index = context.index;
                    const category = trendCategories[index];
                    return getTrendColor(category);
                  },
                },
              },
            },
          };

          // Calculate chart height based on number of species
          const chartHeight = Math.max(400, speciesWithTrends.length * 35);

          return (
            <>
              <div style={{ height: `${chartHeight}px`, marginBottom: "16px", paddingTop: "8px" }}>
                <Bar options={horizontalBarOptions} data={chartData} plugins={[errorBarPlugin]} />
              </div>

              {/* Legend for CI levels */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 24,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      backgroundColor: "#d46b08",
                      border: "1px solid #ad4e00",
                      transform: "rotate(45deg)",
                    }}
                  />
                  <Text style={{ fontSize: 12 }}>Estimativa pontual</Text>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 24, height: 2, backgroundColor: "#333" }} />
                  <Text style={{ fontSize: 12 }}>IC 80%</Text>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 24, height: 1, backgroundColor: "#8c8c8c" }} />
                  <Text style={{ fontSize: 12 }}>IC 95%</Text>
                </div>
              </div>
            </>
          );
        })()}
      </Card>

      <Collapse style={{ marginTop: 16 }}>
        <Panel header="Generalistas vs. Especialistas" key="1">
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ height: "350px" }}>
                <Line options={groupChartOptions} data={widespreadChartData} />
              </div>
            </Col>
            <Col span={12}>
              <div style={{ height: "350px" }}>
                <Line options={groupChartOptions} data={specialistChartData} />
              </div>
            </Col>
          </Row>
        </Panel>
      </Collapse>

      <RegionalGBITrends regionalGBIData={regionalGBIData} />
    </>
  );
}

export default GrasslandButterflyIndex;
