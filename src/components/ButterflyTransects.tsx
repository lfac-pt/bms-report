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
  Divider,
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
import { groupSpeciesByFamily } from "../utils/speciesFamilies";
import TransectMap from "./TransectMap";

const { Title } = Typography;

// Component for species list with search and family grouping
function SpeciesList({
  species,
  title,
}: {
  species: string[];
  title: string;
}) {
  const [searchText, setSearchText] = useState("");

  // Filter species based on search
  const filteredSpecies = species.filter(s =>
    s.toLowerCase().includes(searchText.toLowerCase())
  );

  // Group by family
  const groupedSpecies = groupSpeciesByFamily(filteredSpecies);
  const families = Object.keys(groupedSpecies).sort();

  return (
    <div style={{ width: 350 }}>
      <Input
        placeholder="Procurar espécie..."
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        style={{ marginBottom: 12 }}
        allowClear
      />
      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        <strong style={{ display: "block", marginBottom: 8 }}>
          {title} ({filteredSpecies.length})
        </strong>
        {families.map(family => (
          <div key={family} style={{ marginBottom: 12 }}>
            <Typography.Text strong style={{ fontSize: 12, color: "#595959" }}>
              {family} ({groupedSpecies[family].length})
            </Typography.Text>
            <Divider style={{ margin: "4px 0" }} />
            <List
              size="small"
              dataSource={groupedSpecies[family]}
              renderItem={item => (
                <List.Item style={{ padding: "2px 0", border: "none" }}>
                  <Typography.Text style={{ fontSize: 11, fontStyle: "italic" }}>
                    {item}
                  </Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ButterflyTransects() {
  const [data, setData] = useState<TransectStats[]>([]);
  const [metadata, setMetadata] = useState<ProcessingMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [yearsActiveFilters, setYearsActiveFilters] = useState<(string | number)[]>([]);
  const [avgVisitsPerYearFilters, setAvgVisitsPerYearFilters] = useState<string[]>([]);
  const [concelhoFilters, setConcelhoFilters] = useState<string[]>([]);
  const [distritoFilters, setDistritoFilters] = useState<string[]>([]);
  const [entidadeFilters, setEntidadeFilters] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Column visibility state - Entidade, Concelho, Distrito, and Visitas hidden by default
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    transectName: true,
    totalSpecies: true,
    totalVisits: false, // Hidden by default
    avgVisitsPerYear: true,
    avgButterfliesPerVisit: true,
    yearsActive: true,
    entidade: false, // Hidden by default
    concelho: false, // Hidden by default
    distrito: false, // Hidden by default
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

  // Filter data based on search and all active filters
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

    // Concelho filter
    if (concelhoFilters.length > 0) {
      if (!concelhoFilters.includes(transect.concelho)) {
        return false;
      }
    }

    // Distrito filter
    if (distritoFilters.length > 0) {
      if (!distritoFilters.includes(transect.distrito)) {
        return false;
      }
    }

    // Entidade filter
    if (entidadeFilters.length > 0) {
      if (!entidadeFilters.includes(transect.entidade)) {
        return false;
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

  // Calculate totals across all transects
  const totalButterflies = data.reduce((sum, t) => sum + t.totalAbundance, 0);
  const totalVisitsAll = data.reduce((sum, t) => sum + t.totalVisits, 0);

  const columns: ColumnsType<TransectStats> = [
    {
      title: "Transecto",
      dataIndex: "transectName",
      key: "transectName",
      fixed: "left",
      width: 120,
      sorter: (a, b) => a.transectName.localeCompare(b.transectName),
      defaultSortOrder: "ascend",
    },
    {
      title: "Espécies",
      dataIndex: "totalSpecies",
      key: "totalSpecies",
      width: 60,
      align: "right",
      sorter: (a, b) => a.totalSpecies - b.totalSpecies,
      render: (totalSpecies: number, record: TransectStats) => (
        <Popover
          content={<SpeciesList species={record.speciesList} title="Espécies" />}
          title={`Espécies em ${record.transectName}`}
          trigger="click"
          placement="right"
        >
          <span style={{ cursor: "pointer", color: "#1890ff" }}>
            {totalSpecies} <InfoCircleOutlined style={{ fontSize: 10 }} />
          </span>
        </Popover>
      ),
    },
    {
      title: "Visitas",
      dataIndex: "totalVisits",
      key: "totalVisits",
      width: 60,
      align: "right",
      sorter: (a, b) => a.totalVisits - b.totalVisits,
    },
    {
      title: "Visitas/Ano",
      dataIndex: "avgVisitsPerYear",
      key: "avgVisitsPerYear",
      width: 80,
      align: "right",
      sorter: (a, b) => a.avgVisitsPerYear - b.avgVisitsPerYear,
      render: (value: number) => value.toFixed(1),
      filters: [
        { text: "Mais de 10", value: ">10" },
      ],
      filteredValue: avgVisitsPerYearFilters,
      onFilter: (value, record) => {
        if (value === ">10") return record.avgVisitsPerYear > 10;
        return true;
      },
    },
    {
      title: "Borbole./Visita",
      dataIndex: "avgButterfliesPerVisit",
      key: "avgButterfliesPerVisit",
      width: 80,
      align: "right",
      sorter: (a, b) => a.avgButterfliesPerVisit - b.avgButterfliesPerVisit,
      render: (value: number) => value.toFixed(1),
    },
    {
      title: "Anos Ativos",
      dataIndex: "yearsActive",
      key: "yearsActive",
      width: 60,
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
      filteredValue: entidadeFilters,
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
      filteredValue: concelhoFilters,
    },
    {
      title: "Distrito",
      dataIndex: "distrito",
      key: "distrito",
      width: 150,
      filters: Array.from(new Set(data.map(t => t.distrito)))
        .filter(d => d)
        .sort()
        .map(d => ({ text: d, value: d })),
      filteredValue: distritoFilters,
    },
  ];

  // Filter columns based on visibility
  const visibleColumnsArray = columns.filter(col => {
    const key = col.key as string;
    return visibleColumns[key] !== false;
  });

  // Default visible columns (for determining if horizontal scroll is needed)
  const defaultVisibleColumns = ['transectName', 'totalSpecies', 'avgVisitsPerYear', 'avgButterfliesPerVisit', 'yearsActive'];

  // Count extra columns beyond the default
  const extraColumnsVisible = Object.keys(visibleColumns).filter(
    key => visibleColumns[key] && !defaultVisibleColumns.includes(key)
  ).length;

  // Only enable horizontal scroll when extra columns are visible
  const tableScroll = extraColumnsVisible > 0 ? { x: 'max-content' } : undefined;

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
    distrito: "Distrito",
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
          <BarChartOutlined /> Estatísticas BMS Diurnas Portugal
        </Title>
      </div>

      {/* Summary Statistics */}
      <Row gutter={16}>
        <Col span={4}>
          <Card>
            <Statistic
              title="Dados de Qualidade a Longo Prazo"
              value={longTermQualityTransects}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title={`Ativos em ${mostRecentYear || "—"}`}
              value={transectsInLastSeason}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Popover
              content={<SpeciesList species={uniqueSpeciesList} title="Espécies Registadas" />}
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
        <Col span={4}>
          <Card>
            <Statistic
              title={`Transetos Ganhos/Perdidos em ${mostRecentYear || "—"}`}
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
        <Col span={4}>
          <Card>
            <Statistic
              title="Total de Borboletas Contadas"
              value={totalButterflies}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total de Visitas"
              value={totalVisitsAll}
              valueStyle={{ color: "#13c2c2" }}
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

      {/* Table and Map Side by Side */}
      <Row gutter={16}>
        <Col span={16}>
          <Table
        columns={visibleColumnsArray}
        dataSource={filteredData}
        rowKey="transectId"
        loading={loading}
        scroll={tableScroll}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} transectos`,
        }}
        size="small"
        onChange={(pagination, filters) => {
          // Track if any filters actually changed
          let filtersChanged = false;

          // Update all filter states and check if they changed
          if (filters.yearsActive !== undefined) {
            const newFilters = filters.yearsActive ? (filters.yearsActive as (string | number)[]) : [];
            const changed = JSON.stringify(newFilters.sort()) !== JSON.stringify([...yearsActiveFilters].sort());
            if (changed) {
              setYearsActiveFilters(newFilters);
              filtersChanged = true;
            }
          }

          if (filters.avgVisitsPerYear !== undefined) {
            const newFilters = filters.avgVisitsPerYear ? (filters.avgVisitsPerYear as string[]) : [];
            const changed = JSON.stringify(newFilters.sort()) !== JSON.stringify([...avgVisitsPerYearFilters].sort());
            if (changed) {
              setAvgVisitsPerYearFilters(newFilters);
              filtersChanged = true;
            }
          }

          if (filters.concelho !== undefined) {
            const newFilters = filters.concelho ? (filters.concelho as string[]) : [];
            const changed = JSON.stringify(newFilters.sort()) !== JSON.stringify([...concelhoFilters].sort());
            if (changed) {
              setConcelhoFilters(newFilters);
              filtersChanged = true;
            }
          }

          if (filters.distrito !== undefined) {
            const newFilters = filters.distrito ? (filters.distrito as string[]) : [];
            const changed = JSON.stringify(newFilters.sort()) !== JSON.stringify([...distritoFilters].sort());
            if (changed) {
              setDistritoFilters(newFilters);
              filtersChanged = true;
            }
          }

          if (filters.entidade !== undefined) {
            const newFilters = filters.entidade ? (filters.entidade as string[]) : [];
            const changed = JSON.stringify(newFilters.sort()) !== JSON.stringify([...entidadeFilters].sort());
            if (changed) {
              setEntidadeFilters(newFilters);
              filtersChanged = true;
            }
          }

          // Update pagination state
          if (pagination.pageSize && pagination.pageSize !== pageSize) {
            setPageSize(pagination.pageSize);
            setCurrentPage(1); // Reset to first page when page size changes
          } else if (filtersChanged) {
            setCurrentPage(1); // Reset to first page when filters change
          } else if (pagination.current) {
            setCurrentPage(pagination.current); // Update page normally
          }
        }}
      />
        </Col>
        <Col span={8}>
          <TransectMap transects={filteredData} />
        </Col>
      </Row>

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
