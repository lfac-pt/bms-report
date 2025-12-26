import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { TimelineData } from "../types/timelineData";
import { GBIData } from "../types/gbiData";
import {
  SearchOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { groupSpeciesByFamily } from "../constants";
import TransectMap from "./TransectMap";
import TransectTimeline from "./TransectTimeline";
import SpeciesLink from "./SpeciesLink";
import GrasslandButterflyIndex from "./charts/GrasslandButterflyIndex";
import SpeciesTrendsSparklines from "./charts/SpeciesTrendsSparklines";
import MunicipalitySpeciesMap from "./charts/MunicipalitySpeciesMap";

const { Title } = Typography;

// Define the canonical family order
const FAMILY_ORDER = ["Hesperiidae", "Papilionidae", "Pieridae", "Nymphalidae", "Lycaenidae"];

// Component for species list with search and family grouping
function SpeciesList({ species, title }: { species: string[]; title: string }) {
  const [searchText, setSearchText] = useState("");

  // Filter species based on search
  const filteredSpecies = species.filter(s => s.toLowerCase().includes(searchText.toLowerCase()));

  // Group by family
  const groupedSpecies = groupSpeciesByFamily(filteredSpecies);
  const families = Object.keys(groupedSpecies).sort((a, b) => {
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
                  <div style={{ fontSize: 11 }}>
                    <SpeciesLink species={item} />
                  </div>
                </List.Item>
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Component for geographic coverage details
function GeographicCoverageDetails({
  concelhosWithTransects,
  distritosWithTransects,
  distritosWithoutTransects,
  totalConcelhos,
}: {
  concelhosWithTransects: string[];
  distritosWithTransects: string[];
  distritosWithoutTransects: string[];
  totalConcelhos: number;
}) {
  return (
    <div style={{ width: 400, maxHeight: 500, overflowY: "auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong style={{ display: "block", marginBottom: 8, color: "#1890ff" }}>
          Concelhos com Transectos Ativos ({concelhosWithTransects.length})
        </Typography.Text>
        <List
          size="small"
          dataSource={concelhosWithTransects}
          renderItem={item => (
            <List.Item style={{ padding: "4px 0", border: "none" }}>
              <Link
                to={`/municipality/${encodeURIComponent(item.toLowerCase())}`}
                style={{ fontSize: 12 }}
              >
                {item}
              </Link>
            </List.Item>
          )}
        />
        <Typography.Text style={{ fontSize: 11, color: "#8c8c8c", fontStyle: "italic" }}>
          {totalConcelhos - concelhosWithTransects.length} concelhos sem transectos ativos
        </Typography.Text>
      </div>

      <Divider />

      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong style={{ display: "block", marginBottom: 8, color: "#722ed1" }}>
          Distritos com Transectos Ativos ({distritosWithTransects.length})
        </Typography.Text>
        <List
          size="small"
          dataSource={distritosWithTransects}
          renderItem={item => (
            <List.Item style={{ padding: "4px 0", border: "none" }}>
              <Typography.Text style={{ fontSize: 12 }}>{item}</Typography.Text>
            </List.Item>
          )}
        />
      </div>

      {distritosWithoutTransects.length > 0 && (
        <>
          <Divider />
          <div>
            <Typography.Text strong style={{ display: "block", marginBottom: 8, color: "#ff4d4f" }}>
              Distritos sem Transectos Ativos ({distritosWithoutTransects.length})
            </Typography.Text>
            <List
              size="small"
              dataSource={distritosWithoutTransects}
              renderItem={item => (
                <List.Item style={{ padding: "4px 0", border: "none" }}>
                  <Typography.Text style={{ fontSize: 12 }}>{item}</Typography.Text>
                </List.Item>
              )}
            />
          </div>
        </>
      )}
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
  const [climaticRegionFilters, setClimaticRegionFilters] = useState<string[]>([]);
  const [entidadeFilters, setEntidadeFilters] = useState<string[]>([]);
  const [protectedAreaFilters, setProtectedAreaFilters] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Timeline data state
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(true);

  // GBI data state
  const [gbiData, setGbiData] = useState<GBIData | null>(null);
  const [gbiLoading, setGbiLoading] = useState(true);

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
      .fetch("data/processed-transects.json")
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

  useEffect(() => {
    // Load timeline data
    window
      .fetch("data/timeline-data.json")
      .then(response => response.json())
      .then((data: TimelineData) => {
        setTimelineData(data);
        setTimelineLoading(false);
      })
      .catch(() => {
        setTimelineLoading(false);
      });
  }, []);

  useEffect(() => {
    // Load GBI data
    window
      .fetch("data/gbi-data.json")
      .then(response => response.json())
      .then((data: GBIData) => {
        setGbiData(data);
        setGbiLoading(false);
      })
      .catch(() => {
        setGbiLoading(false);
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
      const hasNotLastSeason = yearsActiveFilters.includes("notLastSeason");
      const yearCounts = yearsActiveFilters.filter(
        f => f !== "lastSeason" && f !== "notLastSeason"
      ) as number[];

      const mostRecentYear = Math.max(
        ...data.map(t => t.lastMonitoringYear || 0).filter(y => y > 0)
      );

      // If "lastSeason" is selected, check if transect was active in the most recent year
      if (hasLastSeason) {
        if (transect.lastMonitoringYear !== mostRecentYear) {
          return false;
        }
      }

      // If "notLastSeason" is selected, check if transect was NOT active in the most recent year
      if (hasNotLastSeason) {
        if (transect.lastMonitoringYear === mostRecentYear) {
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

    // Climatic Region filter
    if (climaticRegionFilters.length > 0) {
      if (!climaticRegionFilters.includes(transect.climaticRegion)) {
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
  const mostRecentYear =
    data.length > 0
      ? Math.max(...data.map(t => t.lastMonitoringYear || 0).filter(y => y > 0))
      : null;

  // Transects active in last season
  const transectsInLastSeason = mostRecentYear
    ? data.filter(t => t.lastMonitoringYear === mostRecentYear).length
    : 0;

  // Transects gained (started in last season) and lost (active in year before last, but not in last)
  const transectsGainedList = mostRecentYear
    ? data.filter(t => t.firstMonitoringYear === mostRecentYear)
    : [];
  const transectsLostList = mostRecentYear
    ? data.filter(t => t.lastMonitoringYear === mostRecentYear - 1)
    : [];
  const transectsGained = transectsGainedList.length;
  const transectsLost = transectsLostList.length;

  // Calculate total unique species across all transects
  const allSpeciesSet = new Set<string>();
  data.forEach(transect => {
    transect.speciesList.forEach(species => allSpeciesSet.add(species));
  });
  const uniqueSpeciesList = Array.from(allSpeciesSet).sort();
  const totalUniqueSpecies = uniqueSpeciesList.length;

  // Calculate totals across all transects
  const totalButterfliesFiltered = filteredData.reduce((sum, t) => sum + t.totalAbundance, 0);
  const totalButterfliesValidSpecies = metadata?.totalButterfliesValidSpecies || 0;
  const totalButterfliesAllSpecies = metadata?.totalButterfliesAllSpecies || 0;
  const totalVisitsAll = data.reduce((sum, t) => sum + t.totalVisits, 0);

  // All distritos in mainland Portugal
  const allDistritosMainland = [
    "Aveiro",
    "Beja",
    "Braga",
    "Bragança",
    "Castelo Branco",
    "Coimbra",
    "Évora",
    "Faro",
    "Guarda",
    "Leiria",
    "Lisboa",
    "Portalegre",
    "Porto",
    "Santarém",
    "Setúbal",
    "Viana do Castelo",
    "Vila Real",
    "Viseu",
  ];

  // Calculate unique concelhos and distritos with transects active in last season
  const activeTransectsLastSeason = mostRecentYear
    ? data.filter(t => t.lastMonitoringYear === mostRecentYear)
    : [];
  const concelhosWithTransects = Array.from(
    new Set(activeTransectsLastSeason.map(t => t.concelho).filter(c => c))
  ).sort();
  const distritosWithTransects = Array.from(
    new Set(activeTransectsLastSeason.map(t => t.distrito).filter(d => d))
  ).sort();
  const distritosWithoutTransects = allDistritosMainland
    .filter(d => !distritosWithTransects.includes(d))
    .sort();

  const uniqueConcelhos = concelhosWithTransects.length;
  const uniqueDistritos = distritosWithTransects.length;
  const totalConcelhos = 278; // Total concelhos in mainland Portugal (excluding Azores and Madeira)
  const totalDistritos = 18; // Total distritos in mainland Portugal

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
        { text: "5 ou mais", value: ">=5" },
        { text: "Menos de 5", value: "<5" },
      ],
      filteredValue: avgVisitsPerYearFilters,
      onFilter: (value, record) => {
        if (value === ">=5") return record.avgVisitsPerYear >= 5;
        if (value === "<5") return record.avgVisitsPerYear < 5;
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
        {
          text: "Não ativos na última época",
          value: "notLastSeason",
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
    {
      title: "Região",
      dataIndex: "climaticRegion",
      key: "climaticRegion",
      width: 180,
      filters: Array.from(new Set(data.map(t => t.climaticRegion)))
        .filter(r => r)
        .sort()
        .map(r => ({ text: r, value: r })),
      filteredValue: climaticRegionFilters,
    },
    {
      title: "Área Protegida",
      dataIndex: "protectedArea",
      key: "protectedArea",
      width: 200,
      filters: [
        { text: "Dentro de áreas protegidas", value: "inside" },
        { text: "Fora de áreas protegidas", value: "outside" },
        ...Array.from(new Set(data.map(t => t.protectedArea)))
          .filter((p): p is string => p !== null && p !== "")
          .sort()
          .map(p => ({ text: p, value: p })),
      ],
      filteredValue: protectedAreaFilters,
      onFilter: (value, record) => {
        if (value === "inside") return record.protectedArea !== null;
        if (value === "outside") return record.protectedArea === null;
        return record.protectedArea === value;
      },
      render: (protectedArea: string | null) => protectedArea || "-",
    },
  ];

  // Filter columns based on visibility
  const visibleColumnsArray = columns.filter(col => {
    const key = col.key as string;
    return visibleColumns[key] !== false;
  });

  // Default visible columns (for determining if horizontal scroll is needed)
  const defaultVisibleColumns = [
    "transectName",
    "totalSpecies",
    "avgVisitsPerYear",
    "avgButterfliesPerVisit",
    "yearsActive",
  ];

  // Count extra columns beyond the default
  const extraColumnsVisible = Object.keys(visibleColumns).filter(
    key => visibleColumns[key] && !defaultVisibleColumns.includes(key)
  ).length;

  // Only enable horizontal scroll when extra columns are visible
  const tableScroll = extraColumnsVisible > 0 ? { x: "max-content" } : undefined;

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
    <Space direction="vertical" size="large" style={{ width: "100%", marginTop: 0 }}>
      <Title level={2}>
        <BarChartOutlined /> BMS Diurnas Portugal Continental
      </Title>

      {/* Summary Statistics */}
      <Row gutter={16}>
        <Col span={5}>
          <Card>
            <Popover
              content={
                <div style={{ maxWidth: 400, maxHeight: 400, overflowY: "auto" }}>
                  {transectsGainedList.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Typography.Text
                        strong
                        style={{ display: "block", marginBottom: 8, color: "#52c41a" }}
                      >
                        Transectos Ganhos ({transectsGained})
                      </Typography.Text>
                      <List
                        size="small"
                        dataSource={transectsGainedList}
                        renderItem={transect => (
                          <List.Item style={{ padding: "4px 0" }}>
                            {transect.transectName}
                          </List.Item>
                        )}
                      />
                    </div>
                  )}
                  {transectsLostList.length > 0 && (
                    <div>
                      <Typography.Text
                        strong
                        style={{ display: "block", marginBottom: 8, color: "#ff4d4f" }}
                      >
                        Transectos Perdidos ({transectsLost})
                      </Typography.Text>
                      <List
                        size="small"
                        dataSource={transectsLostList}
                        renderItem={transect => (
                          <List.Item style={{ padding: "4px 0" }}>
                            {transect.transectName}
                          </List.Item>
                        )}
                      />
                    </div>
                  )}
                  {transectsGainedList.length === 0 && transectsLostList.length === 0 && (
                    <Typography.Text type="secondary">
                      Sem alterações em relação ao ano anterior
                    </Typography.Text>
                  )}
                </div>
              }
              title="Alterações nos Transectos"
              trigger="click"
              placement="bottom"
            >
              <div style={{ cursor: "pointer" }}>
                <Statistic
                  title={
                    <span>
                      Transectos Ativos em {mostRecentYear || "—"}{" "}
                      <InfoCircleOutlined style={{ fontSize: 12 }} />
                    </span>
                  }
                  value={transectsInLastSeason}
                  valueStyle={{ color: "#52c41a" }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: "#8c8c8c" }}>
                  <span>Ganhos/Perdidos: </span>
                  <span style={{ color: "#52c41a" }}>+{transectsGained}</span>
                  <span style={{ margin: "0 4px" }}>/</span>
                  <span style={{ color: "#ff4d4f" }}>-{transectsLost}</span>
                </div>
              </div>
            </Popover>
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Popover
              content={
                <GeographicCoverageDetails
                  concelhosWithTransects={concelhosWithTransects}
                  distritosWithTransects={distritosWithTransects}
                  distritosWithoutTransects={distritosWithoutTransects}
                  totalConcelhos={totalConcelhos}
                />
              }
              title="Detalhes de Cobertura Geográfica"
              trigger="click"
              placement="bottom"
            >
              <div style={{ cursor: "pointer" }}>
                <Statistic
                  title={
                    <span>
                      Cobertura Geográfica <InfoCircleOutlined style={{ fontSize: 12 }} />
                    </span>
                  }
                  value={0}
                  formatter={() => (
                    <div>
                      <div
                        style={{
                          fontSize: 20,
                          lineHeight: 1.4,
                          display: "flex",
                          alignItems: "baseline",
                        }}
                      >
                        <span style={{ color: "#1890ff", fontWeight: 600 }}>{uniqueConcelhos}</span>
                        <span style={{ color: "#8c8c8c", fontWeight: 600, fontSize: 14 }}>
                          {" "}
                          / {totalConcelhos}
                        </span>
                        <span style={{ fontSize: 12, color: "#8c8c8c", marginLeft: 8 }}>
                          Concelhos
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 20,
                          lineHeight: 1.4,
                          marginTop: 8,
                          display: "flex",
                          alignItems: "baseline",
                        }}
                      >
                        <span style={{ color: "#722ed1", fontWeight: 600 }}>{uniqueDistritos}</span>
                        <span style={{ color: "#8c8c8c", fontWeight: 600, fontSize: 14 }}>
                          {" "}
                          / {totalDistritos}
                        </span>
                        <span style={{ fontSize: 12, color: "#8c8c8c", marginLeft: 8 }}>
                          Distritos
                        </span>
                      </div>
                    </div>
                  )}
                />
                <div style={{ marginTop: 8, fontSize: 11, color: "#8c8c8c", fontStyle: "italic" }}>
                  Apenas transectos ativos em {mostRecentYear || "—"}
                </div>
              </div>
            </Popover>
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
            <Popover
              content={
                <div>
                  <div>
                    <strong>Total (todas as espécies):</strong>{" "}
                    {totalButterfliesAllSpecies.toLocaleString()}
                  </div>
                  <div style={{ marginTop: 4, fontSize: "12px", color: "#666" }}>
                    Total (espécies válidas): {totalButterfliesValidSpecies.toLocaleString()}
                  </div>
                  {totalButterfliesFiltered !== totalButterfliesValidSpecies && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#666" }}>
                      Total (com filtros da tabela): {totalButterfliesFiltered.toLocaleString()}
                    </div>
                  )}
                </div>
              }
              title="Total de Borboletas"
              trigger="hover"
            >
              <div style={{ cursor: "pointer" }}>
                <Statistic
                  title={
                    <span>
                      Total de Borboletas Contadas <InfoCircleOutlined style={{ fontSize: 12 }} />
                    </span>
                  }
                  value={totalButterfliesValidSpecies}
                  valueStyle={{ color: "#fa8c16" }}
                />
              </div>
            </Popover>
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

      {/* Grassland Butterfly Index Chart */}
      <div style={{ marginTop: 24 }}>
        <GrasslandButterflyIndex gbiData={gbiData} loading={gbiLoading} />
      </div>

      {/* Species Trends Sparklines */}
      <div style={{ marginTop: 24 }}>
        <SpeciesTrendsSparklines />
      </div>

      {/* Municipality Species Map */}
      <div style={{ marginTop: 24 }}>
        <MunicipalitySpeciesMap />
      </div>

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
                const newFilters = filters.yearsActive
                  ? (filters.yearsActive as (string | number)[])
                  : [];
                const changed =
                  JSON.stringify(newFilters.sort()) !==
                  JSON.stringify([...yearsActiveFilters].sort());
                if (changed) {
                  setYearsActiveFilters(newFilters);
                  filtersChanged = true;
                }
              }

              if (filters.avgVisitsPerYear !== undefined) {
                const newFilters = filters.avgVisitsPerYear
                  ? (filters.avgVisitsPerYear as string[])
                  : [];
                const changed =
                  JSON.stringify(newFilters.sort()) !==
                  JSON.stringify([...avgVisitsPerYearFilters].sort());
                if (changed) {
                  setAvgVisitsPerYearFilters(newFilters);
                  filtersChanged = true;
                }
              }

              if (filters.concelho !== undefined) {
                const newFilters = filters.concelho ? (filters.concelho as string[]) : [];
                const changed =
                  JSON.stringify(newFilters.sort()) !== JSON.stringify([...concelhoFilters].sort());
                if (changed) {
                  setConcelhoFilters(newFilters);
                  filtersChanged = true;
                }
              }

              if (filters.distrito !== undefined) {
                const newFilters = filters.distrito ? (filters.distrito as string[]) : [];
                const changed =
                  JSON.stringify(newFilters.sort()) !== JSON.stringify([...distritoFilters].sort());
                if (changed) {
                  setDistritoFilters(newFilters);
                  filtersChanged = true;
                }
              }

              if (filters.climaticRegion !== undefined) {
                const newFilters = filters.climaticRegion
                  ? (filters.climaticRegion as string[])
                  : [];
                const changed =
                  JSON.stringify(newFilters.sort()) !==
                  JSON.stringify([...climaticRegionFilters].sort());
                if (changed) {
                  setClimaticRegionFilters(newFilters);
                  filtersChanged = true;
                }
              }

              if (filters.entidade !== undefined) {
                const newFilters = filters.entidade ? (filters.entidade as string[]) : [];
                const changed =
                  JSON.stringify(newFilters.sort()) !== JSON.stringify([...entidadeFilters].sort());
                if (changed) {
                  setEntidadeFilters(newFilters);
                  filtersChanged = true;
                }
              }

              if (filters.protectedArea !== undefined) {
                const newFilters = filters.protectedArea ? (filters.protectedArea as string[]) : [];
                const changed =
                  JSON.stringify(newFilters.sort()) !==
                  JSON.stringify([...protectedAreaFilters].sort());
                if (changed) {
                  setProtectedAreaFilters(newFilters);
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

      {/* Timeline Section */}
      {timelineData && (
        <TransectTimeline
          timelineData={timelineData}
          filteredTransects={filteredData}
          loading={timelineLoading}
        />
      )}

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
              {metadata.filteredSpeciesCount} espécie(s) foram ignoradas por não estarem na lista de
              espécies válidas.{" "}
              <Popover
                content={
                  <div style={{ maxHeight: 400, overflowY: "auto", width: 300 }}>
                    <List
                      size="small"
                      header={
                        <strong>
                          Espécies Ignoradas ({metadata.filteredSpeciesCount},{" "}
                          {metadata.filteredSpecies.reduce((sum, s) => sum + s.totalIndividuals, 0)}{" "}
                          indivíduos)
                        </strong>
                      }
                      dataSource={metadata.filteredSpecies}
                      renderItem={item => (
                        <List.Item style={{ padding: "4px 0" }}>
                          <Typography.Text style={{ fontSize: 12, fontStyle: "italic" }}>
                            {item.species} ({item.recordCount}{" "}
                            {item.recordCount === 1 ? "registo" : "registos"},{" "}
                            {item.totalIndividuals}{" "}
                            {item.totalIndividuals === 1 ? "indivíduo" : "indivíduos"})
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
              {metadata.correctedRecords && metadata.correctedRecords > 0 && (
                <>
                  <br />
                  <Popover
                    content={
                      <div style={{ maxWidth: 400 }}>
                        <Typography.Title level={5} style={{ marginTop: 0 }}>
                          Correções de Nomenclatura
                        </Typography.Title>
                        {metadata.corrections && metadata.corrections.length > 0 ? (
                          <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                            {metadata.corrections.map((correction, idx) => (
                              <li key={idx}>
                                <Typography.Text delete style={{ color: "#999" }}>
                                  {correction.from}
                                </Typography.Text>
                                {" → "}
                                <Typography.Text strong style={{ color: "#52c41a" }}>
                                  {correction.to}
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  {" "}
                                  ({correction.count}{" "}
                                  {correction.count === 1 ? "registo" : "registos"})
                                </Typography.Text>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <Typography.Text>Sem detalhes disponíveis</Typography.Text>
                        )}
                      </div>
                    }
                    title={null}
                    trigger="hover"
                  >
                    <Typography.Link type="success" style={{ cursor: "pointer" }}>
                      ✓ {metadata.correctedRecords}{" "}
                      {metadata.correctedRecords === 1
                        ? "registo foi corrigido"
                        : "registos foram corrigidos"}{" "}
                      (erros de nomenclatura)
                    </Typography.Link>
                  </Popover>
                </>
              )}
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
