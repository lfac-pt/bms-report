import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Empty, Row, Slider, Space, Typography } from "antd";
import { LeftOutlined, PauseOutlined, PlayCircleOutlined, RightOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";
import { calculateSpeciesPresenceByYear } from "../utils/speciesMapUtils";
import {
  MONTH_NAMES,
  RESULTS_YEAR,
  WAVE_SPECIES,
  monitoringWeeks,
  monthlySpeciesAbundance,
  summarizeSpeciesPeriod,
  timelineForMonth,
  timelineForWeek,
} from "../utils/annualResults";
import "leaflet/dist/leaflet.css";
import "./VanessaWaveSection.css";

const { Title, Paragraph, Text } = Typography;
const WEEKS = monitoringWeeks(RESULTS_YEAR);
const COLORS = ["#64748b", "#8864aa", "#188c86", "#446dc1", "#678b3f", "#b38a24", "#b45382"];
const format = (value: number) => value.toLocaleString("pt-PT");

export default function VanessaWaveSection({
  timeline,
  transects,
}: {
  timeline: TimelineData;
  transects: TransectData;
}) {
  const [week, setWeek] = useState(0);
  const [playing, setPlaying] = useState(false);
  const periods = useMemo(
    () =>
      WEEKS.map((_, index) => {
        const filtered = timelineForWeek(timeline, RESULTS_YEAR, index);
        return { timeline: filtered, ...summarizeSpeciesPeriod(filtered, RESULTS_YEAR) };
      }),
    [timeline]
  );
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setWeek(current => (current + 1) % WEEKS.length), 900);
    return () => window.clearInterval(timer);
  }, [playing]);
  const selected = periods[week];
  const total = periods.reduce((sum, period) => sum + period.individuals, 0);
  const peakIndex = periods.reduce(
    (best, period, index) => (period.individuals > periods[best].individuals ? index : best),
    0
  );
  const max = Math.max(1, ...periods.map(period => period.individuals));
  const markers = useMemo(
    () =>
      calculateSpeciesPresenceByYear(
        WAVE_SPECIES,
        RESULTS_YEAR,
        selected.timeline,
        transects.transects
      ),
    [selected, transects]
  );
  const chooseWeek = (index: number) => {
    setPlaying(false);
    setWeek(index);
  };
  const years = timeline.years.filter(year => year <= RESULTS_YEAR).sort((a, b) => a - b);
  const annual = summarizeSpeciesPeriod(timeline, RESULTS_YEAR);
  const previous = summarizeSpeciesPeriod(timeline, RESULTS_YEAR - 1);
  const mappedIds = new Set(markers.map(marker => marker.transectId));
  const missingLocations = [...selected.visited].filter(id => !mappedIds.has(id)).length;

  return (
    <Card
      className="wave-card"
      title={
        <span>
          A onda de <i>Vanessa cardui</i> em 2026
        </span>
      }
      extra={<Link to="/species/Vanessa%20cardui">Ver espécie →</Link>}
    >
      <section aria-labelledby="wave-intro-title" className="wave-intro">
        <Row gutter={[32, 24]} align="middle">
          <Col xs={24} lg={12}>
            <figure className="wave-photo">
              <img
                src="imgs/vanessa-cardui-swarm.jpg"
                alt="Várias Vanessa cardui a alimentar-se em flores roxas, entre outras borboletas."
                width={2048}
                height={1365}
              />
              <figcaption>
                <i>Vanessa cardui</i> em alimentação nas flores.
              </figcaption>
            </figure>
          </Col>
          <Col xs={24} lg={12}>
            <span className="wave-eyebrow">01 / Uma viagem entre continentes</span>
            <Title level={2} id="wave-intro-title">
              Uma onda que atravessa gerações
            </Title>
            <Paragraph>
              A <i>Vanessa cardui</i> liga a Europa e África numa migração anual realizada por
              gerações sucessivas. Na primavera, as populações avançam para norte, chegando ao norte
              da Europa no verão. No outono, regressam para sul, ao norte de África e a regiões a
              sul do Sara.
            </Paragraph>
            <Paragraph>
              Em 2026, os transectos registaram <strong>{format(total)} indivíduos</strong> entre
              março e setembro. Explore quando e onde foram contados e descubra como esta época se
              compara com as anteriores.
            </Paragraph>
            <div className="wave-context">
              <Text strong>O que pode explicar o aumento?</Text>
              <Paragraph>
                As chuvas abundantes do inverno de 2025–2026 em Marrocos podem ter favorecido as
                plantas de que as lagartas se alimentam. O sucesso reprodutor e os ventos ao longo
                da rota também influenciam as vagas migratórias. É uma explicação plausível; estes
                registos não permitem confirmar a causa do aumento.
              </Paragraph>
            </div>
            <details className="wave-sources">
              <summary>Fontes sobre migração e chuva</summary>
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
                Migração transaariana (2016)
              </a>
              {" · "}
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
                Butterfly Conservation
              </a>
            </details>
          </Col>
        </Row>
      </section>

      <section className="wave-chapter" aria-labelledby="wave-map-title">
        <span className="wave-eyebrow">02 / Acompanhar a época</span>
        <Title level={3} id="wave-map-title">
          Onde se fez sentir a onda?
        </Title>
        <Paragraph>
          Reproduza a época ou escolha uma semana nas barras. O mapa acompanha a seleção e mostra os
          registos desse período.
        </Paragraph>
        <div className="wave-explorer">
          <div className="wave-toolbar">
            <Space size={8}>
              <Button
                aria-label="Semana anterior"
                icon={<LeftOutlined />}
                disabled={week === 0}
                onClick={() => chooseWeek(week - 1)}
              />
              <Button
                type="primary"
                className="wave-play"
                icon={playing ? <PauseOutlined /> : <PlayCircleOutlined />}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? "Pausar" : "Reproduzir"}
              </Button>
              <Button
                aria-label="Semana seguinte"
                icon={<RightOutlined />}
                disabled={week === WEEKS.length - 1}
                onClick={() => chooseWeek(week + 1)}
              />
            </Space>
            <div className="wave-date" aria-live={playing ? "off" : "polite"}>
              <strong>{WEEKS[week].label}</strong>
              <span>
                2026 · semana {week + 1} de {WEEKS.length}
              </span>
            </div>
          </div>
          <div className="wave-map">
            <MapContainer
              center={[39.6, -8]}
              zoom={6}
              scrollWheelZoom={false}
              style={{ height: 450, width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {markers
                .filter(marker => selected.visited.has(marker.transectId))
                .map(marker => {
                  const count = selected.counts.get(marker.transectId) || 0;
                  return (
                    <CircleMarker
                      key={marker.transectId}
                      center={[marker.lat, marker.lon]}
                      radius={count ? Math.min(32, 5 + Math.sqrt(count)) : 4}
                      pathOptions={{
                        color: count ? "#b45309" : "#687787",
                        fillColor: count ? "#f59e0b" : "#94a3b8",
                        fillOpacity: 0.65,
                        weight: 1.5,
                      }}
                    >
                      <Popup>
                        <strong>{marker.transectName}</strong>
                        <br />
                        {WEEKS[week].label}: {format(count)} indivíduos
                        <br />
                        {marker.totalVisits} visitas
                      </Popup>
                    </CircleMarker>
                  );
                })}
            </MapContainer>
          </div>
          <div className="wave-stats" aria-live={playing ? "off" : "polite"}>
            <div>
              <strong>{format(selected.individuals)}</strong>
              <span>indivíduos na semana</span>
            </div>
            <div>
              <strong>{selected.visited.size}</strong>
              <span>transectos visitados</span>
            </div>
            <div>
              <strong>{[...selected.counts.values()].filter(count => count > 0).length}</strong>
              <span>
                com <i>V. cardui</i>
              </span>
            </div>
          </div>
          <div className="wave-timeline">
            <div className="wave-timeline-heading">
              <Text strong>Indivíduos contados por semana</Text>
              <Text type="secondary">Máximo: {format(max === 1 && total === 0 ? 0 : max)}</Text>
            </div>
            <div className="wave-bars" role="group" aria-label="Escolher semana pela abundância">
              {periods.map((period, index) => (
                <button
                  key={index}
                  type="button"
                  className={`wave-bar${index === week ? " is-selected" : ""}${!period.visited.size ? " is-missing" : ""}`}
                  aria-pressed={index === week}
                  aria-label={`${WEEKS[index].label}: ${period.visited.size ? `${format(period.individuals)} indivíduos` : "sem visitas"}`}
                  title={`${WEEKS[index].label} · ${period.visited.size ? `${format(period.individuals)} indivíduos` : "sem visitas"}`}
                  onClick={() => chooseWeek(index)}
                >
                  <span style={{ height: `${Math.max(3, (period.individuals / max) * 100)}%` }} />
                </button>
              ))}
            </div>
            <Slider
              {...{ ariaLabelForHandle: "Semana de observação" }}
              min={0}
              max={WEEKS.length - 1}
              value={week}
              onChange={chooseWeek}
              tooltip={{ formatter: value => (value === undefined ? "" : WEEKS[value].label) }}
              marks={Object.fromEntries(
                WEEKS.flatMap((item, index) =>
                  index % 5 === 0 || index === WEEKS.length - 1
                    ? [[index, item.label.split(" – ")[0]]]
                    : []
                )
              )}
            />
            <div className="wave-timeline-note">
              Laranja: semana selecionada · Barras claras: outras semanas · Tracejado: sem visitas
            </div>
            {!selected.visited.size && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Sem visitas registadas nesta semana"
              />
            )}
          </div>
        </div>
        <Paragraph className="wave-footnote">
          Círculos maiores representam mais indivíduos; cinzento indica visitas sem registos da
          espécie. As localizações são aproximadas. O mapa mostra observações, não trajetórias de
          migração.{" "}
          {missingLocations > 0 &&
            `${missingLocations} transecto(s) visitado(s) sem localização no mapa.`}{" "}
          Os totais e as barras incluem todos os transectos com registos.
        </Paragraph>
      </section>

      <section className="wave-chapter" aria-labelledby="wave-history-title">
        <span className="wave-eyebrow">03 / Olhar para trás</span>
        <Title level={3} id="wave-history-title">
          Como se compara 2026 com outros anos?
        </Title>
        <Paragraph>
          Depois do detalhe semanal, uma perspetiva de toda a época. A linha laranja destaca 2026;
          selecione os anos na legenda para comparar a intensidade e o momento dos picos.
        </Paragraph>
        <div className="wave-history-summary">
          <div>
            <strong>{format(total)}</strong>
            <span>
              indivíduos em 2026
              {previous.visited.size > 0 ? ` · ${format(previous.individuals)} em 2025` : ""}
            </span>
          </div>
          <div>
            <strong>{total > 0 ? WEEKS[peakIndex].label : "—"}</strong>
            <span>
              {total > 0
                ? `maior contagem semanal · ${format(periods[peakIndex].individuals)} indivíduos`
                : "sem registos da espécie"}
            </span>
          </div>
          <div>
            <strong>
              {annual.visits > 0
                ? (total / annual.visits).toLocaleString("pt-PT", { maximumFractionDigits: 2 })
                : "—"}
            </strong>
            <span>indivíduos por visita em 2026</span>
          </div>
        </div>
        <div className="wave-history-chart">
          <Line
            aria-label="Comparação das contagens mensais de Vanessa cardui entre anos"
            role="img"
            data={{
              labels: MONTH_NAMES,
              datasets: years.map((year, index) => ({
                label: String(year),
                data: monthlySpeciesAbundance(timeline, year).map((value, index) =>
                  Object.keys(
                    timelineForMonth(timeline, year, index + 3).observationsByYearDate[year]
                  ).length
                    ? value
                    : null
                ),
                borderColor: year === RESULTS_YEAR ? "#b45309" : COLORS[index % COLORS.length],
                backgroundColor: year === RESULTS_YEAR ? "#b45309" : COLORS[index % COLORS.length],
                borderWidth: year === RESULTS_YEAR ? 4 : 1.5,
                pointRadius: year === RESULTS_YEAR ? 4 : 2,
                borderDash: year === RESULTS_YEAR ? [] : [4, 3],
              })),
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: { legend: { position: "bottom" } },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: "Indivíduos contados por mês" },
                },
              },
            }}
          />
        </div>
        <Paragraph className="wave-footnote">
          Contagens de março a setembro, sem correção pelo esforço de amostragem. O número de
          visitas e de transectos varia entre anos: mais indivíduos contados não significa, por si
          só, um aumento populacional equivalente. A média por visita inclui visitas sem registos da
          espécie. Meses sem visitas aparecem como lacunas.
        </Paragraph>
      </section>
    </Card>
  );
}
