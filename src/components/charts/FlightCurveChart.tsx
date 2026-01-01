import React from "react";
import { Line } from "react-chartjs-2";
import { Card, Alert, Empty } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import type { RegionalPhenology } from "../../types/phenologyData";

interface FlightCurveChartProps {
  region: string;
  regionalData: RegionalPhenology;
  yAxisMax?: number;
}

const YEAR_COLORS = {
  "2021": "rgb(59, 130, 246)", // Blue
  "2022": "rgb(16, 185, 129)", // Green
  "2023": "rgb(251, 146, 60)", // Orange
  "2024": "rgb(139, 92, 246)", // Purple
  "2025": "rgb(236, 72, 153)", // Pink
};

const FlightCurveChart: React.FC<FlightCurveChartProps> = ({ region, regionalData, yAxisMax }) => {
  const { phenologyCurves, dataQuality } = regionalData;

  if (!phenologyCurves || Object.keys(phenologyCurves).length === 0) {
    return (
      <Card title={`${region} - Curva de Voo`} style={{ marginBottom: 16 }}>
        <Empty description="Dados insuficientes para esta região" />
      </Card>
    );
  }

  // Get years in ascending order
  const years = Object.keys(phenologyCurves).sort();

  // Prepare datasets for Chart.js
  const datasets = years.map(year => {
    const yearData = phenologyCurves[year];
    const color = YEAR_COLORS[year as keyof typeof YEAR_COLORS] || "rgb(107, 114, 128)";

    return {
      label: year,
      data: yearData.weeks
        .map((week, idx) => ({
          x: week,
          y: yearData.abundance[idx],
        }))
        .filter(point => point.x !== 40), // Exclude week 40 (no data)
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.4, // Smooth curves
      fill: false,
    };
  });

  const chartData = {
    datasets,
  };

  // Calculate monitoring season week range (March-September)
  // Week 9 (early March) to Week 40 (late September)
  const MONITORING_START_WEEK = 9;
  const MONITORING_END_WEEK = 40;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          usePointStyle: true,
          padding: 15,
        },
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        callbacks: {
          title: (context: any) => {
            const week = context[0].parsed.x;
            // Approximate month based on week number
            let month = "";
            if (week >= 9 && week <= 13) month = "Março";
            else if (week >= 14 && week <= 17) month = "Abril";
            else if (week >= 18 && week <= 22) month = "Maio";
            else if (week >= 23 && week <= 26) month = "Junho";
            else if (week >= 27 && week <= 30) month = "Julho";
            else if (week >= 31 && week <= 35) month = "Agosto";
            else if (week >= 36 && week <= 40) month = "Setembro";
            return `Semana ${week}${month ? ` (${month})` : ""}`;
          },
          label: (context: any) => {
            const year = context.dataset.label;
            const abundance = context.parsed.y.toFixed(4);
            return `${year}: ${abundance}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "linear" as const,
        title: {
          display: true,
          text: "Semana do Ano (Época de Monitorização: Março-Setembro)",
        },
        min: MONITORING_START_WEEK,
        max: MONITORING_END_WEEK,
        ticks: {
          stepSize: 4,
          callback: function (value: any) {
            // Show week numbers within monitoring season
            return value;
          },
        },
      },
      y: {
        type: "linear" as const,
        title: {
          display: true,
          text: "Abundância Normalizada",
        },
        beginAtZero: true,
        ...(yAxisMax && yAxisMax > 0 ? { max: yAxisMax } : {}),
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false,
    },
  };

  return (
    <Card title={`Região: ${region}`} style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 8, fontSize: "13px", color: "#666" }}>
        <strong>Dados:</strong> {dataQuality.transectCount} transectos, {dataQuality.totalVisits}{" "}
        visitas, {dataQuality.totalCounts} contagens
      </div>
      <div style={{ height: 350 }}>
        <Line data={chartData} options={options} />
      </div>
    </Card>
  );
};

/**
 * Component to display flight curves for all regions of a species
 */
interface FlightCurvesDisplayProps {
  speciesName: string;
  phenologyData: {
    regions: {
      [region: string]: RegionalPhenology;
    };
  } | null;
  loading?: boolean;
}

export const FlightCurvesDisplay: React.FC<FlightCurvesDisplayProps> = ({
  speciesName,
  phenologyData,
  loading = false,
}) => {
  if (loading) {
    return (
      <Card loading={true}>
        <div style={{ height: 350 }} />
      </Card>
    );
  }

  if (!phenologyData || Object.keys(phenologyData.regions).length === 0) {
    return (
      <Card>
        <Empty
          description={
            <>
              <p>
                Curvas de voo não disponíveis para <strong>{speciesName}</strong>
              </p>
              <p style={{ fontSize: "0.9em", color: "#666" }}>
                Dados insuficientes ou espécie não incluída na análise rbms
              </p>
            </>
          }
        />
      </Card>
    );
  }

  // Define geographical order for BMS environmental zones (roughly north to south)
  const regionOrder: Record<string, number> = {
    Lusitano: 1, // Atlantic northwestern Portugal
    "Mediterrânico Norte": 2, // Northern Mediterranean Portugal
    "Mediterrânico Montanhoso": 3, // Mediterranean Mountains
    "Mediterrânico Sul": 4, // Southern Mediterranean Portugal
  };

  // Filter out regions without valid phenology curves data
  const regions = Object.keys(phenologyData.regions)
    .filter(region => {
      const regionData = phenologyData.regions[region];
      if (!regionData.phenologyCurves || Object.keys(regionData.phenologyCurves).length === 0) {
        return false;
      }

      // Check if at least one year has valid (non-NA) abundance data
      return Object.values(regionData.phenologyCurves).some(yearData => {
        if (!yearData.abundance || yearData.abundance.length === 0) return false;
        // Check if there's at least one valid numeric value (Number("NA") returns NaN)
        return yearData.abundance.some(val => val !== null && !isNaN(Number(val)));
      });
    })
    .sort((a, b) => (regionOrder[a] || 999) - (regionOrder[b] || 999));

  // If no regions have data after filtering, show empty state
  if (regions.length === 0) {
    return (
      <Card>
        <Empty
          description={
            <>
              <p>
                Curvas de voo não disponíveis para <strong>{speciesName}</strong>
              </p>
              <p style={{ fontSize: "0.9em", color: "#666" }}>
                Dados insuficientes em todas as regiões climáticas
              </p>
            </>
          }
        />
      </Card>
    );
  }

  // Calculate maximum abundance across all regions and years for consistent y-axis
  const allAbundanceValues: number[] = [];

  Object.values(phenologyData.regions).forEach(regionData => {
    const { phenologyCurves } = regionData;
    if (!phenologyCurves) return;

    Object.values(phenologyCurves).forEach(yearData => {
      if (yearData.abundance && Array.isArray(yearData.abundance)) {
        yearData.abundance.forEach(val => {
          const numVal = typeof val === "number" ? val : parseFloat(val as any);
          if (!isNaN(numVal)) {
            allAbundanceValues.push(numVal);
          }
        });
      }
    });
  });

  const maxAbundance = allAbundanceValues.length > 0 ? Math.max(...allAbundanceValues) : 0;

  // Add 10% padding to the max value
  const yAxisMax = maxAbundance > 0 ? maxAbundance * 1.1 : undefined;

  return (
    <div>
      <Alert
        message="Curvas de Voo (Fenologia)"
        description={
          <>
            <p>
              As curvas de voo mostram a abundância semanal prevista de{" "}
              <strong>{speciesName}</strong> ao longo da época de monitorização (Março-Setembro).
              Estas previsões são calculadas utilizando modelos GAM (Generalized Additive Models)
              através da biblioteca rbms.
            </p>
            <p style={{ marginTop: 8, marginBottom: 0 }}>
              <strong>Metodologia:</strong> As curvas são calculadas separadamente por região
              climática, usando apenas transectos de qualidade (5+ anos ativos, 5+ visitas/ano).
              Cada linha representa um ano diferente, permitindo comparar padrões fenológicos entre
              anos.
            </p>
          </>
        }
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        style={{ marginBottom: 16 }}
      />

      {regions.map(region => (
        <FlightCurveChart
          key={region}
          region={region}
          regionalData={phenologyData.regions[region]}
          yAxisMax={yAxisMax}
        />
      ))}
    </div>
  );
};

export default FlightCurveChart;
