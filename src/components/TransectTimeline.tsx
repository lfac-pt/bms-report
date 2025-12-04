import { useMemo } from "react";
import { Card, Tabs, Table, Alert, Space, Spin, Popover, List } from "antd";
import { Bar } from "react-chartjs-2";
import { InfoCircleOutlined } from "@ant-design/icons";
import { TimelineData } from "../types/timelineData";
import { TransectStats } from "../types/transectStats";
import { SERIES_COLORS } from "../utils/utils";
import { filterTimelineByTransects } from "../utils/timelineUtils";
import SpeciesLink from "./SpeciesLink";
import { SPECIES_FAMILIES } from "../utils/speciesFamilies";

interface TransectTimelineProps {
  timelineData: TimelineData;
  filteredTransects: TransectStats[];
  loading: boolean;
}

function TransectTimeline({ timelineData, filteredTransects, loading }: TransectTimelineProps) {
  // Filter timeline data based on selected transects
  const filteredTimelineData = useMemo(() => {
    return filterTimelineByTransects(timelineData, filteredTransects);
  }, [timelineData, filteredTransects]);

  // Tab 1: Transects Per Year Chart
  const TransectsTab = () => {
    const chartData = {
      labels: filteredTimelineData.transectsPerYear.map(d => d.year.toString()),
      datasets: [
        {
          label: "Número de Transectos",
          data: filteredTimelineData.transectsPerYear.map(d => d.transectCount),
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
      {[...filteredTimelineData.years].reverse().map(year => {
        const top10 = (filteredTimelineData.butterflyFrequencyByYear[year] || []).slice(0, 10);

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
                  render: text => <SpeciesLink species={text} />,
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
      {[...filteredTimelineData.years].reverse().map(year => {
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
                            renderItem={species => (
                              <List.Item style={{ padding: "2px 0" }}>
                                <SpeciesLink species={species} />
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

  // Tab 4: Monthly Diversity (Average species per visit)
  const MonthlyDiversityTab = () => {
    const transectIdSet = new Set(filteredTransects.map(t => t.transectId));
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    // Calculate monthly diversity for a specific year
    const calculateMonthlyDiversityForYear = (year: number) => {
      const observationsByDate = timelineData.observationsByYearDate[year] || {};

      // Initialize data for monitoring season months (March to September)
      // Track unique species per transect per month
      const monthlyTransectSpecies: Record<
        number,
        Map<string, Set<string>>
      > = {};
      for (let month = 3; month <= 9; month++) {
        monthlyTransectSpecies[month] = new Map();
      }

      Object.entries(observationsByDate).forEach(([date, observations]) => {
        // Parse date DD/MM/YYYY
        const parts = date.split("/");
        if (parts.length !== 3) return;
        const month = parseInt(parts[1], 10);

        // Only process monitoring season months
        if (month < 3 || month > 9) return;

        // Collect unique VALID species per transect for this month
        observations.forEach(([transectId, species]) => {
          if (transectIdSet.has(transectId) && SPECIES_FAMILIES[species]) {
            if (!monthlyTransectSpecies[month].has(transectId)) {
              monthlyTransectSpecies[month].set(transectId, new Set());
            }
            monthlyTransectSpecies[month].get(transectId)!.add(species);
          }
        });
      });

      // Calculate average diversity per transect for each month
      return Object.entries(monthlyTransectSpecies)
        .map(([monthStr, transectMap]) => {
          const month = parseInt(monthStr, 10);

          if (transectMap.size === 0) {
            return {
              month,
              monthName: monthNames[month - 1],
              averageDiversity: 0,
              visitCount: 0,
            };
          }

          // Calculate total unique species per transect, then average
          const diversityCounts = Array.from(transectMap.values()).map(
            speciesSet => speciesSet.size
          );
          const totalDiversity = diversityCounts.reduce((sum, count) => sum + count, 0);
          const averageDiversity = totalDiversity / diversityCounts.length;

          return {
            month,
            monthName: monthNames[month - 1],
            averageDiversity,
            visitCount: transectMap.size,
          };
        })
        .sort((a, b) => a.month - b.month); // Sort by month number
    };

    // Calculate data for all years and find the maximum value for consistent y-axis
    const allYearsData = filteredTimelineData.years.map(year => ({
      year,
      data: calculateMonthlyDiversityForYear(year),
    }));

    const maxDiversity = Math.max(
      ...allYearsData.flatMap(yearData =>
        yearData.data.map(m => m.averageDiversity)
      ),
      0
    );

    // Add some padding to the max value (10%)
    const yAxisMax = maxDiversity * 1.1;

    return (
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {[...allYearsData].reverse().map(({ year, data: monthlyData }) => {
          // Check if there's any data (any month with visits)
          const hasData = monthlyData.some(m => m.visitCount > 0);

          if (!hasData) {
            return (
              <Card key={year} type="inner" title={`Ano ${year}`} size="small">
                <div style={{ padding: 20, textAlign: "center", color: "#8c8c8c" }}>
                  Sem dados para este ano
                </div>
              </Card>
            );
          }

          const chartData = {
            labels: monthlyData.map(m => m.monthName),
            datasets: [
              {
                label: "Diversidade média",
                data: monthlyData.map(m => m.averageDiversity),
                backgroundColor: SERIES_COLORS[1],
              },
            ],
          };

          const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
            },
            scales: {
              y: {
                beginAtZero: true,
                max: yAxisMax,
                title: { display: false },
              },
              x: {
                title: { display: false },
              },
            },
          };

          return (
            <Card key={year} type="inner" title={`Ano ${year}`} size="small">
              <div style={{ height: 200 }}>
                <Bar data={chartData} options={options} />
              </div>
            </Card>
          );
        })}
        <Alert
          message="Mostra o número médio de espécies observadas por visita para cada mês, para os transectos selecionados."
          type="info"
        />
      </Space>
    );
  };

  // Tab 5: Monthly Average Abundance
  const MonthlyAbundanceTab = () => {
    const transectIdSet = new Set(filteredTransects.map(t => t.transectId));
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    // Calculate monthly data for a specific year
    const calculateMonthlyDataForYear = (year: number) => {
      const observationsByDate = timelineData.observationsByYearDate[year] || {};

      // Initialize data for monitoring season months (March to September)
      const monthlyStats: Record<
        number,
        { totalAbundance: number; visitCount: number }
      > = {};
      for (let month = 3; month <= 9; month++) {
        monthlyStats[month] = { totalAbundance: 0, visitCount: 0 };
      }

      Object.entries(observationsByDate).forEach(([date, observations]) => {
        // Parse date DD/MM/YYYY
        const parts = date.split("/");
        if (parts.length !== 3) return;
        const month = parseInt(parts[1], 10);

        // Only process monitoring season months
        if (month < 3 || month > 9) return;

        // Group observations by transect and sum abundances per transect
        const transectAbundances = new Map<string, number>();

        observations.forEach(([transectId, , abundance]) => {
          if (transectIdSet.has(transectId)) {
            const current = transectAbundances.get(transectId) || 0;
            transectAbundances.set(transectId, current + abundance);
          }
        });

        // Count each transect visit separately
        transectAbundances.forEach((totalAbundance) => {
          monthlyStats[month].totalAbundance += totalAbundance;
          monthlyStats[month].visitCount += 1;
        });
      });

      // Calculate averages for monitoring season months
      return Object.entries(monthlyStats)
        .map(([monthStr, stats]) => {
          const month = parseInt(monthStr, 10);
          return {
            month,
            monthName: monthNames[month - 1],
            averageAbundance:
              stats.visitCount > 0 ? stats.totalAbundance / stats.visitCount : 0,
            visitCount: stats.visitCount,
          };
        })
        .sort((a, b) => a.month - b.month); // Sort by month number
    };

    // Calculate data for all years and find the maximum value for consistent y-axis
    const allYearsData = filteredTimelineData.years.map(year => ({
      year,
      data: calculateMonthlyDataForYear(year),
    }));

    const maxAbundance = Math.max(
      ...allYearsData.flatMap(yearData =>
        yearData.data.map(m => m.averageAbundance)
      ),
      0
    );

    // Add some padding to the max value (10%)
    const yAxisMax = maxAbundance * 1.1;

    return (
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {[...allYearsData].reverse().map(({ year, data: monthlyData }) => {
          // Check if there's any data (any month with visits)
          const hasData = monthlyData.some(m => m.visitCount > 0);

          if (!hasData) {
            return (
              <Card key={year} type="inner" title={`Ano ${year}`} size="small">
                <div style={{ padding: 20, textAlign: "center", color: "#8c8c8c" }}>
                  Sem dados para este ano
                </div>
              </Card>
            );
          }

          const chartData = {
            labels: monthlyData.map(m => m.monthName),
            datasets: [
              {
                label: "Abundância média/visita",
                data: monthlyData.map(m => m.averageAbundance),
                backgroundColor: SERIES_COLORS[0],
              },
            ],
          };

          const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
            },
            scales: {
              y: {
                beginAtZero: true,
                max: yAxisMax,
                title: { display: false },
              },
              x: {
                title: { display: false },
              },
            },
          };

          return (
            <Card key={year} type="inner" title={`Ano ${year}`} size="small">
              <div style={{ height: 200 }}>
                <Bar data={chartData} options={options} />
              </div>
            </Card>
          );
        })}
        <Alert
          message="Mostra a abundância média por visita para cada mês, para os transectos selecionados."
          type="info"
        />
      </Space>
    );
  };

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
    {
      key: "monthly-diversity",
      label: "Diversidade Mensal",
      children: <MonthlyDiversityTab />,
    },
    {
      key: "monthly-abundance",
      label: "Abundância Mensal",
      children: <MonthlyAbundanceTab />,
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

  return <Tabs items={items} defaultActiveKey="transects" style={{ marginTop: 16 }} />;
}

export default TransectTimeline;
