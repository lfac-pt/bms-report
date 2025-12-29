import { Line } from "react-chartjs-2";
import { Card, Alert, Collapse, Row, Col, Divider, Typography } from "antd";
import { GBIData } from "../../types/gbiData";
import { BASELINE_YEAR } from "../../constants";

const { Panel } = Collapse;
const { Text } = Typography;

interface FlightCurvesData {
  species: Record<string, {
    collatedIndices: Record<number, number>;
    confidenceIntervals?: Record<number, {
      ci_lower: number | null;
      ci_upper: number | null;
    }>;
  }>;
}

interface GrasslandButterflyIndexProps {
  gbiData: GBIData | null;
  flightCurvesData: FlightCurvesData | null;
  loading: boolean;
}

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

function GrasslandButterflyIndex({ gbiData, flightCurvesData, loading }: GrasslandButterflyIndexProps) {
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
        <div style={{ height: "400px", marginBottom: "16px" }}>
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
              return flightCurvesData?.species?.[speciesName]?.confidenceIntervals?.[year]?.ci_lower ?? null;
            });
            const ciUpper = years.map(year => {
              return flightCurvesData?.species?.[speciesName]?.confidenceIntervals?.[year]?.ci_upper ?? null;
            });

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
              // CI Lower (filled)
              datasets.push({
                label: "IC 95%",
                data: ciLower,
                borderColor: "rgba(24, 144, 255, 0.3)",
                backgroundColor: "rgba(24, 144, 255, 0.15)",
                borderWidth: 1,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: "-1",
                spanGaps: true,
              });
            }

            // Main species line
            datasets.push({
              label: speciesName,
              data: speciesData,
              borderColor: "#1890ff",
              backgroundColor: "#1890ff",
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
            const speciesValues = years.map(year =>
              flightCurvesData?.species?.[speciesName]?.collatedIndices?.[year]
            ).filter((v): v is number => v !== null && v !== undefined);

            const ciLowerValues = years.map(year =>
              flightCurvesData?.species?.[speciesName]?.confidenceIntervals?.[year]?.ci_lower
            ).filter((v): v is number => v !== null && v !== undefined);

            const ciUpperValues = years.map(year =>
              flightCurvesData?.species?.[speciesName]?.confidenceIntervals?.[year]?.ci_upper
            ).filter((v): v is number => v !== null && v !== undefined);

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
                      if (datasetLabel === "CI Upper" || datasetLabel === `Baseline ${BASELINE_YEAR}`) {
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

                      return `Índice: ${context.parsed.y?.toFixed(1) ?? 'N/A'}`;
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
    </>
  );
}

export default GrasslandButterflyIndex;
