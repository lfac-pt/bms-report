import { Line } from "react-chartjs-2";
import { Alert } from "antd";
import { SERIES_COLORS } from "../../utils/utils";

interface SpeciesTrendChartProps {
  speciesData: {
    collatedIndices: Record<number, number>;
    trendLine?: Record<number, number>;
    confidenceIntervals?: Record<
      number,
      { ci_lower: number | null; ci_upper: number | null }
    >;
  };
}

export function SpeciesTrendChart({ speciesData }: SpeciesTrendChartProps) {
  if (!speciesData || !speciesData.collatedIndices) {
    return (
      <Alert
        message="Dados de tendência não disponíveis"
        description="Esta espécie não tem dados suficientes para calcular tendências populacionais."
        type="info"
        showIcon
      />
    );
  }

  const years = Object.keys(speciesData.collatedIndices).map(Number).sort();
  const indices = years.map(year => speciesData.collatedIndices[year]);

  // Get trend line from rBMS calculation (if available)
  const trendLineValues = speciesData.trendLine
    ? years.map(year => speciesData.trendLine![year])
    : [];

  // Get CI data from flight curves data
  const hasCI = speciesData.confidenceIntervals != null;
  const ciLower = hasCI
    ? years.map(
        year =>
          speciesData.confidenceIntervals![year]?.ci_lower ??
          indices[years.indexOf(year)]
      )
    : [];
  const ciUpper = hasCI
    ? years.map(
        year =>
          speciesData.confidenceIntervals![year]?.ci_upper ??
          indices[years.indexOf(year)]
      )
    : [];

  const datasets = [];

  // Add CI band if available
  if (hasCI) {
    // CI Upper bound (hidden)
    datasets.push({
      label: "CI Upper",
      data: ciUpper,
      borderColor: "transparent",
      backgroundColor: "transparent",
      borderWidth: 0,
      pointRadius: 0,
      fill: false,
      order: 3,
    });

    // CI Lower bound with fill
    datasets.push({
      label: "IC 95%",
      data: ciLower,
      borderColor: `${SERIES_COLORS[0]}33`,
      backgroundColor: `${SERIES_COLORS[0]}22`,
      borderWidth: 1,
      pointRadius: 0,
      fill: "-1",
      order: 3,
    });
  }

  // Trend line (linear regression from rBMS)
  if (trendLineValues.length > 0) {
    datasets.push({
      label: "Linha de Tendência",
      data: trendLineValues,
      borderColor: SERIES_COLORS[0],
      backgroundColor: SERIES_COLORS[0],
      borderWidth: 6,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.4,
      fill: false,
      order: 2,
    });
  }

  // Main data points (line without curves)
  datasets.push({
    label: "Índice Populacional (2021 = 100)",
    data: indices,
    borderColor: `${SERIES_COLORS[0]}99`,
    backgroundColor: "transparent",
    borderDash: [5, 5],
    borderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    tension: 0,
    fill: false,
    order: 1,
  });

  const chartData = {
    labels: years.map(String),
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          filter: (legendItem: any) => legendItem.text !== "CI Upper",
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const datasetLabel = context.dataset.label || "";
            const year = years[context.dataIndex];

            // Skip CI Upper
            if (datasetLabel === "CI Upper") return undefined;

            // For trend line, show value
            if (datasetLabel === "Linha de Tendência") {
              return `Tendência: ${context.parsed.y.toFixed(2)}`;
            }

            // For CI band, show range
            if (datasetLabel === "IC 95%" && hasCI) {
              const ci = speciesData.confidenceIntervals![year];
              if (ci?.ci_lower != null && ci?.ci_upper != null) {
                return `IC 95%: ${ci.ci_lower.toFixed(1)} - ${ci.ci_upper.toFixed(1)}`;
              }
            }

            // For main line, show index with CI if available
            if (datasetLabel === "Índice Populacional (2021 = 100)") {
              const lines = [`Índice: ${context.parsed.y.toFixed(2)}`];
              if (hasCI) {
                const ci = speciesData.confidenceIntervals![year];
                if (ci?.ci_lower != null && ci?.ci_upper != null) {
                  lines.push(
                    `IC 95%: [${ci.ci_lower.toFixed(1)}, ${ci.ci_upper.toFixed(1)}]`
                  );
                }
              }
              return lines;
            }

            return `${datasetLabel}: ${context.parsed.y.toFixed(2)}`;
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
          text: "Índice Populacional",
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

  return (
    <div style={{ height: "400px" }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
