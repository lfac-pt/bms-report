import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Space,
  Typography,
  Button,
  Row,
  Col,
  Card,
  Statistic,
  Popover,
  List,
  Alert,
  Tooltip,
  Collapse,
} from "antd";
import { ArrowLeftOutlined, InfoCircleOutlined, CloseCircleOutlined, GithubOutlined } from "@ant-design/icons";
import { GBIData, RegionalGBICollection } from "../types/gbiData";
import { TransectData } from "../types/transectStats";
import GrasslandButterflyIndex from "./charts/GrasslandButterflyIndex";
import SpeciesLink from "./SpeciesLink";
import { GRASSLAND_SPECIES, getTrendColor, getTrendLabel, MIN_YEARS_ACTIVE, MIN_VISITS_PER_YEAR, MONITORING_START_MONTH, MONITORING_END_MONTH, BASELINE_YEAR } from "../constants";

const { Text, Paragraph, Title } = Typography;

// Flight curves data type (minimal interface for what we need)
interface FlightCurvesData {
  species: Record<
    string,
    {
      collatedIndices: Record<number, number>;
      confidenceIntervals?: Record<
        number,
        {
          ci_lower: number | null;
          ci_upper: number | null;
        }
      >;
      trendClassification?: {
        category: string;
      };
    }
  >;
}

