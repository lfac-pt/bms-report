import { useState, useEffect } from "react";
import {
  Table,
  Input,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  Card,
  Popover,
  List,
  Alert,
  Button,
  Dropdown,
  Checkbox,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import { TransectStats, TransectData, ProcessingMetadata } from "../types/transectStats";
import {
  SearchOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  SettingOutlined,
} from "@ant-design/icons";

const { Title } = Typography;

function ButterflyTransects() {
  const [data, setData] = useState<TransectStats[]>([]);
  const [metadata, setMetadata] = useState<ProcessingMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [yearsActiveFilters, setYearsActiveFilters] = useState<(string | number)[]>([]);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Column visibility state - Entidade and Concelho hidden by default
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    transectName: true,
    totalSpecies: true,
    totalVisits: true,
    avgVisitsPerYear: true,
    avgButterfliesPerVisit: true,
    yearsActive: true,
    entidade: false, // Hidden by default
    concelho: false, // Hidden by default
  });

  useEffect(() => {
    // Load processed transects data
    window
      .fetch("/data/processed-transects.json")
      .then(response => response.json())
      .then((jsonData: TransectData) => {
        setData(jsonData.transects);
        setMetadata(jsonData.metadata);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Filter data based on search and yearsActive filters with AND logic
  const filteredData = data.filter(transect => {
    // Search filter
    if (!transect.transectName.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }

    // Anos Ativos filters with AND logic
    if (yearsActiveFilters.length > 0) {
      const hasLastSeason = yearsActiveFilters.includes("lastSeason");
      const yearCounts = yearsActiveFilters.filter(f => f !== "lastSeason") as number[];

      // If "lastSeason" is selected, check if transect was active in the most recent year
      if (hasLastSeason) {
        const mostRecentYear = Math.max(
          ...data.map(t => t.lastMonitoringYear || 0).filter(y => y > 0)
        );
        if (transect.lastMonitoringYear !== mostRecentYear) {
          return false;
        }
      }

      // If year counts are selected, check if transect matches ANY of them
      if (yearCounts.length > 0) {
        if (!yearCounts.includes(transect.yearsActive)) {
          return false;
        }
      }
    }

    return true;
  });

  // Calculate summary statistics
  const mostRecentYear = data.length > 0
    ? Math.max(...data.map(t => t.lastMonitoringYear || 0).filter(y => y > 0))
    : null;

  // Transects active in last season
  const transectsInLastSeason = mostRecentYear
    ? data.filter(t => t.lastMonitoringYear === mostRecentYear).length
    : 0;

  // Long-term quality data transects: active in last season, 5+ years, 10+ avg visits/year
  const longTermQualityTransects = mostRecentYear
    ? data.filter(
        t =>
          t.lastMonitoringYear === mostRecentYear &&
          t.yearsActive >= 5 &&
          t.avgVisitsPerYear > 10
      ).length
    : 0;

  // Transects gained (started in last season) and lost (stopped before last season)
  const transectsGained = mostRecentYear
    ? data.filter(t => t.firstMonitoringYear === mostRecentYear).length
    : 0;
  const transectsLost = mostRecentYear
    ? data.filter(t => t.lastMonitoringYear && t.lastMonitoringYear < mostRecentYear).length
    : 0;

  // Calculate total unique species across all transects
  const allSpeciesSet = new Set<string>();
  data.forEach(transect => {
    transect.speciesList.forEach(species => allSpeciesSet.add(species));
  });
  const uniqueSpeciesList = Array.from(allSpeciesSet).sort();
  const totalUniqueSpecies = uniqueSpeciesList.length;

  const columns: ColumnsType<TransectStats> = [
    {
      title: "Transecto",
      dataIndex: "transectName",
      key: "transectName",
      fixed: "left",
      width: 250,
      sorter: (a, b) => a.transectName.localeCompare(b.transectName),
      defaultSortOrder: "ascend",
    },
    {
      title: "Espécies",
      dataIndex: "totalSpecies",
      key: "totalSpecies",
      width: 120,
      align: "right",
      sorter: (a, b) => a.totalSpecies - b.totalSpecies,
    },
    {
      title: "Visitas",
      dataIndex: "totalVisits",
      key: "totalVisits",
      width: 120,
      align: "right",
      sorter: (a, b) => a.totalVisits - b.totalVisits,
    },
    {
      title: "Visitas/Ano",
      dataIndex: "avgVisitsPerYear",
      key: "avgVisitsPerYear",
      width: 130,
      align: "right",
      sorter: (a, b) => a.avgVisitsPerYear - b.avgVisitsPerYear,
      render: (value: number) => value.toFixed(1),
      filters: [
        { text: "Mais de 10", value: ">10" },
      ],
      onFilter: (value, record) => {
        if (value === ">10") return record.avgVisitsPerYear > 10;
        return true;
      },
    },
    {
      title: "Borboletas/Visita",
      dataIndex: "avgButterfliesPerVisit",
      key: "avgButterfliesPerVisit",
      width: 160,
      align: "right",
      sorter: (a, b) => a.avgButterfliesPerVisit - b.avgButterfliesPerVisit,
      render: (value: number) => value.toFixed(1),
    },
    {
      title: "Anos Ativos",
      dataIndex: "yearsActive",
      key: "yearsActive",
      width: 200,
      align: "right",
      render: (yearsActive: number, record: TransectStats) => {
        if (record.firstMonitoringYear && record.lastMonitoringYear) {
          return `${yearsActive} (${record.firstMonitoringYear}-${record.lastMonitoringYear})`;
        }
        return yearsActive;
      },
      filters: [
        {
          text: "Ativos na última época",
          value: "lastSeason",
        },
        ...Array.from(new Set(data.map(t => t.yearsActive)))
          .sort((a, b) => b - a)
          .map(years => ({ text: years.toString(), value: years })),
      ],
      filteredValue: yearsActiveFilters,
    },
    {
      title: "Entidade",
      dataIndex: "entidade",
      key: "entidade",
      width: 150,
      filters: Array.from(new Set(data.map(t => t.entidade)))
        .filter(e => e)
        .sort()
        .map(e => ({ text: e, value: e })),
      onFilter: (value, record) => record.entidade === value,
    },
    {
      title: "Concelho",
      dataIndex: "concelho",
      key: "concelho",
      width: 150,
      filters: Array.from(new Set(data.map(t => t.concelho)))
        .filter(c => c)
        .sort()
        .map(c => ({ text: c, value: c })),
      onFilter: (value, record) => record.concelho === value,
    },
  ];

  // Filter columns based on visibility
  const visibleColumnsArray = columns.filter(col => {
    const key = col.key as string;
    return visibleColumns[key] !== false;
  });

  // Column configuration menu
  const columnLabels: Record<string, string> = {
    transectName: "Transecto",
    totalSpecies: "Espécies",
    totalVisits: "Visitas",
    avgVisitsPerYear: "Visitas/Ano",
    avgButterfliesPerVisit: "Borboletas/Visita",
    yearsActive: "Anos Ativos",
    entidade: "Entidade",
    concelho: "Concelho",
  };

  const toggleColumn = (columnKey: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  };

  const columnConfigMenu: MenuProps = {
    items: Object.keys(columnLabels).map(key => ({
      key,
      label: (
        <Checkbox
          checked={visibleColumns[key]}
          onChange={() => toggleColumn(key)}
          onClick={e => e.stopPropagation()}
        >
          {columnLabels[key]}
        </Checkbox>
      ),
      onClick: e => e.domEvent.stopPropagation(),
    })),
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", marginTop: 24 }}>
      <div>
        <Title level={2}>
          <BarChartOutlined /> Estatísticas dos Transectos de Borboletas
        </Title>
        <Typography.Paragraph>
          Dados pré-processados de {data.length} transectos do projeto EBMS Portugal.
          Apenas transectos com estado &quot;Válido&quot; ou &quot;Novo&quot; estão incluídos.
        </Typography.Paragraph>
      </div>

      {/* Summary Statistics */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Dados de Qualidade a Longo Prazo"
              value={longTermQualityTransects}
              valueStyle={{ color: "#1890ff" }}
              suffix={`transectos`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={`Ativos em ${mostRecentYear || "—"}`}
              value={transectsInLastSeason}
              valueStyle={{ color: "#52c41a" }}
              suffix="transectos"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Popover
              content={
                <div style={{ maxHeight: 400, overflowY: "auto", width: 300 }}>
                  <List
                    size="small"
                    header={<strong>Espécies Registadas ({totalUniqueSpecies})</strong>}
                    dataSource={uniqueSpeciesList}
                    renderItem={item => (
                      <List.Item style={{ padding: "4px 0" }}>
                        <Typography.Text style={{ fontSize: 12, fontStyle: "italic" }}>
                          {item}
                        </Typography.Text>
                      </List.Item>
                    )}
                  />
                </div>
              }
              title="Lista Completa de Espécies"
              trigger="click"
              placement="bottom"
            >
              <div style={{ cursor: "pointer" }}>
                <Statistic
                  title={
                    <span>
                      Espécies Registadas <InfoCircleOutlined style={{ fontSize: 12 }} />
                    </span>
                  }
                  value={totalUniqueSpecies}
                  valueStyle={{ color: "#722ed1" }}
                />
              </div>
            </Popover>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={`Ganhos/Perdidos em ${mostRecentYear || "—"}`}
              value={0}
              formatter={() => (
                <span>
                  <span style={{ color: "#52c41a" }}>+{transectsGained}</span>
                  <span style={{ color: "#8c8c8c", margin: "0 4px" }}>/</span>
                  <span style={{ color: "#ff4d4f" }}>-{transectsLost}</span>
                </span>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Search and Column Configuration */}
      <Space>
        <Input
          placeholder="Procurar por nome do transecto..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 400 }}
          allowClear
        />
        <Dropdown menu={columnConfigMenu} trigger={["click"]} placement="bottomRight">
          <Button icon={<SettingOutlined />}>Configurar Colunas</Button>
        </Dropdown>
      </Space>

      {/* Table */}
      <Table
        columns={visibleColumnsArray}
        dataSource={filteredData}
        rowKey="transectId"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} transectos`,
        }}
        scroll={{ x: 1500 }}
        size="small"
        onChange={(pagination, filters) => {
          // Update pagination state
          if (pagination.current) setCurrentPage(pagination.current);
          if (pagination.pageSize) {
            setPageSize(pagination.pageSize);
            setCurrentPage(1); // Reset to first page when page size changes
          }

          // Update yearsActive filters when they change
          if (filters.yearsActive) {
            setYearsActiveFilters(filters.yearsActive as (string | number)[]);
            setCurrentPage(1); // Reset to first page when filters change
          } else if (filters.yearsActive === null) {
            setYearsActiveFilters([]);
            setCurrentPage(1); // Reset to first page when filters are cleared
          }
        }}
      />

      {/* Warning about filtered species */}
      {metadata && metadata.filteredSpeciesCount > 0 && (
        <Alert
          message={
            <span>
              <WarningOutlined /> Registos Ignorados
            </span>
          }
          description={
            <span>
              {metadata.filteredSpeciesCount} espécie(s) foram ignoradas por não estarem na lista
              de espécies válidas.{" "}
              <Popover
                content={
                  <div style={{ maxHeight: 400, overflowY: "auto", width: 300 }}>
                    <List
                      size="small"
                      header={
                        <strong>Espécies Ignoradas ({metadata.filteredSpeciesCount})</strong>
                      }
                      dataSource={metadata.filteredSpecies}
                      renderItem={item => (
                        <List.Item style={{ padding: "4px 0" }}>
                          <Typography.Text style={{ fontSize: 12, fontStyle: "italic" }}>
                            {item}
                          </Typography.Text>
                        </List.Item>
                      )}
                    />
                  </div>
                }
                title="Espécies Não Válidas"
                trigger="click"
                placement="top"
              >
                <Typography.Link style={{ cursor: "pointer" }}>
                  Clique para ver a lista completa
                </Typography.Link>
              </Popover>
            </span>
          }
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Space>
  );
}

export default ButterflyTransects;
