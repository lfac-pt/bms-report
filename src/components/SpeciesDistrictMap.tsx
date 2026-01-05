import React, { useEffect, useState, useMemo } from "react";
import { Card, Typography, Spin } from "antd";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { TransectStats } from "../types/transectStats";
import "leaflet/dist/leaflet.css";

const { Text } = Typography;

// Rarity levels - same as in speciesCardUtils.ts
interface RarityLevel {
  label: string;
  color: string;
  percentageThreshold: number;
}

const RARITY_LEVELS: RarityLevel[] = [
  { label: 'Muito Comum', color: '#52c41a', percentageThreshold: 80 },
  { label: 'Comum', color: '#95de64', percentageThreshold: 60 },
  { label: 'Pouco Comum', color: '#ffd666', percentageThreshold: 40 },
  { label: 'Rara', color: '#ff9c6e', percentageThreshold: 20 },
  { label: 'Muito Rara', color: '#ff4d4f', percentageThreshold: 0 },
];

interface DistrictObservations {
  district: string;
  totalTransectYears: number; // Total transect-years in district
  transectYearsWithSpecies: number; // Transect-years where species was observed
  percentage: number; // Percentage of transect-years with species
  rarityLevel: RarityLevel;
  transects: string[]; // Names of transects in this district
  totalSeasons: number; // Total unique years with monitoring in district
  seasonsWithSpecies: number; // Unique years where species was observed
  seasonPercentage: number; // Percentage of seasons with species
}

