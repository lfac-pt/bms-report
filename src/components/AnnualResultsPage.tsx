import { useEffect, useState } from "react";
import { Alert, Card, Col, Row, Space, Spin, Statistic, Typography } from "antd";
import { Link } from "react-router-dom";
import { TimelineData } from "../types/timelineData";
import { TransectData } from "../types/transectStats";
import { RESULTS_YEAR, summarizeYear } from "../utils/annualResults";
import VanessaWaveSection from "./VanessaWaveSection";

const { Title, Paragraph, Text } = Typography;
export default function AnnualResultsPage() {
  const [data, setData] = useState<{ timeline: TimelineData; transects: TransectData } | null>(
    null
  );
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
      <VanessaWaveSection timeline={data.timeline} transects={data.transects} />
    </Space>
  );
}
