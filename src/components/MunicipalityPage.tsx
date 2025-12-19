import { useState, useEffect } from "react";
import { Button, Card, Space, Typography, Spin, Alert } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate, Link } from "react-router-dom";
import { SPECIES_FAMILIES } from "../utils/speciesFamilies";

const { Title, Text } = Typography;

interface MunicipalityProperties {
  Concelho: string;
  speciesCount: number;
  transectCount: number;
  transects: { name: string; isActive: boolean }[];
  monthlySpeciesCount: { [month: number]: number };
  species: string[];
}

interface GeoJSONFeature {
  type: string;
  properties: MunicipalityProperties;
  geometry: any;
}

interface MunicipalityGeoJSON {
  type: string;
  features: GeoJSONFeature[];
}

// Helper function to convert all-caps text to title case
// Keeps Portuguese prepositions lowercase (de, da, do, das, dos)
const toTitleCase = (text: string): string => {
  const lowercaseWords = ["de", "da", "do", "das", "dos"];

  return text
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      // Always capitalize first word, otherwise check if it's a preposition
      if (index === 0 || !lowercaseWords.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
};

// Helper function to group species by family and sort
const groupSpeciesByFamily = (speciesList: string[]) => {
  const familyGroups: Record<string, string[]> = {};

  speciesList.forEach(species => {
    const family = SPECIES_FAMILIES[species] || "Unknown";
    if (!familyGroups[family]) {
      familyGroups[family] = [];
    }
    familyGroups[family].push(species);
  });

  // Sort species within each family
  Object.keys(familyGroups).forEach(family => {
    familyGroups[family].sort();
  });

  // Sort families alphabetically
  const sortedFamilies = Object.keys(familyGroups).sort();

  return { familyGroups, sortedFamilies };
};

function MunicipalityPage() {
  const { municipalityName } = useParams<{ municipalityName: string }>();
  const navigate = useNavigate();

  const [geoData, setGeoData] = useState<MunicipalityGeoJSON | null>(null);
  const [loading, setLoading] = useState(true);

  // Decode the municipality name from URL
  const decodedMunicipalityName = municipalityName ? decodeURIComponent(municipalityName) : "";

  // Load GeoJSON data
  useEffect(() => {
    // eslint-disable-next-line no-undef
    fetch("data/municipalities-species-map.geojson")
      .then(res => res.json())
      .then(data => {
        setGeoData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleGoBack = () => {
    navigate("/transects");
  };

  if (loading) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
        <Spin size="large" />
      </Space>
    );
  }

  if (!geoData) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
        <Alert message="Erro ao carregar dados" type="error" />
      </Space>
    );
  }

  // Find the municipality in the GeoJSON data (case-insensitive)
  const municipalityFeature = geoData.features.find(
    f => f.properties.Concelho.toLowerCase() === decodedMunicipalityName.toLowerCase()
  );

  if (!municipalityFeature) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
        <Button type="default" icon={<ArrowLeftOutlined />} onClick={handleGoBack} size="large">
          Voltar à Visão Geral
        </Button>
        <Alert message="Município não encontrado" type="warning" />
      </Space>
    );
  }

  const { Concelho, species, speciesCount, transectCount, transects } = municipalityFeature.properties;

  // Group species by family
  const { familyGroups, sortedFamilies } = groupSpeciesByFamily(species);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", padding: 24 }}>
      <Button type="default" icon={<ArrowLeftOutlined />} onClick={handleGoBack} size="large">
        Voltar à Visão Geral
      </Button>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Title level={2} style={{ marginBottom: 0 }}>
            {toTitleCase(Concelho)}
          </Title>
          <div>
            <Text strong style={{ fontSize: 16 }}>
              Espécies registadas: {speciesCount}
            </Text>
            <br />
            <Text strong style={{ fontSize: 16 }}>
              Transectos: {transectCount}
            </Text>
          </div>

          {transects && transects.length > 0 && (
            <div>
              <Text strong>Transectos:</Text>
              <ul style={{ marginTop: 8 }}>
                {transects.map((transect, idx) => (
                  <li key={idx}>
                    <span style={{ color: transect.isActive ? "green" : "red" }}>
                      {transect.isActive ? "✓" : "✗"}
                    </span>{" "}
                    {transect.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Space>
      </Card>

      <Card title={`Espécies Registadas (${speciesCount})`}>
        {species.length === 0 ? (
          <Alert message="Sem dados de espécies para este município" type="info" />
        ) : (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {sortedFamilies.map(family => (
              <div key={family}>
                <Title level={4}>{family}</Title>
                <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                  {familyGroups[family].map(speciesName => (
                    <li key={speciesName} style={{ marginBottom: 8 }}>
                      <Link
                        to={`/species/${encodeURIComponent(speciesName)}`}
                        style={{ fontSize: 15 }}
                      >
                        <Text italic>{speciesName}</Text>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  );
}

export default MunicipalityPage;
