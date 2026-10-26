import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Slider,
  Space,
  Spin,
  Statistic,
  Typography,
} from "antd";
import { Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";
import { calculateSpeciesPresenceByYear } from "../utils/speciesMapUtils";
import {
  MONTH_NAMES,
  RESULTS_YEAR,
  WAVE_SPECIES,
  monthlySpeciesAbundance,
  summarizeYear,
  timelineForMonth,
  timelineForWeek,
  monitoringWeeks,
} from "../utils/annualResults";
import "leaflet/dist/leaflet.css";

const { Title, Paragraph, Text } = Typography;
const WEEKS = monitoringWeeks(RESULTS_YEAR);
const COLORS = ["#8c8c8c", "#b37feb", "#36cfc9", "#597ef7", "#73d13d", "#ffc53d", "#eb2f96"];

export default function AnnualResultsPage() {
  const [data, setData] = useState<{ timeline: TimelineData; transects: TransectData } | null>(
    null
  );
  const [error, setError] = useState(false);
  const [week, setWeek] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [timeline, transects] = await Promise.all(
          ["timeline-data.json", "processed-transects.json"].map(async file => {
            const response = await window.fetch(`data/${file}`);
            if (!response.ok) throw new Error("Erro ao carregar dados");
            return response.json();
          })
        );
        if (!cancelled) setData({ timeline, transects });
      } catch {
        if (!cancelled) setError(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setWeek(current => (current + 1) % WEEKS.length);
    }, 700);
    return () => window.clearInterval(timer);
  }, [playing]);
  const weeklyTimeline = useMemo(
    () => (data ? timelineForWeek(data.timeline, RESULTS_YEAR, week) : null),
    [data, week]
  );
  if (error)
    return (
      <Alert
        type="error"
        showIcon
        message="Erro ao carregar os resultados"
        description="Tente carregar a página novamente."
      />
    );
  if (!data || !weeklyTimeline)
    return <Spin aria-label="A carregar resultados" style={{ display: "block", margin: 48 }} />;
  const current = summarizeYear(data.timeline, RESULTS_YEAR);
  const previous = summarizeYear(data.timeline, RESULTS_YEAR - 1);
  const markers = calculateSpeciesPresenceByYear(
    WAVE_SPECIES,
    RESULTS_YEAR,
    weeklyTimeline,
    data.transects.transects
  );
  const counts = new Map<string, number>();
  const visited = new Set<string>();
  Object.values(weeklyTimeline.observationsByYearDate[RESULTS_YEAR]).forEach(observations =>
    observations.forEach(([id, species, count]) => {
      visited.add(id);
      if (species === WAVE_SPECIES) counts.set(id, (counts.get(id) || 0) + count);
    })
  );
  const years = data.timeline.years.filter(year => year <= RESULTS_YEAR).sort((a, b) => a - b);
  const metrics = [
    ["Espécies observadas", "species"],
    ["Indivíduos contados", "individuals"],
    ["Visitas", "visits"],
    ["Transectos ativos", "transects"],
  ] as const;
  return (
    <Space direction="vertical" size="large" style={{ width: "100%", padding: "24px 0" }}>
      <div>
        <Link to="/transects">← Visão geral dos transectos</Link>
        <Title>Resultados de {RESULTS_YEAR}</Title>
        <Paragraph>
          Uma época de monitorização de borboletas em Portugal. Comparação com {RESULTS_YEAR - 1},
          de março a setembro, nos dois anos.
        </Paragraph>
      </div>
      {!current && (
        <Alert
          type="info"
          showIcon
          message="Ainda não existem dados de 2026"
          description="Os resultados serão apresentados quando os dados forem atualizados."
        />
      )}
      <Row gutter={[16, 16]}>
        {metrics.map(([title, key]) => (
          <Col xs={24} sm={12} xl={6} key={key}>
            <Card>
              <Statistic title={title} value={current ? current[key] : "—"} groupSeparator=" " />
              <Text type="secondary">
                {previous
                  ? `${previous[key].toLocaleString("pt-PT")} em 2025`
                  : "Sem dados de 2025"}
              </Text>
              <br />
              {current && previous && (
                <Text>
                  {current[key] - previous[key] > 0 ? "+" : ""}
                  {(current[key] - previous[key]).toLocaleString("pt-PT")}
                  {previous[key] > 0
                    ? ` (${((current[key] / previous[key] - 1) * 100).toFixed(1)}%)`
                    : ""}
                </Text>
              )}
            </Card>
          </Col>
        ))}
      </Row>
      <Paragraph type="secondary">
        Espécies: identificações válidas com contagens positivas. Indivíduos: todas as
        identificações, incluindo grupos não identificados à espécie. Uma visita corresponde a um
        transecto numa data; várias secções contam como uma visita. Transectos ativos: com registos
        nessa época. Os totais dependem dos dados submetidos e do esforço de amostragem.
      </Paragraph>
      <Card
        title={
          <span>
            A onda de <i>Vanessa cardui</i> em 2026
          </span>
        }
        extra={<Link to="/species/Vanessa%20cardui">Ver espécie</Link>}
      >
        <Row gutter={[24, 24]} align="middle" style={{ marginBottom: 32 }}>
          <Col xs={24} lg={12}>
            <figure style={{ margin: 0 }}>
              <img
                src="imgs/vanessa-cardui-swarm.jpg"
                alt="Várias Vanessa cardui a alimentar-se em flores roxas, entre outras borboletas."
                width={2048}
                height={1365}
                style={{ display: "block", width: "100%", height: "auto", borderRadius: 8 }}
              />
              <figcaption style={{ marginTop: 8 }}>
                <Text type="secondary">
                  <i>Vanessa cardui</i> em alimentação nas flores.
                </Text>
              </figcaption>
            </figure>
          </Col>
          <Col xs={24} lg={12}>
            <Title level={3}>Uma viagem entre continentes</Title>
            <Paragraph>
              A <i>Vanessa cardui</i> realiza uma migração anual entre a Europa e África, ao longo
              de várias gerações. Na primavera, as populações avançam para norte, chegando ao norte
              da Europa no verão. No outono, o movimento faz-se para sul, em direção ao norte de
              África e a regiões a sul do Sara. O ciclo completo é realizado por gerações
              sucessivas, que acompanham condições favoráveis à reprodução e à disponibilidade de
              alimento.
            </Paragraph>
            <Paragraph type="secondary">
              Fontes:{" "}
              <a
                href="https://www.nature.com/articles/s41467-025-67185-7"
                target="_blank"
                rel="noopener noreferrer"
              >
                Nature Communications (2025)
              </a>
              {" · "}
              <a
                href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5095192/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Estudo sobre a migração transaariana (2016)
              </a>
              .
            </Paragraph>
            <Title level={3}>Porque houve tantas em 2026?</Title>
            <Paragraph>
              As chuvas abundantes no inverno de 2025–2026 em Marrocos podem ter contribuído para
              este aumento: a chuva favorece o crescimento das plantas de que as lagartas se
              alimentam, permitindo que se desenvolvam mais borboletas. O sucesso das gerações
              seguintes e os ventos favoráveis ao longo da rota também influenciam a dimensão das
              vagas migratórias. É uma explicação plausível para 2026, mas os registos destes
              transectos, por si só, não permitem confirmar essa ligação.
            </Paragraph>
            <Paragraph type="secondary">
              Fontes:{" "}
              <a
                href="https://climate.copernicus.eu/exceptional-rainfall-and-flooding-parts-europe-and-north-africa-february"
                target="_blank"
                rel="noopener noreferrer"
              >
                Copernicus: chuvas de 2026
              </a>
              {" · "}
              <a
                href="https://butterfly-conservation.org/news-and-blog/have-you-spotted-a-painted-lady"
                target="_blank"
                rel="noopener noreferrer"
              >
                Butterfly Conservation: condições que favorecem as vagas migratórias
              </a>
              .
            </Paragraph>
          </Col>
        </Row>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <Paragraph>
              Indivíduos contados por mês, em todos os transectos. Toque na legenda para comparar
              anos. As contagens não estão corrigidas pelo esforço de amostragem; meses sem registos
              aparecem como lacunas.
            </Paragraph>
            <div style={{ height: 480 }}>
              <Line
                data={{
                  labels: MONTH_NAMES,
                  datasets: years.map((year, index) => ({
                    label: String(year),
                    data: monthlySpeciesAbundance(data.timeline, year).map((value, index) =>
                      Object.keys(
                        timelineForMonth(data.timeline, year, index + 3).observationsByYearDate[
                          year
                        ]
                      ).length
                        ? value
                        : null
                    ),
                    borderColor: year === RESULTS_YEAR ? "#d46b08" : COLORS[index % COLORS.length],
                    backgroundColor:
                      year === RESULTS_YEAR ? "#d46b08" : COLORS[index % COLORS.length],
                    borderWidth: year === RESULTS_YEAR ? 4 : 2,
                  })),
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true, title: { display: true, text: "Indivíduos contados" } },
                  },
                }}
              />
            </div>
          </Col>
          <Col xs={24} lg={12}>
            <Paragraph>
              Percorra as semanas para acompanhar os registos. O tamanho do círculo representa os
              indivíduos contados na semana; cinzento indica visitas sem registos da espécie. As
              localizações são aproximadas. Este mapa mostra observações, não trajetórias de
              migração.
            </Paragraph>
            <Space wrap>
              <Button
                disabled={!current}
                onClick={() => {
                  if (!playing && week === WEEKS.length - 1) setWeek(0);
                  setPlaying(!playing);
                }}
              >
                {playing ? "Pausar" : "Reproduzir"}
              </Button>
              <Text strong>{WEEKS[week].label} / 2026</Text>
              <Text>
                {Array.from(counts.values())
                  .reduce((sum, count) => sum + count, 0)
                  .toLocaleString("pt-PT")}{" "}
                indivíduos
              </Text>
            </Space>
            <Slider
              aria-label="Semana de observação"
              min={0}
              max={WEEKS.length - 1}
              value={week}
              marks={Object.fromEntries(
                WEEKS.flatMap((item, index) =>
                  index % 5 === 0 || index === WEEKS.length - 1
                    ? [[index, item.label.split(" – ")[0]]]
                    : []
                )
              )}
              tooltip={{ formatter: value => (value === undefined ? "" : WEEKS[value].label) }}
              onChange={value => {
                setPlaying(false);
                setWeek(value);
              }}
              style={{ margin: "24px 16px 40px" }}
            />
            {!visited.size && (
              <Empty
                description="Sem visitas registadas nesta semana"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
            {current && (
              <MapContainer center={[39.6, -8]} zoom={6} style={{ height: 480, width: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {markers
                  .filter(marker => visited.has(marker.transectId))
                  .map(marker => {
                    const count = counts.get(marker.transectId) || 0;
                    return (
                      <CircleMarker
                        key={marker.transectId}
                        center={[marker.lat, marker.lon]}
                        radius={count ? Math.min(32, 5 + Math.sqrt(count)) : 4}
                        pathOptions={{ color: count ? "#d46b08" : "#777", fillOpacity: 0.6 }}
                      >
                        <Popup>
                          <strong>{marker.transectName}</strong>
                          <br />
                          {WEEKS[week].label}: {count} indivíduos
                          <br />
                          {marker.totalVisits} visitas
                        </Popup>
                      </CircleMarker>
                    );
                  })}
              </MapContainer>
            )}
            <Paragraph type="secondary">
              Apenas transectos com coordenadas e visitas na semana selecionada são apresentados.
            </Paragraph>
          </Col>
        </Row>
      </Card>
    </Space>
  );
}
