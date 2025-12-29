import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Space, Typography, Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { GBIData } from "../types/gbiData";
import GrasslandButterflyIndex from "./charts/GrasslandButterflyIndex";

const { Title } = Typography;

function GBIPage() {
  const navigate = useNavigate();
  const [gbiData, setGbiData] = useState<GBIData | null>(null);
  const [loading, setLoading] = useState(true);

  // Load GBI data
  useEffect(() => {
    // eslint-disable-next-line no-undef
    fetch("data/gbi-data.json")
      .then(res => res.json())
      .then(data => {
        setGbiData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleGoBack = () => {
    navigate("/transects");
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleGoBack}>
          Voltar
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          Relatório GBI
        </Title>
      </div>

      <GrasslandButterflyIndex gbiData={gbiData} loading={loading} />
    </Space>
  );
}

export default GBIPage;
