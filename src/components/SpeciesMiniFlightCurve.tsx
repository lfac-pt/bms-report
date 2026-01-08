import React from "react";
import { Line } from "react-chartjs-2";
import { Typography } from "antd";
import type { AveragedFlightCurve } from "../utils/speciesCardUtils";

const { Text } = Typography;

interface Props {
  curve: AveragedFlightCurve;
  region: string;
}

const SpeciesMiniFlightCurve: React.FC<Props> = ({ curve, region }) => {
  const chartData = {
    datasets: [
      {
        label: `Média (${curve.yearCount} anos)`,
        data: curve.weeks
          .map((week, idx) => ({ x: week, y: curve.averageAbundance[idx] }))
          .filter(point => point.x >= 9 && point.x < 40), // March-Sept only
        borderColor: "#1890ff",
        backgroundColor: "#1890ff",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.4,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        callbacks: {
          title: (context: any) => {
            const week = context[0].parsed.x;
            return `Semana ${week}`;
          },
          label: (context: any) => {
            const abundance = context.parsed.y.toFixed(3);
            return `Abundância: ${abundance}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "linear" as const,
        title: { display: true, text: "Semana do Ano" },
        min: 9,
        max: 40,
        ticks: { stepSize: 8 },
      },
      y: {
        type: "linear" as const,
        title: { display: true, text: "Abundância" },
        beginAtZero: true,
      },
    },
  };

  return (
    <div>
      <Text strong style={{ fontSize: 13 }}>
        Curva de Voo - {region}
      </Text>
      <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
        (média de {curve.yearCount} {curve.yearCount === 1 ? "ano" : "anos"})
      </Text>
      <div style={{ height: 150, marginTop: 8 }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

export default SpeciesMiniFlightCurve;
