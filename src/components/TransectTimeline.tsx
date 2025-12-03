import { useMemo } from "react";
import {
  Card,
  Tabs,
  Table,
  Alert,
  Space,
  Spin,
  Popover,
  List,
  Typography,
} from "antd";
import { Bar } from "react-chartjs-2";
import { InfoCircleOutlined } from "@ant-design/icons";
import { TimelineData } from "../types/timelineData";
import { TransectStats } from "../types/transectStats";
import { SERIES_COLORS } from "../utils/utils";
import { filterTimelineByTransects } from "../utils/timelineUtils";

interface TransectTimelineProps {
  timelineData: TimelineData;
  filteredTransects: TransectStats[];
  loading: boolean;
}

function TransectTimeline({
  timelineData,
  filteredTransects,
  loading,
}: TransectTimelineProps) {
  // Filter timeline data based on selected transects
  const filteredTimelineData = useMemo(() => {
    return filterTimelineByTransects(timelineData, filteredTransects);
  }, [timelineData, filteredTransects]);

  // Tab 1: Transects Per Year Chart
  const TransectsTab = () => {
    const chartData = {
      labels: filteredTimelineData.transectsPerYear.map((d) =>
        d.year.toString()
      ),
      datasets: [
        {
          label: "Número de Transectos",
          data: filteredTimelineData.transectsPerYear.map(
            (d) => d.transectCount
          ),
          backgroundColor: SERIES_COLORS[0],
        },
      ],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Transectos com Observações por Ano",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          title: { display: true, text: "Número de Transectos" },
        },
        x: {
          title: { display: true, text: "Ano" },
        },
      },
    };

    return (
      <Card size="small">
        <Bar data={chartData} options={options} />
      </Card>
    );
  };

  // Tab 2: Top 10 Butterflies Per Year
  const ButterfliesTab = () => (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {[...filteredTimelineData.years].reverse().map((year) => {
        const top10 = (
          filteredTimelineData.butterflyFrequencyByYear[year] || []
        ).slice(0, 10);

        return (
          <Card key={year} type="inner" title={`Ano ${year}`} size="small">
            <Table
              dataSource={top10}
              columns={[
                {
                  title: "Espécie",
                  dataIndex: "species",
                  key: "species",
                  width: 300,
                  render: (text) => <i>{text}</i>,
                },
                {
                  title: "Frequência",
                  dataIndex: "frequency",
                  key: "frequency",
                  render: (freq, record) =>
                    `${freq.toFixed(1)}% (${record.visitCount}/${record.totalVisits})`,
                },
              ]}
              pagination={false}
              size="small"
              rowKey="species"
            />
          </Card>
        );
      })}
      <Alert
        message="Frequência é a percentagem de visitas em que a espécie foi avistada durante o ano."
        type="info"
      />
    </Space>
  );

  // Tab 3: Top 5 Diverse Transects Per Year
  const DiversityTab = () => (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {[...filteredTimelineData.years].reverse().map((year) => {
        const top5 = filteredTimelineData.transectDiversityByYear[year] || [];

        return (
          <Card key={year} type="inner" title={`Ano ${year}`} size="small">
            <Table
              dataSource={top5}
              columns={[
                {
                  title: "Transecto",
                  dataIndex: "transectName",
                  key: "transectName",
                  width: 250,
                },
                {
                  title: "Diversidade",
                  dataIndex: "diversityCount",
                  key: "diversityCount",
                  align: "right",
                  width: 120,
                  render: (count, record) => (
                    <Popover
                      content={
                        <div style={{ maxHeight: 300, overflowY: "auto" }}>
                          <List
                            size="small"
                            dataSource={record.speciesList}
                            renderItem={(species) => (
                              <List.Item style={{ padding: "2px 0" }}>
                                <Typography.Text italic>
                                  {species}
                                </Typography.Text>
                              </List.Item>
                            )}
                          />
                        </div>
                      }
                      title={`Espécies em ${record.transectName}`}
                      trigger="click"
                    >
                      <span style={{ cursor: "pointer", color: "#1890ff" }}>
                        {count} <InfoCircleOutlined style={{ fontSize: 10 }} />
                      </span>
                    </Popover>
                  ),
                },
                {
                  title: "Concelho",
                  dataIndex: "concelho",
                  key: "concelho",
                  width: 150,
                },
                {
                  title: "Distrito",
                  dataIndex: "distrito",
                  key: "distrito",
                  width: 150,
                },
              ]}
              pagination={false}
              size="small"
              rowKey="transectId"
            />
          </Card>
        );
      })}
      <Alert
        message="Diversidade é o número total de espécies únicas observadas no transecto durante o ano. Clique no número para ver a lista completa."
        type="info"
      />
    </Space>
  );

  // Main tabs
  const items = [
    {
      key: "transects",
      label: "Transectos por Ano",
      children: <TransectsTab />,
    },
    {
      key: "butterflies",
      label: "Top 10 Borboletas",
      children: <ButterfliesTab />,
    },
    {
      key: "diversity",
      label: "Top 5 Transectos Diversos",
      children: <DiversityTab />,
    },
  ];

  if (loading) {
    return <Spin tip="A carregar dados da linha do tempo..." />;
  }

  if (filteredTransects.length === 0) {
    return (
      <Alert
        message="Nenhum dado disponível"
        description="Não existem dados para os transectos filtrados."
        type="info"
        style={{ marginTop: 16 }}
      />
    );
  }

  return (
    <Tabs items={items} defaultActiveKey="transects" style={{ marginTop: 16 }} />
  );
}

export default TransectTimeline;
