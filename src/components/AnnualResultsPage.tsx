import { useEffect, useState } from "react";
import { Alert, Card, Col, Row, Spin, Statistic, Typography } from "antd";
import { Link } from "react-router-dom";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";
import { RESULTS_YEAR, summarizeYear } from "../utils/annualResults";
import AnnualOverview from "./AnnualOverview";
import AuriniaResultsSection from "./AuriniaResultsSection";
import AnnualParticipation, { MunicipalityCoverage } from "./AnnualParticipation";
import { PhotoCredit } from "./AnnualSpeciesPhoto";
import "./AnnualResultsPage.css";
import VanessaWaveSection from "./VanessaWaveSection";

const { Title, Paragraph, Text } = Typography;
export default function AnnualResultsPage() {
  const [data, setData] = useState<{ timeline: TimelineData; transects: TransectData } | null>(
    null
  );
  const [extras, setExtras] = useState<{
    names: Record<string, string>;
    credits: Record<string, PhotoCredit>;
    coverage: MunicipalityCoverage[] | null;
  }>({ names: {}, credits: {}, coverage: null });
  const [error, setError] = useState(false);
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
    // Editorial assets are optional: core results remain available if any fail to load.
    const optional = async (file: string) => {
      try {
        const response = await window.fetch(`data/${file}`);
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    };
    void Promise.all([
      optional("common-names.json"),
      optional("photo-credits.json"),
      optional("results-photo-credits.json"),
      optional("municipality-coverage.json"),
    ]).then(([names, credits, resultsCredits, coverage]) => {
      if (!cancelled)
        setExtras({ names: names || {}, credits: { ...credits, ...resultsCredits }, coverage });
    });
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  if (error)
    return (
      <Alert
        type="error"
        showIcon
        message="Erro ao carregar os resultados"
        description="Tente carregar a página novamente."
      />
    );
  if (!data)
    return <Spin aria-label="A carregar resultados" style={{ display: "block", margin: 48 }} />;
  const current = summarizeYear(data.timeline, RESULTS_YEAR);
  const previous = summarizeYear(data.timeline, RESULTS_YEAR - 1);
  const metrics = [
    ["Espécies observadas", "species"],
    ["Indivíduos contados", "individuals"],
    ["Visitas", "visits"],
    ["Transectos ativos", "transects"],
  ] as const;
  return (
    <main className="annual-page">
      <header className="annual-page-header">
        <Link to="/transects">← Visão geral dos transectos</Link>
        <Title>Resultados de {RESULTS_YEAR}</Title>
        <Paragraph>
          Percursos que se repetem, descobertas que se somam. De março a setembro, cada visita ajuda
          a conhecer as borboletas de Portugal e os habitats de que dependem. Estes são os registos
          de 2026, em comparação com 2025.
        </Paragraph>
      </header>
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
      {current && (
        <AnnualOverview
          timeline={data.timeline}
          transects={data.transects}
          names={extras.names}
          credits={extras.credits}
        />
      )}
      <VanessaWaveSection timeline={data.timeline} transects={data.transects} />
      {current && (
        <AuriniaResultsSection
          timeline={data.timeline}
          transects={data.transects}
          names={extras.names}
          credits={extras.credits}
        />
      )}
      <AnnualParticipation coverage={extras.coverage} />
    </main>
  );
}
