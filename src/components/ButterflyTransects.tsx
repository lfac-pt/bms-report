import { useState, useEffect } from "react";
import {
  Table,
  Tag,
  Input,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  Card,
  Popover,
  List,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { TransectStats } from "../types/transectStats";
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";

const { Title } = Typography;

function ButterflyTransects() {
  const [data, setData] = useState<TransectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    // Load processed transects data
    window
      .fetch("/data/processed-transects.json")
      .then(response => response.json())
      .then((jsonData: TransectStats[]) => {
        setData(jsonData);
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
      title: "Código",
      dataIndex: "transectCode",
      key: "transectCode",
      width: 150,
    },
    {
      title: "Estado",
      dataIndex: "isActive",
      key: "isActive",
      width: 120,
      render: (isActive: boolean) =>
        isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Ativo
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">
            Inativo
          </Tag>
        ),
      filters: [
        { text: "Ativo", value: true },
        { text: "Inativo", value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
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
      width: 130,
      align: "right",
      sorter: (a, b) => a.yearsActive - b.yearsActive,
    },
    {
      title: "Primeira Época",
      dataIndex: "firstMonitoringYear",
      key: "firstMonitoringYear",
      width: 140,
      align: "right",
      sorter: (a, b) => (a.firstMonitoringYear || 0) - (b.firstMonitoringYear || 0),
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
  ];

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

      {/* Search */}
      <Input
        placeholder="Procurar por nome do transecto..."
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        style={{ width: 400 }}
        allowClear
      />

      {/* Table */}
      <Table
        columns={columns}
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
    </Space>
  );
}

export default ButterflyTransects;
