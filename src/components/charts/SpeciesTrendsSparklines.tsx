import React, { useEffect, useState } from "react";
import { Collapse, Typography, Row, Col, Spin } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import TrendClassificationBadge from "../TrendClassificationBadge";
import type { SpeciesTrend as GBISpeciesTrend, TrendCategory } from "../../types/gbiData";

const { Title, Text } = Typography;

interface SpeciesTrend {
  species: string;
  indices: number[];
  years: number[];
  trend: number; // Percentage change from first to last year
  direction: "up" | "down" | "stable";
  ciLower?: number[];
  ciUpper?: number[];
  trendClassification?: GBISpeciesTrend["trendClassification"];
}

const SpeciesTrendsSparklines: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [speciesTrends, setSpeciesTrends] = useState<SpeciesTrend[]>([]);

  useEffect(() => {
    fetchFlightCurvesData();
  }, []);

  const fetchFlightCurvesData = async () => {
    try {
      // Fetch both GBI data and flight curves data
      const [gbiResponse, flightResponse] = await Promise.all([
        // eslint-disable-next-line no-undef
        fetch("data/gbi-data.json").catch(() => null),
        // eslint-disable-next-line no-undef
        fetch("data/flight-curves-data.json").catch(() => null),
      ]);

      const gbiData = gbiResponse ? await gbiResponse.json() : null;
      const flightData = flightResponse ? await flightResponse.json() : null;

      // Process species data from both sources
      const trends: SpeciesTrend[] = [];

      // Helper function to process species data
      const processSpecies = (speciesName: string, speciesData: any) => {
        const { annualIndices, collatedIndices, confidenceIntervals, trendClassification } =
          speciesData;

        // Use annualIndices (from GBI) or collatedIndices (from flight curves)
        const indicesData = annualIndices || collatedIndices;
        if (!indicesData) return;

        const years = Object.keys(indicesData)
          .map(Number)
          .sort((a, b) => a - b);
        const indices = years.map(year => indicesData[year]);

        if (indices.length >= 2) {
          const firstValue = indices[0];
          const lastValue = indices[indices.length - 1];
          const trend = ((lastValue - firstValue) / firstValue) * 100;

          let direction: "up" | "down" | "stable" = "stable";
          if (trend > 5) direction = "up";
          else if (trend < -5) direction = "down";

          // Extract confidence intervals if available
          let ciLower: number[] | undefined;
          let ciUpper: number[] | undefined;
          if (confidenceIntervals) {
            ciLower = years.map(year => confidenceIntervals[year]?.ci_lower ?? 0);
            ciUpper = years.map(year => confidenceIntervals[year]?.ci_upper ?? 0);
          }

          trends.push({
            species: speciesName,
            indices,
            years,
            trend,
            direction,
            ciLower,
            ciUpper,
            trendClassification,
          });
        }
      };

      // Process GBI species
      if (gbiData?.speciesTrends) {
        Object.entries(gbiData.speciesTrends as Record<string, GBISpeciesTrend>).forEach(
          ([speciesName, speciesData]) => processSpecies(speciesName, speciesData)
        );
      }

      // Process flight curves species (skip if already in GBI)
      if (flightData?.species) {
        const gbiSpeciesSet = new Set(trends.map(t => t.species));
        Object.entries(flightData.species as Record<string, any>).forEach(
          ([speciesName, speciesData]) => {
            if (!gbiSpeciesSet.has(speciesName)) {
              processSpecies(speciesName, speciesData);
            }
          }
        );
      }

      // Sort by trend percentage (highest first)
      // Prefer annualRateOfChange from trendClassification if available
      trends.sort((a, b) => {
        const aTrend = a.trendClassification?.annualRateOfChange ?? a.trend;
        const bTrend = b.trendClassification?.annualRateOfChange ?? b.trend;
        return bTrend - aTrend;
      });

      setSpeciesTrends(trends);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error loading species data:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderSparkline = (
    indices: number[],
    trendValue: number,
    ciLower?: number[],
    ciUpper?: number[],
    width = 60,
    height = 30
  ) => {
    if (indices.length < 2) return null;

    // Calculate min/max including CI bounds
    const allValues = [...indices];
    if (ciLower) allValues.push(...ciLower);
    if (ciUpper) allValues.push(...ciUpper);
    const max = Math.max(...allValues);
    const min = Math.min(...allValues);
    const range = max - min || 1;

    // Generate main line points
    const points = indices.map((value, i) => {
      const x = (i / (indices.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });

    const pathData = `M ${points.join(" L ")}`;

    // Determine color based on trend value (annual rate of change or simple trend)
    let strokeColor = "#d9d9d9";
    if (trendValue > 0) {
      strokeColor = "#52c41a"; // Green for positive
    } else if (trendValue < 0) {
      strokeColor = "#ff4d4f"; // Red for negative
    }

    // Generate CI band path if available
    let ciBandPath = "";
    if (ciLower && ciUpper && ciLower.length === indices.length) {
      const upperPoints = ciUpper.map((value, i) => {
        const x = (i / (ciUpper.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      });
      const lowerPoints = ciLower.map((value, i) => {
        const x = (i / (ciLower.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      });
      // Create a closed path: upper line forward, lower line backward
      ciBandPath = `M ${upperPoints.join(" L ")} L ${lowerPoints.reverse().join(" L ")} Z`;
    }

    return (
      <svg width={width} height={height} style={{ display: "block" }}>
        {/* Confidence interval band */}
        {ciBandPath && <path d={ciBandPath} fill={strokeColor} fillOpacity="0.15" stroke="none" />}

        {/* Main line */}
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Dots at each data point */}
        {points.map((point, i) => {
          const [x, y] = point.split(",").map(Number);
          return <circle key={i} cx={x} cy={y} r="2" fill={strokeColor} />;
        })}
      </svg>
    );
  };

  const getTrendIcon = (direction: "up" | "down" | "stable") => {
    if (direction === "up") return <ArrowUpOutlined style={{ color: "#52c41a" }} />;
    if (direction === "down") return <ArrowDownOutlined style={{ color: "#ff4d4f" }} />;
    return <MinusOutlined style={{ color: "#d9d9d9" }} />;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 5) return "#52c41a";
    if (trend < -5) return "#ff4d4f";
    return "#8c8c8c";
  };

  if (loading) {
    return (
      <Collapse
        items={[
          {
            key: "1",
            label: (
              <div>
                <Title level={4} style={{ marginBottom: 0, display: "inline" }}>
                  Tendências por Espécie
                </Title>
              </div>
            ),
            children: (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Spin size="large" />
              </div>
            ),
          },
        ]}
      />
    );
  }

  // Calculate trend summary by classification category
  const categorySummary: Record<TrendCategory | "Unknown", number> = speciesTrends.reduce(
    (acc, trend) => {
      const category = trend.trendClassification?.category || "Unknown";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    },
    {} as Record<TrendCategory | "Unknown", number>
  );

  const items = [
    {
      key: "1",
      label: (
        <div>
          <Title level={4} style={{ marginBottom: 0, display: "inline" }}>
            Tendências por Espécie ({speciesTrends.length} espécies)
          </Title>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              {categorySummary["Strong increase"] && (
                <>
                  <span style={{ color: "#52c41a" }}>
                    ↑↑ {categorySummary["Strong increase"]} aumento forte
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Moderate increase"] && (
                <>
                  <span style={{ color: "#95de64" }}>
                    ↑ {categorySummary["Moderate increase"]} aumento moderado
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Stable"] && (
                <>
                  <span style={{ color: "#1890ff" }}>− {categorySummary["Stable"]} estáveis</span>
                  {" • "}
                </>
              )}
              {categorySummary["Moderate decline"] && (
                <>
                  <span style={{ color: "#fa8c16" }}>
                    ↓ {categorySummary["Moderate decline"]} declínio moderado
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Strong decline"] && (
                <>
                  <span style={{ color: "#f5222d" }}>
                    ↓↓ {categorySummary["Strong decline"]} declínio forte
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Uncertain"] && (
                <>
                  <span style={{ color: "#8c8c8c" }}>
                    ? {categorySummary["Uncertain"]} incertos
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Unknown"] && (
                <span style={{ color: "#d9d9d9" }}>
                  {categorySummary["Unknown"]} sem classificação
                </span>
              )}
            </Text>
          </div>
        </div>
      ),
      children: (
        <div style={{ maxHeight: 600, overflowY: "auto" }}>
          <Row gutter={[16, 12]}>
            {speciesTrends.map((trend, idx) => (
              <Col span={24} key={idx}>
                <Link
                  to={`/species/${encodeURIComponent(trend.species)}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 4,
                    background: "#fafafa",
                    border: "1px solid #f0f0f0",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "#f5f5f5";
                    e.currentTarget.style.borderColor = "#d9d9d9";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "#fafafa";
                    e.currentTarget.style.borderColor = "#f0f0f0";
                  }}
                >
                  {/* Species name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text italic strong style={{ fontSize: 13 }}>
                      {trend.species}
                    </Text>
                  </div>

                  {/* Sparkline */}
                  <div style={{ marginLeft: 16 }}>
                    {renderSparkline(
                      trend.indices,
                      trend.trendClassification?.annualRateOfChange ?? trend.trend,
                      trend.ciLower,
                      trend.ciUpper
                    )}
                  </div>

                  {/* Trend classification badge or fallback */}
                  <div
                    style={{
                      marginLeft: 16,
                      minWidth: 180,
                      textAlign: "right",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 8,
                    }}
                  >
                    {trend.trendClassification ? (
                      <>
                        <Text
                          strong
                          style={{
                            color: getTrendColor(trend.trendClassification.annualRateOfChange || 0),
                            fontSize: 14,
                            minWidth: 60,
                            textAlign: "right",
                          }}
                        >
                          {(trend.trendClassification.annualRateOfChange || 0) > 0 ? "+" : ""}
                          {trend.trendClassification.annualRateOfChange?.toFixed(1)}%/ano
                        </Text>
                        <TrendClassificationBadge
                          classification={trend.trendClassification}
                          showDetails={false}
                        />
                      </>
                    ) : (
                      <>
                        {getTrendIcon(trend.direction)}
                        <Text
                          strong
                          style={{
                            color: getTrendColor(trend.trend),
                            fontSize: 14,
                          }}
                        >
                          {trend.trend > 0 ? "+" : ""}
                          {trend.trend.toFixed(1)}%
                        </Text>
                      </>
                    )}
                  </div>
                </Link>
              </Col>
            ))}
          </Row>
        </div>
      ),
    },
  ];

  return <Collapse items={items} defaultActiveKey={["1"]} />;
};

export default SpeciesTrendsSparklines;
