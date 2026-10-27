import { useMemo } from "react";
import { Card, Col, Row, Tag, Typography } from "antd";
import Link from "./ReportLink";
import { Line } from "react-chartjs-2";
import { AnnualStoryProps } from "./AnnualOverview";
import AnnualSpeciesPhoto from "./AnnualSpeciesPhoto";
import SpeciesMap from "./SpeciesMap";
import { calculateSpeciesPresenceByYear } from "../utils/speciesMapUtils";
import { compareSpeciesOnSharedTransects } from "../utils/annualHighlights";
import {
  MONTH_NAMES,
  RESULTS_YEAR,
  monthlySpeciesAbundance,
  summarizeSpeciesPeriod,
  timelineForMonth,
} from "../utils/annualResults";

const SPECIES = "Euphydryas aurinia";
const { Title, Paragraph } = Typography;
const number = (n: number) => n.toLocaleString("pt-PT");
export default function AuriniaResultsSection({ timeline, transects, credits }: AnnualStoryProps) {
  const current = summarizeSpeciesPeriod(timeline, RESULTS_YEAR, SPECIES);
  const previous = summarizeSpeciesPeriod(timeline, RESULTS_YEAR - 1, SPECIES);
  const shared = useMemo(
    () => compareSpeciesOnSharedTransects(timeline, RESULTS_YEAR, SPECIES),
    [timeline]
  );
  const presence = useMemo(
    () => calculateSpeciesPresenceByYear(SPECIES, RESULTS_YEAR, timeline, transects.transects),
    [timeline, transects]
  );
  const occupied = [...current.counts.values()].filter(count => count > 0).length;
  const previousOccupied = [...previous.counts.values()].filter(count => count > 0).length;
  return (
    <Card
      className="annual-story-card"
      extra={<Link to={`/species/${encodeURIComponent(SPECIES)}`}>Ver espécie →</Link>}
      title={
        <span>
          Outra história de 2026 · <i>Euphydryas aurinia</i>
        </span>
      }
    >
      <Row gutter={[32, 24]} align="middle">
        <Col xs={24} md={8}>
          <AnnualSpeciesPhoto species={SPECIES} credits={credits} />
        </Col>
        <Col xs={24} md={16}>
          <span className="annual-eyebrow">Habitats / A vida entre matos e bosques</span>
          <Title level={2}>Um ano de abundância para a aurinia</Title>
          <Paragraph>
            As contagens de <i>Euphydryas aurinia</i> passaram de{" "}
            <strong>
              {number(previous.individuals)} para {number(current.individuals)} indivíduos
            </strong>
            , em {occupied} transectos com registos da espécie ({previousOccupied} em 2025).
          </Paragraph>
          <Paragraph>
            Em Portugal, esta borboleta está associada a matos e orlas de bosques com alguma
            humidade, onde crescem madressilvas, plantas hospedeiras das lagartas. A continuidade
            destes habitats dá contexto ao acompanhamento das suas populações.
          </Paragraph>
          <Tag color="green">Anexo II da Diretiva Habitats</Tag>
          <Paragraph className="annual-note">
            A proteção legal não equivale a uma categoria de ameaça.{" "}
            <a
              href="https://lvinvertebrados.pt/especies-protegidas/euphydryas-aurinia/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ecologia e proteção da espécie
            </a>
            .
          </Paragraph>
        </Col>
      </Row>
      <Row gutter={[32, 24]} className="annual-aurinia-data">
        <Col xs={24} lg={14}>
          <Title level={3}>Mais indivíduos, sobretudo na primavera</Title>
          <div style={{ height: 280 }}>
            <Line
              aria-label="Contagens mensais de Euphydryas aurinia em 2025 e 2026"
              role="img"
              data={{
                labels: MONTH_NAMES,
                datasets: [RESULTS_YEAR - 1, RESULTS_YEAR].map(year => ({
                  label: String(year),
                  data: monthlySpeciesAbundance(timeline, year, SPECIES).map((count, index) =>
                    Object.keys(
                      timelineForMonth(timeline, year, index + 3).observationsByYearDate[year]
                    ).length
                      ? count
                      : null
                  ),
                  borderColor: year === RESULTS_YEAR ? "#166553" : "#95a6a0",
                  backgroundColor: year === RESULTS_YEAR ? "#166553" : "#95a6a0",
                  borderWidth: year === RESULTS_YEAR ? 3 : 2,
                  borderDash: year === RESULTS_YEAR ? [] : [5, 4],
                })),
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } },
                scales: {
                  y: { beginAtZero: true, title: { display: true, text: "Indivíduos contados" } },
                },
              }}
            />
          </div>
        </Col>
        <Col xs={24} lg={10}>
          <Title level={3}>Onde foi observada?</Title>
          <SpeciesMap
            transects={presence}
            speciesName={SPECIES}
            year={RESULTS_YEAR}
            timelineData={timeline}
          />
          <Paragraph className="annual-note">
            Azul: presença da espécie; cinzento: sem registos da espécie. Localizações aproximadas,
            apenas com metadados disponíveis.
          </Paragraph>
        </Col>
      </Row>
      {shared.transects > 0 && (
        <div className="annual-evidence">
          <strong>E se compararmos os mesmos percursos?</strong>
          <Paragraph>
            Nos {shared.transects} transectos visitados nos dois anos, as contagens passaram de{" "}
            {number(shared.previous.individuals)} para {number(shared.current.individuals)}{" "}
            indivíduos, com {number(shared.previous.visits)} e {number(shared.current.visits)}{" "}
            visitas, respetivamente. O aumento também aparece nesta comparação; não se deve apenas à
            entrada de novos transectos.
          </Paragraph>
        </div>
      )}
      <Paragraph className="annual-note">
        Comparação descritiva entre março e setembro, sem ajuste pela distribuição das visitas ao
        longo da época, clima ou detetabilidade. As contagens não demonstram, por si só, uma
        recuperação populacional ou a sua causa. Meses sem visitas aparecem como lacunas.
      </Paragraph>
    </Card>
  );
}
