import React, { useEffect, useState } from 'react';
import { Collapse, Typography, Spin } from 'antd';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const { Title, Text } = Typography;

interface TransectInfo {
  name: string;
  isActive: boolean;
}

interface MunicipalityProperties {
  Concelho: string;
  speciesCount: number;
  transectCount: number;
  transects: TransectInfo[];
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

const MunicipalitySpeciesMap: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState<MunicipalityGeoJSON | null>(null);
  const [maxSpecies, setMaxSpecies] = useState(0);

  useEffect(() => {
    fetchGeoJSONData();
  }, []);

  const fetchGeoJSONData = async () => {
    try {
      const response = await fetch('/data/municipalities-species-map.geojson');
      const data: MunicipalityGeoJSON = await response.json();

      // Find max species count for color scaling
      const max = Math.max(...data.features.map(f => f.properties.speciesCount));
      setMaxSpecies(max);
      setGeoData(data);
    } catch (error) {
      console.error('Error loading municipality data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getColor = (speciesCount: number): string => {
    if (speciesCount === 0) return '#d9d9d9'; // Grey for no data

    // Color scale from light yellow to dark green
    const ratio = speciesCount / maxSpecies;
    if (ratio < 0.2) return '#fff7bc';
    if (ratio < 0.4) return '#fee391';
    if (ratio < 0.6) return '#fec44f';
    if (ratio < 0.8) return '#fe9929';
    return '#d95f0e';
  };

  const style = (feature: GeoJSONFeature | undefined) => {
    const speciesCount = feature?.properties.speciesCount ?? 0;
    return {
      fillColor: getColor(speciesCount),
      weight: 1,
      opacity: 1,
      color: '#666',
      fillOpacity: 0.7
    };
  };

  const onEachFeature = (feature: GeoJSONFeature, layer: any) => {
    const { Concelho, speciesCount, transectCount, transects } = feature.properties;

    let popupContent = `<strong>${Concelho}</strong><br/>`;
    if (speciesCount > 0) {
      popupContent += `Espécies: ${speciesCount}<br/>`;
      popupContent += `Transectos: ${transectCount}<br/>`;

      // Add transect list with active/inactive status
      if (transects && transects.length > 0) {
        popupContent += `<br/><strong>Transectos:</strong><br/>`;
        transects.forEach((transect: TransectInfo) => {
          const statusIcon = transect.isActive ? '✓' : '✗';
          const statusColor = transect.isActive ? 'green' : 'red';
          popupContent += `<span style="color: ${statusColor}">${statusIcon}</span> ${transect.name}<br/>`;
        });
      }
    } else {
      popupContent += `Sem dados`;
    }

    layer.bindPopup(popupContent);

    // Highlight on hover
    layer.on({
      mouseover: (e: any) => {
        const layer = e.target;
        layer.setStyle({
          weight: 3,
          color: '#333',
          fillOpacity: 0.9
        });
      },
      mouseout: (e: any) => {
        const layer = e.target;
        layer.setStyle(style(feature));
      }
    });
  };

  if (loading) {
    return (
      <Collapse
        items={[
          {
            key: '1',
            label: (
              <div>
                <Title level={4} style={{ marginBottom: 0, display: 'inline' }}>
                  Mapa de Espécies por Município
                </Title>
              </div>
            ),
            children: (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
              </div>
            ),
          },
        ]}
      />
    );
  }

  if (!geoData) {
    return (
      <Collapse
        items={[
          {
            key: '1',
            label: (
              <div>
                <Title level={4} style={{ marginBottom: 0, display: 'inline' }}>
                  Mapa de Espécies por Município
                </Title>
              </div>
            ),
            children: (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">Erro ao carregar dados do mapa</Text>
              </div>
            ),
          },
        ]}
      />
    );
  }

  const municipalitiesWithData = geoData.features.filter(f => f.properties.speciesCount > 0).length;
  const municipalitiesWithoutData = geoData.features.filter(f => f.properties.speciesCount === 0).length;

  const items = [
    {
      key: '1',
      label: (
        <div>
          <Title level={4} style={{ marginBottom: 0, display: 'inline' }}>
            Mapa de Espécies por Município
          </Title>
          <Text type="secondary" style={{ marginLeft: 16 }}>
            {municipalitiesWithData} municípios com dados (inclui transectos inativos) • {municipalitiesWithoutData} sem dados
          </Text>
        </div>
      ),
      children: (
        <div>
          <div style={{ height: 600, marginBottom: 16 }}>
            <MapContainer
              center={[39.5, -8.0]}
              zoom={7}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {geoData && (
                <GeoJSON
                  data={geoData as any}
                  style={style}
                  onEachFeature={onEachFeature}
                />
              )}
            </MapContainer>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Text strong>Legenda:</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 20, height: 20, backgroundColor: '#d9d9d9', border: '1px solid #666' }} />
              <Text>Sem dados</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 20, height: 20, backgroundColor: '#fff7bc', border: '1px solid #666' }} />
              <Text>1-{Math.ceil(maxSpecies * 0.2)} espécies</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 20, height: 20, backgroundColor: '#fee391', border: '1px solid #666' }} />
              <Text>{Math.ceil(maxSpecies * 0.2 + 1)}-{Math.ceil(maxSpecies * 0.4)} espécies</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 20, height: 20, backgroundColor: '#fec44f', border: '1px solid #666' }} />
              <Text>{Math.ceil(maxSpecies * 0.4 + 1)}-{Math.ceil(maxSpecies * 0.6)} espécies</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 20, height: 20, backgroundColor: '#fe9929', border: '1px solid #666' }} />
              <Text>{Math.ceil(maxSpecies * 0.6 + 1)}-{Math.ceil(maxSpecies * 0.8)} espécies</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 20, height: 20, backgroundColor: '#d95f0e', border: '1px solid #666' }} />
              <Text>{Math.ceil(maxSpecies * 0.8 + 1)}+ espécies</Text>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return <Collapse items={items} />;
};

export default MunicipalitySpeciesMap;
