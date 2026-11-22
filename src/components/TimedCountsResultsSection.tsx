import { useState } from "react";
import { Card, Col, Row, Slider, Statistic, Typography } from "antd";
import { Line } from "react-chartjs-2";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import { TimedCountResults } from "../types/timedCounts";
import { MONTH_NAMES, RESULTS_YEAR } from "../utils/annualResults";
import ReportAnchor from "./ReportAnchor";
import "./TimedCountsResultsSection.css";

const { Title, Paragraph } = Typography;
const number = (value: number) => value.toLocaleString("pt-PT");
const labels = ["Sem registos nestas fontes", "Transectos", "Contagens de 15 min", "Ambos"];
const colors = ["#f2f3f2", "#8faaa0", "#deaa53", "#287b83"];
const months = ["março", "abril", "maio", "junho", "julho", "agosto", "setembro"];

export default function TimedCountsResultsSection({ data }: { data: TimedCountResults }) {
  const [month, setMonth] = useState(6);
  const current = data.years[RESULTS_YEAR];
  const previous = data.years[RESULTS_YEAR - 1];
  if (!current) return null;
  const visitsThroughMonth = (counts: number[]) =>
    counts.slice(0, month + 1).reduce((a, b) => a + b, 0);
  const category = (
    properties: TimedCountResults["municipalities"]["features"][number]["properties"]
  ) =>
    (properties.hasTransect ? 1 : 0) +
    (visitsThroughMonth(properties.visitsByYear[RESULTS_YEAR] || []) > 0 ? 2 : 0);
  const sampled = data.municipalities.features.filter(feature => category(feature.properties) >= 2);
  const extraCoverage = sampled.filter(feature => !feature.properties.hasTransect);
  const totalMunicipalities = data.municipalities.features.filter(feature =>
    (feature.properties.visitsByYear[RESULTS_YEAR] || []).some(count => count > 0)
  ).length;
  const previousMunicipalities = data.municipalities.features.filter(feature =>
    (feature.properties.visitsByYear[RESULTS_YEAR - 1] || []).some(count => count > 0)
  ).length;
  const metrics = [
    { label: "Contagens de 15 minutos", value: current.visits, previous: previous?.visits },
    { label: "Indivíduos contados", value: current.individuals, previous: previous?.individuals },
    { label: "Espécies identificadas", value: current.species, previous: previous?.species },
    { label: "Concelhos amostrados", value: totalMunicipalities, previous: previousMunicipalities },
  ];
  return (
    <Card id="annual-timed-counts" className="annual-story-card timed-counts-results">
      <span className="annual-eyebrow">Explorar / Quinze minutos para alargar o mapa</span>
      <Title level={2}>Mais lugares, outro olhar sobre as borboletas</Title>
      <Paragraph className="annual-lead">
        Os transectos contam a história de voltar ao mesmo lugar. As contagens de 15 minutos
        permitem levar a observação a outros percursos, áreas ou pontos, com a aplicação
        ButterflyCount. Juntas, estas formas de participar ajudam a conhecer mais lugares de
        Portugal continental.
      </Paragraph>
      <Row gutter={[16, 20]} className="timed-counts-metrics">
        {metrics.map(metric => (
          <Col xs={12} lg={6} key={metric.label}>
            <Statistic title={metric.label} value={metric.value} groupSeparator=" " />
            {metric.previous !== undefined && <span>{number(metric.previous)} em 2025</span>}
          </Col>
        ))}
      </Row>
      <Paragraph className="annual-note">
        Março–setembro, Portugal continental. Das {current.species} espécies identificadas em 2026,{" "}
        {current.acceptedSpecies} têm pelo menos um registo aceite; as restantes aguardam validação.
        Os totais incluem {number(current.pendingRecords)} registos de observação por confirmar.
        Estes resultados são apresentados separadamente dos totais dos transectos.
      </Paragraph>

      <section className="timed-counts-chapter" aria-labelledby="timed-coverage-title">
        <Title level={3} id="timed-coverage-title">
          Cada contagem acrescenta um lugar ao mapa
        </Title>
        <Paragraph>
          Até ao fim de {months[month]}, as contagens de 15 minutos chegaram a{" "}
          <strong>{sampled.length} concelhos</strong>. Destes,{" "}
          <strong>{extraCoverage.length}</strong> não têm um transecto identificado nos metadados
          disponíveis. Mova o cursor para acompanhar a cobertura acumulada.
        </Paragraph>
        <div className="timed-counts-map-legend" aria-label="Legenda do mapa">
          {labels.map((label, index) => (
            <span key={label}>
              <i style={{ background: colors[index] }} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
        <MapContainer
          center={[39.6, -8]}
          zoom={6}
          scrollWheelZoom={false}
          className="timed-counts-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            key={month}
            data={data.municipalities}
            style={feature => ({
              color: "#ffffff",
              weight: 1,
              fillOpacity: 0.8,
              fillColor: colors[feature ? category(feature.properties) : 0],
            })}
            onEachFeature={(feature, layer) => {
              // Text nodes avoid interpreting source municipality names as HTML.
              const popup = document.createElement("div");
              const title = document.createElement("strong");
              title.textContent = feature.properties.name;
              popup.append(title, document.createElement("br"));
              const visits = visitsThroughMonth(
                feature.properties.visitsByYear[RESULTS_YEAR] || []
              );
              popup.append(`${visits} contagens de 15 min de março a ${months[month]}. `);
              popup.append(
                feature.properties.hasTransect
                  ? "Com transecto nos metadados disponíveis."
                  : "Sem transecto nos metadados disponíveis."
              );
              layer.bindPopup(popup);
            }}
          />
        </MapContainer>
        <div className="timed-counts-slider">
          <label id="timed-month-label">
            Cobertura acumulada até ao fim de {months[month]} de {RESULTS_YEAR}
          </label>
          <Slider
            min={0}
            max={6}
            step={1}
            value={month}
            onChange={setMonth}
            marks={Object.fromEntries(MONTH_NAMES.map((name, index) => [index, name]))}
            {...{ ariaLabelledByForHandle: "timed-month-label" }}
            tooltip={{ formatter: value => months[value ?? 0] }}
          />
        </div>
        <Paragraph className="annual-note">
          A cor dos transectos refere-se ao catálogo disponível, incluindo percursos atualmente
          inativos; não muda com o cursor. A ausência de registos nestas fontes não confirma
          ausência de monitorização. O mapa agrega visitas por concelho, sem mostrar percursos ou
          localizações individuais. A atribuição usa o centro aproximado de cada contagem.
        </Paragraph>
      </section>

      <section className="timed-counts-chapter" aria-labelledby="timed-season-title">
        <Title level={3} id="timed-season-title">
          Uma estação observada quinze minutos de cada vez
        </Title>
        <Paragraph>
          Quantas borboletas se contaram, em média, por visita? A comparação mensal inclui as
          contagens sem avistamentos. O número de visitas aparece ao passar sobre cada ponto.
        </Paragraph>
        <div className="timed-counts-chart">
          <Line
            role="img"
            aria-label="Média mensal de borboletas por contagem de 15 minutos em 2025 e 2026"
            data={{
              labels: MONTH_NAMES,
              datasets: [RESULTS_YEAR - 1, RESULTS_YEAR]
                .filter(year => data.years[year])
                .map(year => ({
                  label: String(year),
                  data: data.years[year].months.map(period =>
                    period.visits ? period.individuals / period.visits : null
                  ),
                  borderColor: year === RESULTS_YEAR ? "#287b83" : "#97a5ad",
                  backgroundColor: year === RESULTS_YEAR ? "#287b83" : "#97a5ad",
                  borderWidth: year === RESULTS_YEAR ? 3 : 2,
                  borderDash: year === RESULTS_YEAR ? [] : [5, 4],
                })),
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: {
                legend: { position: "bottom" },
                tooltip: {
                  callbacks: {
                    label: context =>
                      `${context.dataset.label}: ${context.parsed.y?.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} indivíduos/visita · ${data.years[context.dataset.label!].months[context.dataIndex].visits} visitas`,
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: "Média de indivíduos por visita" },
                },
              },
            }}
          />
        </div>
        <Paragraph className="annual-note">
          A média ajusta a comparação ao número de visitas, mas os locais, habitats, condições
          meteorológicas e áreas amostradas podem variar. Não representa, por si só, uma tendência
          populacional. Meses sem visitas aparecem como lacunas.
        </Paragraph>
      </section>
      <div className="annual-evidence">
        <strong>Um primeiro passo para continuar a observar</strong>
        <Paragraph>
          Um percurso regular permite acompanhar mudanças. Uma contagem de 15 minutos pode levar a
          observação a outro lugar. Ambas começam com tempo para olhar e atenção às borboletas.
        </Paragraph>
      </div>
      <details className="timed-counts-methods">
        <summary>Como foram calculados estes resultados?</summary>
        <Paragraph>
          Cada amostra única conta como uma visita. Incluímos contagens públicas identificadas como
          levantamentos de borboletas, ou com observações de borboletas quando o grupo não está
          preenchido. Contagens explicitamente dedicadas a borboletas são incluídas mesmo sem
          avistamentos ({current.zeroCounts} em 2026). Outros insetos, estádios imaturos e registos
          rejeitados são excluídos. Indivíduos incluem identificações acima da espécie; espécies
          usam a mesma lista de nomes válidos dos transectos.
        </Paragraph>
        <Paragraph>
          As visitas são localizadas nos concelhos de Portugal continental. Observações sem uma
          visita correspondente não entram nos totais. Os registos por confirmar não devem ser
          interpretados como novas ocorrências confirmadas. A duração nominal de 15 minutos não é
          inferida pela diferença entre início e fim, pois a aplicação permite pausas.
        </Paragraph>
        <Paragraph>
          Método:{" "}
          <ReportAnchor
            href="https://butterfly-monitoring.net/15min-counts-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            eBMS · Contagens de 15 minutos
          </ReportAnchor>
          .
        </Paragraph>
      </details>
    </Card>
  );
}