interface MunicipalityProperties {
  Distrito: string;
  Concelho: string;
  [key: string]: any;
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

interface SpeciesDistrictMapProps {
  speciesName: string;
  transectData: TransectStats[];
  timelineData: any;
}

const SpeciesDistrictMap: React.FC<SpeciesDistrictMapProps> = ({
  speciesName,
  transectData,
  timelineData,
}) => {
  const [geoData, setGeoData] = useState<MunicipalityGeoJSON | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("data/portugal-districts.geojson")
      .then(res => res.json())
      .then(data => {
        setGeoData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error loading geographic data:", error);
        setLoading(false);
      });
  }, []);

  // Calculate rarity (transect-year percentages) for each district
  const districtObservations = useMemo(() => {
    const observations = new Map<string, DistrictObservations>();

    if (!timelineData) return observations;

    // Group transects by district
    const transectsByDistrict = new Map<string, Set<string>>();
    const transectNames = new Map<string, string>();

    transectData.forEach(transect => {
      const district = transect.distrito;
      if (!district) return;

      const districtUpper = district.toUpperCase();

      if (!transectsByDistrict.has(districtUpper)) {
        transectsByDistrict.set(districtUpper, new Set());
      }

      transectsByDistrict.get(districtUpper)!.add(transect.transectId);
      transectNames.set(transect.transectId, transect.transectName);
    });

    // Calculate transect-year statistics for each district
    transectsByDistrict.forEach((transectIds, districtUpper) => {
      let totalTransectYears = 0;
      let transectYearsWithSpecies = 0;
      const yearsWithMonitoring = new Set<number>();
      const yearsWithSpecies = new Set<number>();

      // Iterate through each year in the timeline
      for (const year of timelineData.years || []) {
        const yearData = timelineData.transectsByYear?.[year];
        if (!yearData) continue;

        let districtHadMonitoringThisYear = false;
        let districtHadSpeciesThisYear = false;

        // For each transect in this district
        for (const transectId of transectIds) {
          // Check if this transect was active this year
          if (yearData.includes(transectId)) {
            totalTransectYears++;
            districtHadMonitoringThisYear = true;

            // Check if this species was observed in this transect this year
            const yearObservations = timelineData.observationsByYearDate?.[year];
            if (yearObservations) {
              let foundSpecies = false;
              // Check all dates in this year
              for (const dateObservations of Object.values(yearObservations)) {
                for (const [obsTransectId, obsSpecies] of dateObservations as [string, string][]) {
                  if (obsTransectId === transectId && obsSpecies === speciesName) {
                    foundSpecies = true;
                    break;
                  }
                }
                if (foundSpecies) break;
              }
              if (foundSpecies) {
                transectYearsWithSpecies++;
                districtHadSpeciesThisYear = true;
              }
            }
          }
        }

        if (districtHadMonitoringThisYear) {
          yearsWithMonitoring.add(year);
        }
        if (districtHadSpeciesThisYear) {
          yearsWithSpecies.add(year);
        }
      }

      // Calculate percentages
      const percentage = totalTransectYears > 0
        ? (transectYearsWithSpecies / totalTransectYears) * 100
        : 0;

      const totalSeasons = yearsWithMonitoring.size;
      const seasonsWithSpecies = yearsWithSpecies.size;
      const seasonPercentage = totalSeasons > 0
        ? (seasonsWithSpecies / totalSeasons) * 100
        : 0;

      // Find matching rarity level
      let rarityLevel = RARITY_LEVELS[RARITY_LEVELS.length - 1]; // Default to "Muito Rara"
      for (const level of RARITY_LEVELS) {
        if (percentage >= level.percentageThreshold) {
          rarityLevel = level;
          break;
        }
      }

      // Get transect names for this district
      const transectNamesArray = Array.from(transectIds)
        .map(id => transectNames.get(id))
        .filter((name): name is string => name !== undefined);

      observations.set(districtUpper, {
        district: districtUpper,
        totalTransectYears,
        transectYearsWithSpecies,
        percentage,
        rarityLevel,
        transects: transectNamesArray,
        totalSeasons,
        seasonsWithSpecies,
        seasonPercentage,
      });
    });

    return observations;
  }, [transectData, speciesName, timelineData]);

  const getColor = (observations: DistrictObservations | undefined): string => {
    if (!observations) {
      return "#f5f5f5"; // Very light grey for districts without transects
    }

    if (observations.percentage === 0) {
      return "#d9d9d9"; // Grey for districts with transects but no observations
    }

    // Find matching rarity level and return its color
    for (const level of RARITY_LEVELS) {
      if (observations.percentage >= level.percentageThreshold) {
        return level.color;
      }
    }

    return RARITY_LEVELS[RARITY_LEVELS.length - 1].color; // Default to "Muito Rara"
  };

  const style = (feature: GeoJSONFeature | undefined) => {
    if (!feature) return {};

    const district = feature.properties.dis_name_upper || feature.properties.Distrito;
    const observations = districtObservations.get(district);

    return {
      fillColor: getColor(observations),
      weight: 1,
      opacity: 1,
      color: "#666",
      fillOpacity: 0.7,
    };
  };

  const onEachFeature = (feature: GeoJSONFeature, layer: any) => {
    const district = feature.properties.dis_name_upper || feature.properties.Distrito;
    const districtName = feature.properties.dis_name || district;
    const observations = districtObservations.get(district);

    let popupContent = `<strong>${districtName}</strong><br/><br/>`;

    if (!observations) {
      // District has no monitoring transects
      popupContent += `<span style="color: #8c8c8c;">Sem transectos monitorizados neste distrito</span>`;
    } else if (observations.percentage === 0) {
      // District has transects but species was never observed
      popupContent += `<span style="color: #8c8c8c;">Não observada neste distrito</span><br/>`;
      popupContent += `Épocas de monitorização: ${observations.totalSeasons}`;
    } else {
      // District has observations of the species
      popupContent += `Observado em ${observations.seasonsWithSpecies} de ${observations.totalSeasons} ${
        observations.totalSeasons === 1 ? 'época' : 'épocas'
      } de monitorização no distrito (${observations.seasonPercentage.toFixed(1)}%)`;
    }

    layer.bindPopup(popupContent);

    // Highlight on hover
    layer.on({
      mouseover: (e: any) => {
        const layer = e.target;
        layer.setStyle({
          weight: 3,
          color: "#333",
          fillOpacity: 0.9,
        });
      },
      mouseout: (e: any) => {
        const layer = e.target;
        layer.setStyle(style(feature));
      },
    });
  };

  if (loading) {
    return (
      <Card title="Distribuição por Distrito">
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!geoData) {
    return (
      <Card title="Distribuição por Distrito">
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Text type="secondary">Erro ao carregar dados do mapa</Text>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Distribuição por Distrito">
      <div style={{ height: 600, marginBottom: 16 }}>
        <MapContainer center={[39.5, -8.0]} zoom={7} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {geoData && (
            <GeoJSON
              key={speciesName}
              data={geoData as any}
              style={style}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>
      </div>

      {/* Legend - Rarity Levels */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Text strong>Legenda:</Text>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 20,
              height: 20,
              backgroundColor: "#f5f5f5",
              border: "1px solid #666",
            }}
          />
          <Text>Sem transectos</Text>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 20,
              height: 20,
              backgroundColor: "#d9d9d9",
              border: "1px solid #666",
            }}
          />
          <Text>Não observada</Text>
        </div>
        {RARITY_LEVELS.map((level) => (
          <div key={level.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 20,
                height: 20,
                backgroundColor: level.color,
                border: "1px solid #666",
              }}
            />
            <Text>{level.label}</Text>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default SpeciesDistrictMap;
