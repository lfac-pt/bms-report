import { scrollToReportSection } from "../utils/reportNavigation";
import { useMemo } from "react";
import { Card, Col, Empty, Row, Tag, Typography } from "antd";
import Link from "./ReportLink";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";
import { annualHighlights } from "../utils/annualHighlights";
import { RESULTS_YEAR } from "../utils/annualResults";
import { VALID_SPECIES } from "../constants";
import endangeredPT from "../utils/endangered_pt";
import SpeciesLink from "./SpeciesLink";
import AnnualNetworkMap from "./AnnualNetworkMap";
import AnnualSpeciesPhoto, { PhotoCredit } from "./AnnualSpeciesPhoto";

const { Title, Paragraph, Text } = Typography;
const STATUS: Record<string, string> = {
  CR: "Criticamente em Perigo",
  EN: "Em Perigo",
  VU: "Vulnerável",
};
const ECOLOGY: Record<string, string> = {
  "Phengaris alcon":
    "Uma borboleta que liga plantas e formigas: as lagartas começam por se alimentar de gencianas e completam o desenvolvimento em formigueiros de Myrmica. Proteger esta relação exige conservar o habitat que a sustenta.",
  "Euchloe tagis":
    "As lagartas dependem de plantas do género Iberis. A conservação das plantas hospedeiras e dos locais onde crescem faz parte da conservação desta borboleta.",
};

export interface AnnualStoryProps {
  timeline: TimelineData;
  transects: TransectData;
  names: Record<string, string>;
  credits: Record<string, PhotoCredit>;
}

