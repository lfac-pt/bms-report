import { Line } from 'react-chartjs-2';
import { Typography } from 'antd';

const { Text } = Typography;

interface Props {
  weeks: number[];
  abundance: number[];
}

const SpeciesSparkline: React.FC<Props> = ({ weeks, abundance }) => {
  const chartData = {
    datasets: [
      {
        data: weeks
          .map((week, idx) => ({ x: week, y: abundance[idx] }))
          .filter(point => point.x >= 9 && point.x <= 40), // March-Sept only
        borderColor: '#1890ff',
        borderWidth: 1.5,
        pointRadius: 0,
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
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        display: false,
        type: 'linear' as const,
        min: 9,
        max: 40,
      },
      y: {
        display: false,
        type: 'linear' as const,
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ height: 40, width: 120 }}>
        <Line data={chartData} options={options} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 2 }}>
        <Text type="secondary" style={{ fontSize: 9 }}>
          Março
        </Text>
        <Text type="secondary" style={{ fontSize: 9 }}>
          Setembro
        </Text>
      </div>
    </div>
  );
};

export default SpeciesSparkline;
