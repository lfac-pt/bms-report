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

  // Column visibility state - Entidade and Concelho hidden by default
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    transectName: true,
    totalSpecies: true,
    totalVisits: true,
    avgVisitsPerYear: true,
    avgButterfliesPerVisit: true,
    yearsActive: true,
    entidade: false, // Hidden by default
    lastMonitoringYear: true,
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

  // Filter data based on search
  const filteredData = data.filter(transect =>
    transect.transectName.toLowerCase().includes(searchText.toLowerCase())
  );

  // Calculate summary statistics
  const totalTransects = data.length;
  const activeTransects = data.filter(t => t.isActive).length;
  const totalVisits = data.reduce((sum, t) => sum + t.totalVisits, 0);

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
      width: 160,
      align: "right",
      render: (yearsActive: number, record: TransectStats) =>
        record.firstMonitoringYear ? `${yearsActive} (${record.firstMonitoringYear})` : yearsActive,
      filters: Array.from(new Set(data.map(t => t.yearsActive)))
        .sort((a, b) => b - a)
        .map(years => ({ text: years.toString(), value: years })),
      onFilter: (value, record) => record.yearsActive === value,
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
      title: "Última Temporada",
      dataIndex: "lastMonitoringYear",
      key: "lastMonitoringYear",
      width: 150,
      align: "right",
      filters: Array.from(new Set(data.map(t => t.lastMonitoringYear).filter(y => y !== null)))
        .sort((a, b) => (b as number) - (a as number))
        .map(year => ({ text: year!.toString(), value: year as number })),
      onFilter: (value, record) => record.lastMonitoringYear === value,
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
    lastMonitoringYear: "Última Temporada",
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
          Dados pré-processados de {totalTransects} transectos válidos do projeto EBMS Portugal.
          Apenas transectos com estado &quot;Válido&quot; estão incluídos.
        </Typography.Paragraph>
      </div>

      {/* Summary Statistics */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total de Transectos"
              value={totalTransects}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Transectos Ativos"
              value={activeTransects}
              valueStyle={{ color: "#52c41a" }}
              suffix={`/ ${totalTransects}`}
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
              title="Total de Visitas"
              value={totalVisits}
              valueStyle={{ color: "#fa8c16" }}
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
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} transectos`,
        }}
        scroll={{ x: 1500 }}
        size="small"
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
