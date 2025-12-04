import { Button, Card, Space, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { SPECIES_FAMILIES } from "../utils/speciesFamilies";

const { Title, Text } = Typography;

function SpeciesPage() {
  const { speciesName } = useParams<{ speciesName: string }>();
  const navigate = useNavigate();

  // Decode the species name from URL
  const decodedSpeciesName = speciesName ? decodeURIComponent(speciesName) : "";
  const family = SPECIES_FAMILIES[decodedSpeciesName] || "Informação não disponível";

  const handleGoBack = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
      <Button type="default" icon={<ArrowLeftOutlined />} onClick={handleGoBack} size="large">
        Voltar à Visão Geral
      </Button>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Title level={2} italic style={{ marginBottom: 0 }}>
            {decodedSpeciesName}
          </Title>
          <Text strong style={{ fontSize: 16 }}>
            Família: {family}
          </Text>
        </Space>
      </Card>
    </Space>
  );
}

export default SpeciesPage;
