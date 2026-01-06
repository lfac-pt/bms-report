import React, { useEffect, useState, useMemo } from "react";
import { Card, Typography, Spin } from "antd";
import type { TransectStats } from "../types/transectStats";

const { Text } = Typography;

// Helper function to convert lat/lon to Web Mercator projection
function latLonToMercator(lon: number, lat: number): [number, number] {
  const x = lon;
  const y = Math.log(Math.tan((Math.PI / 4) + (lat * Math.PI / 360))) * (180 / Math.PI);
  return [x, y];
}

// Helper function to convert GeoJSON coordinates to SVG path
function coordinatesToPath(geometry: any, bounds: any): string {
  if (!bounds) return '';

  const paths: string[] = [];

  function processRing(ring: number[][]): string {
    if (!ring || ring.length === 0) return '';

    const points = ring.map((coord) => {
      const lon = coord[0];
      const lat = coord[1];
      const [mercX, mercY] = latLonToMercator(lon, lat);
      const x = ((mercX - bounds.minMercX) / (bounds.maxMercX - bounds.minMercX)) * 100;
      const y = ((bounds.maxMercY - mercY) / (bounds.maxMercY - bounds.minMercY)) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `M ${points.join(' L ')} Z`;
  }

  function processPoly(rings: number[][][]): string {
    if (!rings || rings.length === 0) return '';
    return rings.map(ring => processRing(ring)).join(' ');
  }

  if (geometry.type === 'Polygon') {
    paths.push(processPoly(geometry.coordinates));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((poly: number[][][]) => {
      paths.push(processPoly(poly));
    });
  }

  return paths.join(' ');
}

// Calculate bounds for the GeoJSON in Mercator projection
function calculateBounds(features: any[]): any {
  let minMercX = Infinity, maxMercX = -Infinity;
  let minMercY = Infinity, maxMercY = -Infinity;

  function processCoords(coords: any) {
    if (typeof coords[0] === 'number') {
      const [mercX, mercY] = latLonToMercator(coords[0], coords[1]);
      minMercX = Math.min(minMercX, mercX);
      maxMercX = Math.max(maxMercX, mercX);
      minMercY = Math.min(minMercY, mercY);
      maxMercY = Math.max(maxMercY, mercY);
    } else {
      coords.forEach(processCoords);
    }
  }

  features.forEach(feature => {
    processCoords(feature.geometry.coordinates);
  });

  return { minMercX, maxMercX, minMercY, maxMercY };
}

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
  compact?: boolean;
}

const SpeciesDistrictMap: React.FC<SpeciesDistrictMapProps> = ({
  speciesName,
  transectData,
  timelineData,
  compact = false,
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

  // Calculate bounds for SVG viewBox - must be called before any conditional returns
  const bounds = useMemo(() => {
    if (!geoData) return null;
    // Only calculate bounds for continental Portugal (exclude islands)
    const continentalFeatures = geoData.features.filter((feature: GeoJSONFeature) => {
      const districtName = feature.properties.dis_name_upper || feature.properties.Distrito;
      return districtName !== 'AÇORES' && districtName !== 'MADEIRA';
    });
    return calculateBounds(continentalFeatures);
  }, [geoData]);

  if (loading) {
    return compact ? (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <Spin size="default" />
      </div>
    ) : (
      <Card title="Distribuição por Distrito">
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!geoData) {
    return compact ? (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <Text type="secondary">Erro ao carregar dados do mapa</Text>
      </div>
    ) : (
      <Card title="Distribuição por Distrito">
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Text type="secondary">Erro ao carregar dados do mapa</Text>
        </div>
      </Card>
    );
  }

  const mapHeight = compact ? 350 : 600;

  const mapContent = (
    <>
      <div style={{
        height: mapHeight,
        position: "relative",
        maxWidth: compact ? 280 : "100%",
        margin: compact ? "0 0 0 auto" : 0
      }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: "100%",
            height: "100%",
            background: "#f8f9fa",
            border: "1px solid #e0e0e0",
            borderRadius: 4
          }}
        >
          {geoData && bounds && geoData.features
            .filter((feature: GeoJSONFeature) => {
              const districtName = feature.properties.dis_name_upper || feature.properties.Distrito;
              // Only show continental Portugal (exclude islands)
              return districtName !== 'AÇORES' && districtName !== 'MADEIRA';
            })
            .map((feature: GeoJSONFeature) => {
            const district = feature.properties.dis_name_upper || feature.properties.Distrito;
            const districtName = feature.properties.dis_name || district;
            const observations = districtObservations.get(district);
            const color = getColor(observations);
            const path = coordinatesToPath(feature.geometry, bounds);

            const tooltipContent = !observations
              ? `${districtName}\n\nSem transectos monitorizados neste distrito`
              : observations.percentage === 0
              ? `${districtName}\n\nNão observada neste distrito\nÉpocas de monitorização: ${observations.totalSeasons}`
              : `${districtName}\n\n${observations.rarityLevel.label}\nObservado em ${observations.seasonsWithSpecies} de ${observations.totalSeasons} ${
                  observations.totalSeasons === 1 ? 'época' : 'épocas'
                } de monitorização no distrito (${observations.seasonPercentage.toFixed(1)}%)`;

            return (
              <g key={district}>
                <path
                  d={path}
                  fill={color}
                  stroke="#666"
                  strokeWidth="0.3"
                  opacity={0.9}
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.strokeWidth = '0.6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                    e.currentTarget.style.strokeWidth = '0.3';
                  }}
                >
                  <title>{tooltipContent}</title>
                </path>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );

  return compact ? mapContent : <Card title="Distribuição por Distrito">{mapContent}</Card>;
};

export default SpeciesDistrictMap;