export default function AnnualOverview({ timeline, transects, names, credits }: AnnualStoryProps) {
  const highlights = useMemo(
    () => annualHighlights(timeline, RESULTS_YEAR, transects.transects),
    [timeline, transects]
  );
  const metadata = new Map(transects.transects.map(item => [item.transectId, item]));
  const years = timeline.years.filter(year => year <= RESULTS_YEAR);
  const priorYears = years.filter(year => year < RESULTS_YEAR);
  const top = highlights.network.slice(0, 5);
  const topMunicipalities = new Set(
    top.flatMap(item => (item.metadata?.concelho ? [item.metadata.concelho] : []))
  );
  return (
    <>
      <nav className="annual-highlights" aria-label="Destaques de 2026">
        <a
          href="#/results/2026#discoveries"
          onClick={event => {
            event.preventDefault();
            scrollToReportSection("annual-discoveries");
          }}
        >
          <strong>{highlights.discoveries.length}</strong>
          <span>espécies novas nos registos disponíveis</span>
          <span aria-hidden="true">↗</span>
        </a>
        <a
          href="#/results/2026#network"
          onClick={event => {
            event.preventDefault();
            scrollToReportSection("annual-network");
          }}
        >
          <strong>{highlights.newCount}</strong>
          <span>transectos na sua primeira época</span>
          <span aria-hidden="true">↗</span>
        </a>
        <a
          href="#/results/2026#network"
          onClick={event => {
            event.preventDefault();
            scrollToReportSection("annual-network");
          }}
        >
          <strong>{highlights.veteranCount}</strong>
          <span>transectos ativos com 5 ou mais épocas</span>
          <span aria-hidden="true">↗</span>
        </a>
      </nav>

      <Card id="annual-discoveries" className="annual-story-card">
        <span className="annual-eyebrow">Descobrir / A diversidade que se revela</span>
        <Title level={2}>Novos olhares, novas descobertas</Title>
        <Paragraph className="annual-lead">
          Cada novo percurso pode revelar uma parte da diversidade que ainda não estava a ser
          acompanhada. Em 2026, {highlights.discoveries.length} espécies surgem pela primeira vez
          nos registos disponíveis dos Censos.
        </Paragraph>
        {highlights.discoveries.length ? (
          <Row gutter={[24, 24]}>
            {highlights.discoveries.map(item => {
              const locations = item.transectIds.map(id => metadata.get(id));
              const newRoute = item.transectIds.some(
                id => highlights.network.find(route => route.id === id)?.isNew
              );
              return (
                <Col xs={24} md={8} key={item.species}>
                  <article className="annual-species-story">
                    <AnnualSpeciesPhoto species={item.species} credits={credits} />
                    <div className="annual-species-copy">
                      <Tag color="green">Primeiro registo disponível</Tag>
                      {newRoute && <Tag color="gold">Num novo transecto</Tag>}
                      <Title level={3}>
                        <SpeciesLink species={item.species} />
                      </Title>
                      {names[item.species] && <Text type="secondary">{names[item.species]}</Text>}
                      <Paragraph>
                        <strong>{item.individuals}</strong>{" "}
                        {item.individuals === 1 ? "indivíduo contado" : "indivíduos contados"} ·
                        primeiro registo em {item.firstDate}
                      </Paragraph>
                      <Paragraph>
                        {locations.map((location, index) => (
                          <span key={item.transectIds[index]}>
                            {index > 0 && "; "}
                            {location ? (
                              <>
                                {location.transectName} ·{" "}
                                <Link to={`/municipality/${encodeURIComponent(location.concelho)}`}>
                                  {location.concelho}
                                </Link>
                              </>
                            ) : (
                              `Transecto ${item.transectIds[index]} (localização indisponível)`
                            )}
                          </span>
                        ))}
                      </Paragraph>
                    </div>
                  </article>
                </Col>
              );
            })}
          </Row>
        ) : (
          <Empty description="Sem novas espécies nos registos deste ano" />
        )}
        <Paragraph className="annual-note">
          Comparação entre épocas de março a setembro
          {priorYears.length > 0
            ? `, de ${Math.min(...priorYears)} a ${Math.max(...priorYears)}`
            : " anteriores disponíveis"}
          . «Primeiro registo» refere-se a este conjunto de dados; não é uma descoberta para
          Portugal. Fotografias ilustrativas das espécies, não dos avistamentos de 2026.
        </Paragraph>
      </Card>

      <Card className="annual-story-card">
        <Row gutter={[40, 24]}>
          <Col xs={24} lg={8}>
            <span className="annual-eyebrow">Explorar / Os lugares da diversidade</span>
            <Title level={2}>Cinco percursos, muitas formas de vida</Title>
            <Paragraph>
              {topMunicipalities.size} concelhos estão representados entre os percursos com mais
              espécies observadas nesta época. Conhecer a riqueza de cada lugar começa por voltar
              lá, ao longo da estação.
            </Paragraph>
            <Paragraph className="annual-note">
              Riqueza observada em 2026. O número de visitas, a extensão do percurso e os habitats
              atravessados influenciam as contagens. Estes valores não são uma classificação da
              qualidade dos habitats. Desempates pelo número de visitas.
            </Paragraph>
          </Col>
          <Col xs={24} lg={16}>
            <ol className="annual-ranking">
              {top.map(item => (
                <li key={item.id}>
                  <div className="annual-ranking-row">
                    <span className="annual-rank-number">{top.indexOf(item) + 1}</span>
                    <div className="annual-ranking-name">
                      <strong>{item.metadata?.transectName || `Transecto ${item.id}`}</strong>
                      {item.metadata && (
                        <Link to={`/municipality/${encodeURIComponent(item.metadata.concelho)}`}>
                          {item.metadata.concelho}
                        </Link>
                      )}
                      <span>{item.visits} visitas</span>
                    </div>
                    <div className="annual-ranking-count">
                      <strong>{item.speciesCount}</strong>
                      <span>espécies</span>
                    </div>
                  </div>
                  {item.metadata && (
                    <details className="annual-ranking-species">
                      <summary>Explorar as espécies observadas</summary>
                      <div>
                        {speciesNamesForTransect(timeline, item.id).map(species => (
                          <SpeciesLink key={species} species={species} />
                        ))}
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          </Col>
        </Row>
      </Card>

      <Card className="annual-story-card">
        <span className="annual-eyebrow">Conservar / Cada registo conta</span>
        <Title level={2}>
          {highlights.threatened.length} espécies ameaçadas em Portugal acompanhadas em 2026
        </Title>
        <Paragraph className="annual-lead">
          Entre as borboletas observadas estão espécies cujos habitats precisam de especial atenção.
          Acompanhar a sua presença ao longo dos anos ajuda a perceber o que está a mudar.
        </Paragraph>
        <Row gutter={[24, 24]}>
          {highlights.threatened.map(item => (
            <Col xs={24} md={12} key={item.species}>
              <article className="annual-conservation-story">
                <AnnualSpeciesPhoto species={item.species} credits={credits} />
                <div className="annual-species-copy">
                  <Tag color={endangeredPT[item.species] === "VU" ? "orange" : "red"}>
                    Portugal · {STATUS[endangeredPT[item.species]]} ({endangeredPT[item.species]})
                  </Tag>
                  <Title level={3}>
                    <SpeciesLink species={item.species} />
                  </Title>
                  <Text type="secondary">{names[item.species]}</Text>
                  <Paragraph>
                    <strong>{item.individuals} indivíduos</strong> contados em{" "}
                    {item.transectIds.length}{" "}
                    {item.transectIds.length === 1 ? "transecto" : "transectos"}.
                  </Paragraph>
                  <Paragraph>
                    {ECOLOGY[item.species] ||
                      "O acompanhamento regular permite documentar a presença desta espécie e apoiar o conhecimento dos seus habitats."}
                  </Paragraph>
                  {highlights.discoveries.some(discovery => discovery.species === item.species) && (
                    <a
                      href="#/results/2026#discoveries"
                      onClick={event => {
                        event.preventDefault();
                        scrollToReportSection("annual-discoveries");
                      }}
                    >
                      Também entre os primeiros registos deste ano ↑
                    </a>
                  )}
                </div>
              </article>
            </Col>
          ))}
        </Row>
        <Paragraph className="annual-note">
          Categorias nacionais CR, EN e VU, segundo a lista de conservação utilizada no projeto.
          Estatuto de ameaça e proteção legal são conceitos distintos. Não são apresentadas
          localizações detalhadas nesta secção. Fontes:{" "}
          <a
            href="https://lvinvertebrados.uac.pt/docs/Livro-Vermelho-dos-Invertebrados-de-Portugal-Continental.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            Livro Vermelho dos Invertebrados de Portugal Continental
          </a>
          ,{" "}
          <a
            href="https://webstorage.cienciaviva.pt/public/pt.cienciaviva.io/recursos/files/insetos_em_ordem_3517648335f7ca.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ciência Viva: a relação com as formigas
          </a>{" "}
          e{" "}
          <a
            href="https://www.first-nature.com/insects/lb-euchloe-tagis.php"
            target="_blank"
            rel="noopener noreferrer"
          >
            plantas hospedeiras de Euchloe tagis
          </a>
          .
        </Paragraph>
      </Card>

      <Card id="annual-network" className="annual-story-card">
        <Row gutter={[32, 16]} align="bottom">
          <Col xs={24} lg={16}>
            <span className="annual-eyebrow">Voltar / A força de uma rede</span>
            <Title level={2}>Uma rede que cresce e continua a voltar</Title>
            <Paragraph>
              Os novos percursos alargam o nosso olhar. Os percursos acompanhados durante vários
              anos dão profundidade à história: só voltando ao mesmo lugar podemos distinguir uma
              época excecional de uma mudança duradoura.
            </Paragraph>
          </Col>
          <Col xs={24} lg={8}>
            <div className="annual-network-callout">
              <strong>{highlights.newCount} novos</strong>
              <span>e {highlights.veteranCount} com pelo menos cinco épocas</span>
            </div>
          </Col>
        </Row>
        <AnnualNetworkMap network={highlights.network} />
      </Card>
    </>
  );
}

function speciesNamesForTransect(timeline: TimelineData, id: string) {
  return [
    ...new Set(
      Object.values(timeline.observationsByYearDate[RESULTS_YEAR] || {})
        .flat()
        .filter(([tid, , count]) => tid === id && count > 0)
        .map(([, species]) => species)
        .filter(species => VALID_SPECIES.has(species))
    ),
  ].sort();
}