function GBIPage() {
  const navigate = useNavigate();
  const [gbiData, setGbiData] = useState<GBIData | null>(null);
  const [transectData, setTransectData] = useState<TransectData | null>(null);
  const [flightCurvesData, setFlightCurvesData] = useState<FlightCurvesData | null>(null);
  const [regionalGBIData, setRegionalGBIData] = useState<RegionalGBICollection | null>(null);
  const [loading, setLoading] = useState(true);

  // Load GBI data, transect data, flight curves data, and regional GBI data
  useEffect(() => {
    Promise.all([
      // eslint-disable-next-line no-undef
      fetch("data/gbi-data.json").then(res => res.json()),
      // eslint-disable-next-line no-undef
      fetch("data/processed-transects.json").then(res => res.json()),
      // eslint-disable-next-line no-undef
      fetch("data/flight-curves-data.json").then(res => res.json()),
      // eslint-disable-next-line no-undef
      fetch("data/regional-gbi-data.json")
        .then(res => res.json())
        .catch(() => null), // Optional: regional data may not exist yet
    ])
      .then(([gbi, transects, flightCurves, regionalGBI]) => {
        setGbiData(gbi);
        setTransectData(transects);
        setFlightCurvesData(flightCurves);
        setRegionalGBIData(regionalGBI);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleGoBack = () => {
    navigate("/transects");
  };

  const speciesCount = gbiData?.metadata?.grasslandSpecies?.length || 0;
  const transectCount = gbiData?.metadata?.transectsUsed?.length || 0;

  // Create a mapping from transectId to transectName
  const transectIdToName: Record<string, string> = {};
  if (transectData) {
    transectData.transects.forEach(t => {
      transectIdToName[t.transectId] = t.transectName;
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={handleGoBack}>
          Voltar
        </Button>
      </div>

      <Alert
        message="Índice de Borboletas de Prados (GBI)"
        description={
          gbiData ? (
            <>
              Este índice rastreia a saúde das populações de borboletas de pastagens em Portugal
              usando uma média geométrica de tendências log-lineares de {speciesCount} espécies (
              {gbiData.metadata.grasslandSpecies.filter((s: any) => s.type === "widespread").length}{" "}
              generalistas,{" "}
              {gbiData.metadata.grasslandSpecies.filter((s: any) => s.type === "specialist").length}{" "}
              especialistas) de {transectCount} transectos de alta qualidade. Ano base{" "}
              {gbiData.metadata.baselineYear} = 100. Os valores acima de 100 indicam crescimento
              populacional; abaixo de 100 indicam declínio.
            </>
          ) : (
            "A carregar informação..."
          )
        }
        type="info"
        showIcon
      />

      <Row gutter={16}>
        <Col span={8}>
          <Card loading={loading}>
            {gbiData?.gbiTrend ? (
              <Tooltip
                title={
                  <div>
                    <div>
                      Taxa anual: {gbiData.gbiTrend.pc1.toFixed(1)}% [
                      {gbiData.gbiTrend.pc1CI.lower.toFixed(1)}%,{" "}
                      {gbiData.gbiTrend.pc1CI.upper.toFixed(1)}%]
                    </div>
                    <div>
                      Mudança total: {gbiData.gbiTrend.pcn.toFixed(1)}% [
                      {gbiData.gbiTrend.pcnCI.lower.toFixed(1)}%,{" "}
                      {gbiData.gbiTrend.pcnCI.upper.toFixed(1)}%]
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>
                      Classificação baseada em intervalos de confiança de 95% da taxa de mudança
                      anual
                    </div>
                  </div>
                }
              >
                <div style={{ cursor: "help" }}>
                  <Statistic
                    title={
                      <span>
                        Tendência <InfoCircleOutlined style={{ fontSize: 12 }} />
                      </span>
                    }
                    value={`${getTrendLabel(gbiData.gbiTrend.category)} (${gbiData.gbiTrend.pc1.toFixed(1)}%/ano)`}
                    valueStyle={{
                      color: getTrendColor(gbiData.gbiTrend.category),
                    }}
                  />
                </div>
              </Tooltip>
            ) : (
              <Statistic title="Tendência" value="N/A" />
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Popover
              content={
                <div style={{ maxWidth: 400, maxHeight: 400, overflowY: "auto" }}>
                  {/* Get included species from GBI metadata */}
                  {(() => {
                    const includedSpeciesNames = new Set(
                      gbiData?.metadata?.grasslandSpecies?.map(s => s.scientificName) || []
                    );

                    // Get all species sorted, with inclusion status
                    const widespreadAll = [...GRASSLAND_SPECIES.widespread].sort();
                    const specialistAll = [...GRASSLAND_SPECIES.specialist].sort();

                    const widespreadIncludedCount = widespreadAll.filter(s =>
                      includedSpeciesNames.has(s)
                    ).length;
                    const specialistIncludedCount = specialistAll.filter(s =>
                      includedSpeciesNames.has(s)
                    ).length;

                    return (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <Typography.Text
                            strong
                            style={{ display: "block", marginBottom: 8, color: "#52c41a" }}
                          >
                            Generalistas ({widespreadIncludedCount} de{" "}
                            {GRASSLAND_SPECIES.widespread.size})
                          </Typography.Text>
                          <List
                            size="small"
                            dataSource={widespreadAll}
                            renderItem={species => {
                              const isIncluded = includedSpeciesNames.has(species);
                              return (
                                <List.Item style={{ padding: "4px 0" }}>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: isIncluded ? "inherit" : "#8c8c8c",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    {!isIncluded && (
                                      <CloseCircleOutlined
                                        style={{ color: "#ff4d4f", fontSize: 12 }}
                                      />
                                    )}
                                    <SpeciesLink species={species} />
                                  </div>
                                </List.Item>
                              );
                            }}
                          />
                        </div>
                        <div>
                          <Typography.Text
                            strong
                            style={{ display: "block", marginBottom: 8, color: "#1890ff" }}
                          >
                            Especialistas ({specialistIncludedCount} de{" "}
                            {GRASSLAND_SPECIES.specialist.size})
                          </Typography.Text>
                          <List
                            size="small"
                            dataSource={specialistAll}
                            renderItem={species => {
                              const isIncluded = includedSpeciesNames.has(species);
                              return (
                                <List.Item style={{ padding: "4px 0" }}>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: isIncluded ? "inherit" : "#8c8c8c",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    {!isIncluded && (
                                      <CloseCircleOutlined
                                        style={{ color: "#ff4d4f", fontSize: 12 }}
                                      />
                                    )}
                                    <SpeciesLink species={species} />
                                  </div>
                                </List.Item>
                              );
                            }}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              }
              title="Espécies de Pastagens"
              trigger="click"
              placement="bottom"
            >
              <div style={{ cursor: "pointer" }}>
                <Statistic
                  title={
                    <span>
                      Espécies <InfoCircleOutlined style={{ fontSize: 12 }} />
                    </span>
                  }
                  value={speciesCount}
                  suffix={`de ${GRASSLAND_SPECIES.widespread.size + GRASSLAND_SPECIES.specialist.size}`}
                />
              </div>
            </Popover>
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Popover
              content={
                <div style={{ maxWidth: 400, maxHeight: 400, overflowY: "auto" }}>
                  <Typography.Text
                    style={{ fontSize: 12, color: "#8c8c8c", display: "block", marginBottom: 8 }}
                  >
                    Critérios: {MIN_YEARS_ACTIVE}+ anos ativos, {MIN_VISITS_PER_YEAR}+ visitas/ano
                  </Typography.Text>
                  <List
                    size="small"
                    dataSource={gbiData?.metadata?.transectsUsed || []}
                    renderItem={transect => (
                      <List.Item style={{ padding: "4px 0" }}>
                        <Typography.Text style={{ fontSize: 12 }}>
                          {transectIdToName[transect.transectId] || transect.transectId}
                        </Typography.Text>
                      </List.Item>
                    )}
                  />
                </div>
              }
              title="Transectos Utilizados no GBI"
              trigger="click"
              placement="bottom"
            >
              <div style={{ cursor: "pointer" }}>
                <Statistic
                  title={
                    <span>
                      Transectos <InfoCircleOutlined style={{ fontSize: 12 }} />
                    </span>
                  }
                  value={transectCount}
                  suffix="qualificados"
                />
              </div>
            </Popover>
          </Card>
        </Col>
      </Row>

      <GrasslandButterflyIndex
        gbiData={gbiData}
        flightCurvesData={flightCurvesData}
        regionalGBIData={regionalGBIData}
        loading={loading}
      />

      <Collapse
        items={[
          {
            key: "metodologia",
            label: "Metodologia",
            children: (
              <div style={{ maxWidth: 900 }}>
                <Paragraph>
                  O Índice de Borboletas de Prados (GBI) é calculado seguindo a metodologia
                  europeia padronizada para indicadores de biodiversidade, utilizando a biblioteca{" "}
                  <Text code>rbms</Text> em R. Todos os índices são normalizados ao ano base de{" "}
                  <Text strong>{BASELINE_YEAR}</Text> (índice = 100).
                </Paragraph>

                <Title level={5}>1. Filtragem de Dados e Controlo de Qualidade</Title>
                <Paragraph>
                  Apenas transectos de alta qualidade são incluídos no cálculo. Os critérios são:
                </Paragraph>
                <ul>
                  <li>
                    Mínimo de <Text strong>{MIN_YEARS_ACTIVE} anos ativos</Text> de monitorização
                  </li>
                  <li>
                    Média de <Text strong>{MIN_VISITS_PER_YEAR}+ visitas por ano</Text>
                  </li>
                  <li>
                    Época de monitorização:{" "}
                    <Text strong>
                      {new Date(2000, MONITORING_START_MONTH - 1).toLocaleString("pt-PT", {
                        month: "long",
                      })}{" "}
                      a{" "}
                      {new Date(2000, MONITORING_END_MONTH - 1).toLocaleString("pt-PT", {
                        month: "long",
                      })}
                    </Text>
                  </li>
                </ul>
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  <a
                    href="https://github.com/lfac-pt/bms-report/blob/main/src/constants.ts"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GithubOutlined /> Ver critérios no código fonte
                  </a>
                </Paragraph>

                <Title level={5}>2. Curva de Voo (GAM)</Title>
                <Paragraph>
                  Para cada espécie e região climática, é calculada uma curva de voo sazonal usando
                  Modelos Aditivos Generalizados (GAM) com distribuição binomial negativa. Esta
                  curva modela a fenologia da espécie ao longo da época.
                </Paragraph>
                <pre
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 11,
                    overflow: "auto",
                  }}
                >
                  {`rbms::flight_curve(
  region_data,
  NbrSample = 300,       # Número de amostras para GAM
  MinVisit = 3,          # Mínimo de visitas
  MinOccur = 1,          # Mínimo de ocorrências
  MinNbrSite = 1,        # Mínimo de transectos
  MaxTrial = 4,          # Máximo de tentativas
  GamFamily = 'nb',      # Distribuição binomial negativa
  SpeedGam = FALSE,      # GAM completo (não rápido)
  CompltSeason = TRUE,   # Época completa
  TimeUnit = 'w'         # Unidade temporal: semana
)`}
                </pre>

                <Title level={5}>3. Imputação de Dados em Falta</Title>
                <Paragraph>
                  Utilizando as curvas de voo regionais, os dados em falta são imputados para
                  semanas não visitadas durante a época de monitorização. Isto permite estimar a
                  abundância total anual mesmo com amostragem incompleta. A imputação é feita por
                  região, usando a curva de voo específica de cada região climática.
                </Paragraph>
                <pre
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 11,
                    overflow: "auto",
                  }}
                >
                  {`# Imputação regional - para cada região climática
rbms::impute_count(
  ts_season_count = region_data,      # Contagens da região
  ts_flight_curve = regional_fc,      # Curva de voo regional
  YearLimit = NULL,                   # Sem limite de anos
  TimeUnit = "w"                      # Unidade temporal: semana
)`}
                </pre>

                <Title level={5}>4. Cálculo do Índice (GLM)</Title>
                <Paragraph>
                  Os índices de abundância por transecto são normalizados pelo comprimento do
                  transecto (para equivalentes de 1 km) e depois agregados usando um Modelo Linear
                  Generalizado (GLM) ponderado para obter o índice colacionado por ano.
                </Paragraph>
                <pre
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 11,
                    overflow: "auto",
                  }}
                >
                  {`# Cálculo de índices por transecto
rbms::site_index(
  butterfly_count = ts_season_count,
  MinFC = 0.10           # Mínimo de curva de voo (10%)
)

# Normalização por comprimento do transecto
site_indices$SINDEX <- site_indices$SINDEX / site_indices$length_km

# Índice colacionado com GLM ponderado
rbms::collated_index(
  data = site_indices,
  s_sp = species_name,   # Nome da espécie
  bootID = i,            # ID da iteração bootstrap
  boot_ind = bootsample, # Amostra bootstrap
  glm_weights = TRUE,    # Usar pesos no GLM
  rm_zero = TRUE         # Remover zeros
)`}
                </pre>

                <Title level={5}>5. Intervalos de Confiança (Bootstrap)</Title>
                <Paragraph>
                  A incerteza é quantificada através de 500 iterações de bootstrap. Para cada
                  amostra bootstrap, todo o pipeline de cálculo do índice é recalculado,
                  permitindo estimar intervalos de confiança de 95% para os índices anuais através
                  dos percentis 2.5% e 97.5% das distribuições bootstrap.
                </Paragraph>
                <pre
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 11,
                    overflow: "auto",
                  }}
                >
                  {`# Gerar amostras bootstrap
set.seed(218795)  # Para reprodutibilidade
bootsample <- rbms::boot_sample(
  site_indices,
  boot_n = 500                        # 500 iterações bootstrap
)

# Calcular índice para cada amostra bootstrap
for(i in c(0, seq_len(500))) {
  rbms::collated_index(
    data = site_indices,
    bootID = i,                       # ID da iteração (0 = original)
    boot_ind = bootsample,            # Amostra bootstrap
    glm_weights = TRUE,
    rm_zero = TRUE
  )
}`}
                </pre>

                <Title level={5}>6. Agregação Multi-Espécie (GBI)</Title>
                <Paragraph>
                  Após calcular índices para cada espécie de pastagem (generalistas e
                  especialistas), estes são combinados num único indicador multi-espécie usando a
                  média geométrica. Este método, recomendado pela UE, trata todas as espécies de
                  forma equitativa e é robusto a valores extremos.
                </Paragraph>
                <pre
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 11,
                    overflow: "auto",
                  }}
                >
                  {`# Centrar espécies em log-espaço para comparabilidade
co_index[, LOGDENSITY := log10(COL_INDEX)]
co_index[, TRMOBS := LOGDENSITY - mean(LOGDENSITY) + 2,
         by = .(SPECIES, BOOTi)]

# Média geométrica das espécies
geomean <- function(x) exp(mean(log(x), na.rm = TRUE))

# Calcular indicador multi-espécie
indicator_func(
  data.table::dcast(co_index, year ~ SPECIES, value.var = "TRMOBS100")
)`}
                </pre>

                <Title level={5}>7. Suavização LOESS e Intervalos de Confiança</Title>
                <Paragraph>
                  O índice multi-espécie é suavizado usando regressão LOESS (span = 0.75, grau 2)
                  para reduzir variação de curto prazo. Os intervalos de confiança de 95% são
                  calculados a partir dos percentis 2.5% e 97.5% das 500 distribuições bootstrap
                  suavizadas.
                </Paragraph>
                <pre
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 11,
                    overflow: "auto",
                  }}
                >
                  {`# Suavização LOESS do indicador principal
loess_fit <- loess(
  indicator ~ year,
  span = 0.75,              # Suavização padrão UE
  degree = 2,               # Polinómio quadrático
  na.action = na.exclude
)
smoothed_indicator <- predict(loess_fit)

# Calcular IC 95% a partir dos bootstraps
ci_lower <- apply(
  smoothed_boot_indicators,
  1,                        # Por ano
  quantile,
  0.025                     # Percentil 2.5%
)
ci_upper <- apply(
  smoothed_boot_indicators,
  1,
  quantile,
  0.975                     # Percentil 97.5%
)`}
                </pre>

                <Title level={5}>8. Tendência Linear e Classificação</Title>
                <Paragraph>
                  A tendência do GBI é estimada ajustando um modelo linear aos índices suavizados
                  em escala logarítmica. A classificação da tendência baseia-se nos intervalos de
                  confiança de 95% da taxa anual de alteração:
                </Paragraph>
                <pre
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 11,
                    overflow: "auto",
                  }}
                >
                  {`# Tendência linear em log-espaço
lm_obj <- lm(log(smoothed_indicator) ~ year)
annual_rate <- exp(coef(lm_obj)[2])      # Taxa anual multiplicativa
pc1 <- 100 * (annual_rate - 1)           # Taxa anual percentual

# Calcular IC a partir dos bootstraps
boot_rates <- apply(boot_trends, 1, function(x) {
  exp(coef(lm(log(x) ~ year))[2])
})
rate_ci_lower <- quantile(boot_rates, 0.025)
rate_ci_upper <- quantile(boot_rates, 0.975)`}
                </pre>
                <ul>
                  <li>
                    <Text style={{ color: "#52c41a" }}>Aumento Forte:</Text> IC inferior &gt; 1.05
                  </li>
                  <li>
                    <Text style={{ color: "#95de64" }}>Aumento Moderado:</Text> IC inferior &gt;
                    1.0
                  </li>
                  <li>
                    <Text style={{ color: "#cf1322" }}>Declínio Forte:</Text> IC superior &lt; 0.95
                  </li>
                  <li>
                    <Text style={{ color: "#ff7875" }}>Declínio Moderado:</Text> IC superior &lt;
                    1.0
                  </li>
                  <li>
                    <Text style={{ color: "#1890ff" }}>Estável:</Text> IC contém 1.0 e não excede
                    ±5%
                  </li>
                  <li>
                    <Text style={{ color: "#8c8c8c" }}>Incerto:</Text> IC muito largo
                  </li>
                </ul>

                <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16 }}>
                  <a
                    href="https://github.com/lfac-pt/bms-report/blob/main/scripts/rbms-collated-index.R"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GithubOutlined /> Script R - índices por espécie
                  </a>
                  {" | "}
                  <a
                    href="https://github.com/lfac-pt/bms-report/blob/main/scripts/calculate-gbi.R"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GithubOutlined /> Script R - cálculo GBI
                  </a>
                  {" | "}
                  <a
                    href="https://github.com/RetoSchmucki/rbms"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GithubOutlined /> Documentação rbms
                  </a>
                </Paragraph>
              </div>
            ),
          },
        ]}
      />
    </Space>
  );
}

export default GBIPage;
