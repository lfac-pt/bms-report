import { useMemo, useState } from "react";
import { Button, Card, Select, Typography } from "antd";
import { municipalityGaps } from "../utils/annualHighlights";

const { Title, Paragraph } = Typography;
export interface MunicipalityCoverage {
  Concelho: string;
  transectCount: number;
}
export default function AnnualParticipation({
  coverage,
}: {
  coverage: MunicipalityCoverage[] | null;
}) {
  const gaps = useMemo(() => (coverage ? municipalityGaps(coverage) : []), [coverage]);
  const [chosen, setChosen] = useState<string>();
  const examples = ["Águeda", "Cantanhede", "Figueira da Foz"].filter(name => gaps.includes(name));
  return (
    <Card className="annual-participation" id="annual-participation">
      <span className="annual-eyebrow">Participar / A próxima época começa consigo</span>
      <Title level={2}>Em março de 2027, este mapa pode ter o seu percurso</Title>
      <Paragraph className="annual-lead">
        O que podemos aprender porque alguém volta ao mesmo lugar? Um percurso perto de casa ou do
        trabalho pode tornar-se uma janela para a biodiversidade do seu concelho.
      </Paragraph>
      {gaps.length > 0 && (
        <div className="annual-coverage">
          <Paragraph>
            Nos metadados disponíveis, há concelhos sem transectos identificados
            {examples.length ? `, como ${examples.join(", ")}` : ""}. Pode ajudar a alargar esta
            rede.
          </Paragraph>
          <Select
            aria-label="Procurar concelhos sem transectos nos metadados"
            showSearch
            allowClear
            value={chosen}
            onChange={setChosen}
            placeholder="O seu concelho está entre eles?"
            options={gaps.map(name => ({ value: name, label: name }))}
            style={{ width: "100%", maxWidth: 460 }}
          />
          {chosen && (
            <Paragraph className="annual-selection">
              <strong>{chosen}</strong> ainda não tem um transecto identificado nestes metadados.
              Que percurso gostaria de acompanhar?
            </Paragraph>
          )}
          <Paragraph className="annual-note">
            Esta é uma lacuna no conjunto de metadados, não uma confirmação de ausência de
            monitorização no concelho. Inclui transectos de todas as épocas, mesmo os atualmente
            inativos.
          </Paragraph>
        </div>
      )}
      <ol className="annual-steps">
        <li>
          <strong>Escolha um percurso acessível</strong>
          <span>Cerca de 1 km, fácil de visitar com regularidade.</span>
        </li>
        <li>
          <strong>Prepare-o com o Tagis</strong>
          <span>A equipa ajuda a definir o percurso e as suas secções.</span>
        </li>
        <li>
          <strong>Volte e conte</strong>
          <span>A regularidade das visitas transforma observações em conhecimento.</span>
        </li>
      </ol>
      <Button
        type="primary"
        size="large"
        href="https://www.tagis.pt/censos-de-borboletas.html"
        target="_blank"
        rel="noopener noreferrer"
      >
        Quero começar um transecto →
      </Button>
      <Paragraph className="annual-note">
        Orientações de participação: Tagis · Censos de Borboletas de Portugal. Pode preparar o seu
        percurso antes da próxima primavera.
      </Paragraph>
    </Card>
  );
}
