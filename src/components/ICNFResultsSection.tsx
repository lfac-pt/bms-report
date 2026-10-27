import { scrollToReportSection } from "../utils/reportNavigation";
import { useMemo } from "react";
import { Card, Col, Row, Statistic, Table, Typography } from "antd";
import { Bar } from "react-chartjs-2";
import Link from "./ReportLink";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";
import { icnfResults } from "../utils/icnfResults";
import { MONTH_NAMES, RESULTS_YEAR, summarizeYear, timelineForMonth } from "../utils/annualResults";
import { annualHighlights, NetworkTransect } from "../utils/annualHighlights";
import SpeciesLink from "./SpeciesLink";
import endangeredPT from "../utils/endangered_pt";
import "./ICNFResultsSection.css";

const { Title, Paragraph, Text } = Typography;
const number = (value: number) => value.toLocaleString("pt-PT");
export default function ICNFResultsSection({
  timeline,
  transects,
}: {
  timeline: TimelineData;
  transects: TransectData;
}) {
  const results = useMemo(
    () => icnfResults(timeline, transects.transects, RESULTS_YEAR),
    [timeline, transects]
  );
  const allHighlights = useMemo(
    () => annualHighlights(timeline, RESULTS_YEAR, transects.transects),
    [timeline, transects]
  );
  const totalVisits = summarizeYear(timeline, RESULTS_YEAR)?.visits || 0;
  const discoveries = allHighlights.discoveries.filter(item =>
    item.transectIds.some(id => results.network.some(route => route.id === id))
  );
  if (!results.current) return null;
  const metrics = [
    ["Transectos ativos", "transects"],
    ["Visitas", "visits"],
    ["Espécies observadas", "species"],
    ["Indivíduos contados", "individuals"],
  ] as const;
  const municipalityLink = (item: NetworkTransect) =>
    item.metadata?.concelho ? (
      <Link to={`/municipality/${encodeURIComponent(item.metadata.concelho)}`}>
        {item.metadata.concelho}
      </Link>
    ) : (
      "—"
    );
  return (
    <Card className="annual-story-card icnf-results" id="annual-icnf">
      <span className="annual-eyebrow">ICNF / Conhecer para conservar</span>
      <Title level={2}>Percursos que acompanham a natureza</Title>
      <Paragraph className="annual-lead">
        Nos transectos associados ao ICNF, voltar ao terreno ao longo da época permite acompanhar
        diferentes comunidades de borboletas. Em 2026, estes percursos contribuíram com{" "}
        <strong>
          {((results.current.visits / totalVisits) * 100).toLocaleString("pt-PT", {
            maximumFractionDigits: 1,
          })}
          % das visitas
        </strong>{" "}
        registadas na rede continental.
      </Paragraph>
      <Row gutter={[16, 16]} className="icnf-metrics">
        {metrics.map(([label, key]) => (
          <Col xs={12} lg={6} key={key}>
            <div>
              <Statistic title={label} value={results.current![key]} groupSeparator=" " />
              <Text type="secondary">
                {results.previous
                  ? `${number(results.previous[key])} em 2025`
                  : "Sem registos em 2025"}
              </Text>
            </div>
          </Col>
        ))}
      </Row>
      <Row gutter={[32, 24]}>
        <Col xs={24} lg={12}>
          <Title level={3}>Uma época feita de regressos ao terreno</Title>
          <Paragraph>
            As visitas distribuídas pela estação ajudam a acompanhar espécies com diferentes
            períodos de voo. O gráfico mostra esse esforço, e não o número de borboletas.
          </Paragraph>
          <div className="icnf-effort-chart">
            <Bar
              role="img"
              aria-label="Visitas mensais aos transectos associados ao ICNF em 2025 e 2026"
              data={{
                labels: MONTH_NAMES,
                datasets: [RESULTS_YEAR - 1, RESULTS_YEAR].map(year => ({
                  label: String(year),
                  data: MONTH_NAMES.map(
                    (_, index) =>
                      summarizeYear(timelineForMonth(results.timeline, year, index + 3), year)
                        ?.visits ?? null
                  ),
                  backgroundColor: year === RESULTS_YEAR ? "#166553" : "#c6d6ce",
                  borderRadius: 3,
                })),
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    title: { display: true, text: "Visitas" },
                  },
                },
              }}
            />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <Title level={3}>Os cinco percursos com mais espécies</Title>
          <ol className="annual-ranking">
            {results.network.slice(0, 5).map((item, index) => (
              <li key={item.id}>
                <div className="annual-ranking-row">
                  <span className="annual-rank-number">{index + 1}</span>
                  <div className="annual-ranking-name">
                    <strong>{item.metadata!.transectName}</strong>
                    {municipalityLink(item)}
                    <span>{item.visits} visitas</span>
                  </div>
                  <div className="annual-ranking-count">
                    <strong>{item.speciesCount}</strong>
                    <span>espécies</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <Paragraph className="annual-note">
            Riqueza observada em 2026, influenciada pelo esforço e pelos habitats de cada percurso.
            Desempates pelo número de visitas.
          </Paragraph>
        </Col>
      </Row>
      {(results.highlights.threatened.length > 0 || discoveries.length > 0) && (
        <div className="annual-evidence">
          <strong>Da observação ao conhecimento para a conservação</strong>
          {results.highlights.threatened.length > 0 && (
            <Paragraph>
              Entre as espécies acompanhadas estão{" "}
              {results.highlights.threatened.map((item, index) => (
                <span key={item.species}>
                  {index > 0 && "; "}
                  <SpeciesLink species={item.species} /> ({endangeredPT[item.species]} em Portugal,{" "}
                  {item.individuals} indivíduos)
                </span>
              ))}
              . Cada registo acrescenta informação sobre a presença destas espécies nos percursos
              monitorizados.
            </Paragraph>
          )}
          {discoveries.length > 0 && (
            <Paragraph>
              {discoveries.map((item, index) => (
                <span key={item.species}>
                  {index > 0 && ", "}
                  <SpeciesLink species={item.species} />
                </span>
              ))}{" "}
              também {discoveries.length === 1 ? "surge" : "surgem"} entre os primeiros registos
              disponíveis na rede em 2026.{" "}
              <a
                href="#/results/2026#discoveries"
                onClick={event => {
                  event.preventDefault();
                  scrollToReportSection("annual-discoveries");
                }}
              >
                Rever as descobertas ↑
              </a>
            </Paragraph>
          )}
        </div>
      )}
      <details className="icnf-all-transects">
        <summary>
          Explorar os {results.network.length} transectos associados ao ICNF com visitas em 2026
        </summary>
        <Table<NetworkTransect>
          size="small"
          rowKey="id"
          dataSource={results.network}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: 600 }}
          columns={[
            {
              title: "Transecto",
              dataIndex: "id",
              render: (_, item) => item.metadata!.transectName,
            },
            { title: "Concelho", render: (_, item) => municipalityLink(item) },
            {
              title: "Espécies",
              dataIndex: "speciesCount",
              sorter: (a, b) => a.speciesCount - b.speciesCount,
            },
            { title: "Visitas", dataIndex: "visits", sorter: (a, b) => a.visits - b.visits },
            { title: "Épocas com registos", render: (_, item) => item.years.length },
          ]}
        />
      </details>
      <Paragraph className="annual-note">
        Âmbito: março a setembro, Portugal continental. Inclui os transectos com entidade «ICNF» nos
        metadados
        {results.nameMatches > 0 &&
          ` e ${results.nameMatches} com entidade por preencher e «ICNF» no nome`}
        . Uma visita corresponde a um transecto numa data. Indivíduos incluem todas as
        identificações; espécies seguem a lista válida do projeto. Os percursos e o esforço variam
        entre anos: esta comparação não representa uma tendência populacional.
      </Paragraph>
    </Card>
  );
}
