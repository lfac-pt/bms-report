import { useState, useEffect, useMemo } from "react";
import { Button, Card, Space, Typography, Spin, Alert, Row, Col, Select, Radio } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import { SPECIES_FAMILIES } from "../utils/speciesFamilies";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";
import { calculateSpeciesPresenceByYear } from "../utils/speciesMapUtils";
import SpeciesMap from "./SpeciesMap";
import { SERIES_COLORS } from "../utils/utils";
import endangeredSpeciesPT from "../utils/endangered_pt";
import endangeredSpeciesEurope from "../utils/endangered_eu";

const { Title, Text } = Typography;

// Define the canonical family order
const FAMILY_ORDER = [
  "Hesperiidae",
  "Papilionidae",
  "Pieridae",
  "Nymphalidae",
  "Lycaenidae",
];

// Helper function to get full endangerment description
function getEndangermentDescription(status: string): string {
  const descriptions: Record<string, string> = {
    CR: "Criticamente em Perigo",
    EN: "Em Perigo",
    VU: "Vulnerável",
    NT: "Quase Ameaçada",
    DD: "Dados Insuficientes",
    LC: "Pouco Preocupante",
  };
  return descriptions[status] || status;
}

function SpeciesPage() {
  const { speciesName } = useParams<{ speciesName: string }>();
  const navigate = useNavigate();

  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [transectData, setTransectData] = useState<TransectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [yearViewMode, setYearViewMode] = useState<"combined" | "separate">("combined");

  // Decode the species name from URL
  const decodedSpeciesName = speciesName ? decodeURIComponent(speciesName) : "";
  const family = SPECIES_FAMILIES[decodedSpeciesName] || "Informação não disponível";

  // Load timeline and transect data
  useEffect(() => {
    Promise.all([
      fetch("/data/timeline-data.json").then(res => res.json()),
      fetch("/data/processed-transects.json").then(res => res.json()),
    ])
      .then(([timeline, transects]) => {
        setTimelineData(timeline);
        setTransectData(transects);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Calculate monthly abundance per climatic region
  // IMPORTANT: This must be called before any conditional returns
  const regionalMonthlyData = useMemo(() => {
    if (!timelineData || !transectData) return {};

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    // Filter years to exclude 2019
    const filteredYears = timelineData.years.filter(y => y !== 2019);
    const mostRecentYear = Math.max(...filteredYears);

    // Filter transects based on quality criteria:
    // - At least 10 visits per season (year)
    // - Had observations in the most recent year
    // - At least 5 years of data
    const qualityTransects = transectData.transects.filter(t => {
      // Check if has at least 5 years
      if (t.yearsActive < 5) return false;

      // Check if monitored in most recent year
      if (t.lastMonitoringYear !== mostRecentYear) return false;

      // Check average visits per year (should be >= 10)
      if (t.avgVisitsPerYear < 10) return false;

      return true;
    });

    // Group quality transects by climatic region
    const transectsByRegion = new Map<string, Set<string>>();
    qualityTransects.forEach(t => {
      if (!transectsByRegion.has(t.climaticRegion)) {
        transectsByRegion.set(t.climaticRegion, new Set());
      }
      transectsByRegion.get(t.climaticRegion)!.add(t.transectId);
    });

    const result: Record<string, any> = {};

    transectsByRegion.forEach((transectIds, region) => {
      if (yearViewMode === "combined") {
        // All years combined
        const monthlyStats: Record<number, { totalAbundance: number; visitCount: number }> = {};
        for (let month = 3; month <= 9; month++) {
          monthlyStats[month] = { totalAbundance: 0, visitCount: 0 };
        }

        filteredYears.forEach(year => {
          const observationsByDate = timelineData.observationsByYearDate[year] || {};

          Object.entries(observationsByDate).forEach(([date, observations]) => {
            const parts = date.split("/");
            if (parts.length !== 3) return;
            const month = parseInt(parts[1], 10);
            if (month < 3 || month > 9) return;

            // Get all transects that visited on this date (from quality transects)
            const transectsOnThisDate = new Set<string>();
            observations.forEach(([transectId]) => {
              if (transectIds.has(transectId)) {
                transectsOnThisDate.add(transectId);
              }
            });

            // Calculate abundance for each transect (0 if species not observed)
            const transectAbundances = new Map<string, number>();
            transectsOnThisDate.forEach(transectId => {
              transectAbundances.set(transectId, 0); // Initialize with 0
            });

            observations.forEach(([transectId, species, abundance]) => {
              if (transectIds.has(transectId) && species === decodedSpeciesName) {
                const current = transectAbundances.get(transectId) || 0;
                transectAbundances.set(transectId, current + abundance);
              }
            });

            // Count ALL transect visits, including those with 0 abundance
            transectAbundances.forEach(totalAbundance => {
              monthlyStats[month].totalAbundance += totalAbundance;
              monthlyStats[month].visitCount += 1;
            });
          });
        });

        result[region] = {
          transectCount: transectIds.size,
          data: Object.entries(monthlyStats)
            .map(([monthStr, stats]) => ({
              month: parseInt(monthStr, 10),
              monthName: monthNames[parseInt(monthStr, 10) - 1],
              averageAbundance: stats.visitCount > 0 ? stats.totalAbundance / stats.visitCount : 0,
            }))
            .sort((a, b) => a.month - b.month),
        };
      } else {
        // Separate years
        result[region] = {
          transectCount: transectIds.size,
          data: filteredYears.map(year => {
            const monthlyStats: Record<number, { totalAbundance: number; visitCount: number }> = {};
            for (let month = 3; month <= 9; month++) {
              monthlyStats[month] = { totalAbundance: 0, visitCount: 0 };
            }

            const observationsByDate = timelineData.observationsByYearDate[year] || {};

            Object.entries(observationsByDate).forEach(([date, observations]) => {
              const parts = date.split("/");
              if (parts.length !== 3) return;
              const month = parseInt(parts[1], 10);
              if (month < 3 || month > 9) return;

              const transectAbundances = new Map<string, number>();
              observations.forEach(([transectId, species, abundance]) => {
                if (transectIds.has(transectId) && species === decodedSpeciesName) {
                  const current = transectAbundances.get(transectId) || 0;
                  transectAbundances.set(transectId, current + abundance);
                }
              });

              transectAbundances.forEach(totalAbundance => {
                monthlyStats[month].totalAbundance += totalAbundance;
                monthlyStats[month].visitCount += 1;
              });
            });

            return {
              year,
              data: Object.entries(monthlyStats)
                .map(([monthStr, stats]) => ({
                  month: parseInt(monthStr, 10),
                  monthName: monthNames[parseInt(monthStr, 10) - 1],
                  averageAbundance: stats.visitCount > 0 ? stats.totalAbundance / stats.visitCount : 0,
                }))
                .sort((a, b) => a.month - b.month),
            };
          }),
        };
      }
    });

    return result;
  }, [timelineData, transectData, decodedSpeciesName, yearViewMode]);

  const handleGoBack = () => {
    navigate("/transects");
  };

  const handleSpeciesChange = (selectedSpecies: string) => {
    navigate(`/species/${encodeURIComponent(selectedSpecies)}`);
  };

  // Get all species with observations from timeline data
  const speciesWithRecords = new Set<string>();
  if (timelineData) {
    Object.values(timelineData.observationsByYearDate).forEach(yearData => {
      Object.values(yearData).forEach(observations => {
        observations.forEach(([, species, ]) => {
          speciesWithRecords.add(species);
        });
      });
    });
  }

  // Group species by family and sort alphabetically within each family
  const speciesByFamily: Record<string, string[]> = {};
  Object.entries(SPECIES_FAMILIES).forEach(([species, family]) => {
    if (!speciesByFamily[family]) {
      speciesByFamily[family] = [];
    }
    speciesByFamily[family].push(species);
  });

  // Sort families by canonical order and species within each family
  const sortedFamilies = Object.keys(speciesByFamily).sort((a, b) => {
    const indexA = FAMILY_ORDER.indexOf(a);
    const indexB = FAMILY_ORDER.indexOf(b);
    // If both families are in the order list, sort by their index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    // If only one is in the list, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    // If neither is in the list, sort alphabetically
    return a.localeCompare(b);
  });
  const speciesOptions = sortedFamilies.map(family => ({
    label: family,
    options: speciesByFamily[family].sort().map(species => {
      const hasRecords = speciesWithRecords.has(species);

      // Check if species is endangered
      let endangeredLabel = "";
      if (endangeredSpeciesPT[species]) {
        endangeredLabel = ` (${endangeredSpeciesPT[species]} - PT)`;
      } else if (endangeredSpeciesEurope[species]) {
        endangeredLabel = ` (${endangeredSpeciesEurope[species]} - UE)`;
      }

      const recordsLabel = hasRecords ? "" : " (sem registos)";
      const label = `${species}${endangeredLabel}${recordsLabel}`;

      return {
        label,
        value: species,
      };
    }),
  }));

  if (loading) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
        <Spin size="large" />
      </Space>
    );
  }

  if (!timelineData || !transectData) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
        <Alert message="Erro ao carregar dados" type="error" />
      </Space>
    );
  }

  // Get available years and calculate species data for each year
  const years = [...timelineData.years].reverse(); // Most recent first

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Button type="default" icon={<ArrowLeftOutlined />} onClick={handleGoBack} size="large">
          Voltar à Visão Geral
        </Button>
        <Select
          showSearch
          value={decodedSpeciesName}
          onChange={handleSpeciesChange}
          placeholder="Escolher espécie..."
          style={{ width: 450 }}
          size="large"
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          options={speciesOptions}
        />
      </div>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Title level={2} italic style={{ marginBottom: 0 }}>
            {decodedSpeciesName}
          </Title>
          <Text strong style={{ fontSize: 16 }}>
            Família: {family}
          </Text>
          {(endangeredSpeciesPT[decodedSpeciesName] || endangeredSpeciesEurope[decodedSpeciesName]) && (
            <Alert
              message={
                endangeredSpeciesPT[decodedSpeciesName]
                  ? `Espécie Ameaçada: ${endangeredSpeciesPT[decodedSpeciesName]} (${getEndangermentDescription(endangeredSpeciesPT[decodedSpeciesName])}) em Portugal.`
                  : `Espécie Ameaçada: ${endangeredSpeciesEurope[decodedSpeciesName]} (${getEndangermentDescription(endangeredSpeciesEurope[decodedSpeciesName])}) na União Europeia.`
              }
              type="warning"
              showIcon
            />
          )}
        </Space>
      </Card>

      <Card title="Distribuição por Ano">
        <Row gutter={[16, 16]}>
          {years.map(year => {
            const speciesData = calculateSpeciesPresenceByYear(
              decodedSpeciesName,
              year,
              timelineData,
              transectData.transects
            );

            const withSpecies = speciesData.filter(t => t.hasSpecies).length;
            const totalTransects = speciesData.length;

            return (
              <Col key={year} xs={24} sm={24} md={12} lg={8} xl={6}>
                <Card
                  type="inner"
                  title={`${year} (${withSpecies} de ${totalTransects} transectos)`}
                  size="small"
                >
                  <SpeciesMap
                    transects={speciesData}
                    speciesName={decodedSpeciesName}
                    year={year}
                    timelineData={timelineData}
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      <Card title="Abundância Mensal por Região">
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {(() => {
            // Check if there's any data across all regions
            const hasAnyData = Object.values(regionalMonthlyData).some(regionData => {
              const { data } = regionData as { transectCount: number; data: any };

              if (yearViewMode === "combined") {
                const monthlyData = data as Array<{ month: number; monthName: string; averageAbundance: number }>;
                return monthlyData.some(m => m.averageAbundance > 0);
              } else {
                const yearlyData = data as Array<{
                  year: number;
                  data: Array<{ month: number; monthName: string; averageAbundance: number }>;
                }>;
                return yearlyData.some(yd => yd.data.some(m => m.averageAbundance > 0));
              }
            });

            if (!hasAnyData) {
              return (
                <Alert
                  message="Sem dados disponíveis para esta espécie nas regiões monitorizadas."
                  type="info"
                  showIcon
                />
              );
            }

            // Calculate max abundance across all regions for consistent y-axis
            const maxAbundance = Math.max(
              ...Object.values(regionalMonthlyData).flatMap(regionData => {
                const { data } = regionData as { transectCount: number; data: any };

                if (yearViewMode === "combined") {
                  const monthlyData = data as Array<{ month: number; monthName: string; averageAbundance: number }>;
                  return monthlyData.map(m => m.averageAbundance);
                } else {
                  const yearlyData = data as Array<{
                    year: number;
                    data: Array<{ month: number; monthName: string; averageAbundance: number }>;
                  }>;
                  return yearlyData.flatMap(yd => yd.data.map(m => m.averageAbundance));
                }
              }),
              0
            );

            // Add 10% padding to the max value
            const yAxisMax = maxAbundance * 1.1;

            // Define geographical order (north to south)
            const regionOrder: Record<string, number> = {
              "Norte": 1,
              "Centro": 2,
              "Lisboa e Vale do Tejo": 3,
              "Alentejo": 4,
              "Algarve": 5,
            };

            return (
              <>
                <Radio.Group
                  value={yearViewMode}
                  onChange={e => setYearViewMode(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value="combined">Todos os Anos</Radio.Button>
                  <Radio.Button value="separate">Por Ano</Radio.Button>
                </Radio.Group>

                {Object.entries(regionalMonthlyData)
                  .sort(([a], [b]) => (regionOrder[a] || 999) - (regionOrder[b] || 999))
                  .map(([region, regionData]) => {
                    const { transectCount, data } = regionData as {
                      transectCount: number;
                      data: any;
                    };

                    if (yearViewMode === "combined") {
                      const monthlyData = data as Array<{ month: number; monthName: string; averageAbundance: number }>;

                      if (monthlyData.every(m => m.averageAbundance === 0)) {
                        return null; // Skip regions with no data
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
                  <Card key={region} type="inner" title={`${region} (${transectCount} transectos)`} size="small">
                    <div style={{ height: 250 }}>
                      <Bar data={chartData} options={options} />
                    </div>
                  </Card>
                );
              } else {
                // Separate years
                const yearlyData = data as Array<{
                  year: number;
                  data: Array<{ month: number; monthName: string; averageAbundance: number }>;
                }>;

                if (yearlyData.every(yd => yd.data.every(m => m.averageAbundance === 0))) {
                  return null; // Skip regions with no data
                }

                const monthNames = yearlyData[0]?.data.map(m => m.monthName) || [];
                const datasets = yearlyData.map((yd, idx) => ({
                  label: yd.year.toString(),
                  data: yd.data.map(m => m.averageAbundance),
                  backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length],
                }));

                const chartData = {
                  labels: monthNames,
                  datasets,
                };

                const options = {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: true, position: "top" as const },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: yAxisMax,
                      title: { display: true, text: "Abundância média/visita" },
                    },
                    x: {
                      title: { display: false },
                    },
                  },
                };

                return (
                  <Card key={region} type="inner" title={`${region} (${transectCount} transectos)`} size="small">
                    <div style={{ height: 250 }}>
                      <Bar data={chartData} options={options} />
                    </div>
                  </Card>
                );
              }
            })}
                <Alert
                  message="Os gráficos mostram apenas dados de transectos com critérios de qualidade: pelo menos 10 visitas por época, observações no ano mais recente e pelo menos 5 anos de dados. Os dados de 2019 foram excluídos."
                  type="info"
                />
              </>
            );
          })()}
        </Space>
      </Card>
    </Space>
  );
}

export default SpeciesPage;
