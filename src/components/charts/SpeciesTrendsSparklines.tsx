import React, { useEffect, useState } from "react";
import { Collapse, Typography, Row, Col, Spin, Popover, List } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import TrendClassificationBadge from "../TrendClassificationBadge";
import type { SpeciesTrend as GBISpeciesTrend, TrendCategory } from "../../types/gbiData";
import { CI_RANGE_THRESHOLD, TREND_COLORS, getTrendLabel } from "../../constants";

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
  ciExceedsThreshold?: boolean;
  maxCIRange?: number;
}

const SpeciesTrendsSparklines: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [speciesTrends, setSpeciesTrends] = useState<SpeciesTrend[]>([]);

  useEffect(() => {
    fetchFlightCurvesData();
  }, []);

  const fetchFlightCurvesData = async () => {
    try {
      // Fetch flight curves data
      // eslint-disable-next-line no-undef
      const flightResponse = await fetch("data/flight-curves-data.json").catch(() => null);
      const flightData = flightResponse ? await flightResponse.json() : null;

      // Process species data
      const trends: SpeciesTrend[] = [];

      // Helper function to process species data
      const processSpecies = (speciesName: string, speciesData: any) => {
        const {
          annualIndices,
          collatedIndices,
          confidenceIntervals,
          trendClassification,
          ciExceedsThreshold,
          maxCIRange,
        } = speciesData;

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
            ciExceedsThreshold,
            maxCIRange,
          });
        }
      };

      // Process all species from flight curves data
      if (flightData?.species) {
        Object.entries(flightData.species as Record<string, any>).forEach(
          ([speciesName, speciesData]) => {
            processSpecies(speciesName, speciesData);
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

  // Count species with excessively large CI ranges
  const speciesWithLargeCIList = speciesTrends.filter(trend => {
    return trend.ciExceedsThreshold === true;
  });
  const speciesWithLargeCI = speciesWithLargeCIList.length;

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
                  <span style={{ color: TREND_COLORS["Strong increase"] }}>
                    ↑↑ {categorySummary["Strong increase"]}{" "}
                    {getTrendLabel("Strong increase").toLowerCase()}
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Moderate increase"] && (
                <>
                  <span style={{ color: TREND_COLORS["Moderate increase"] }}>
                    ↑ {categorySummary["Moderate increase"]}{" "}
                    {getTrendLabel("Moderate increase").toLowerCase()}
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Stable"] && (
                <>
                  <span style={{ color: TREND_COLORS["Stable"] }}>
                    − {categorySummary["Stable"]} estáveis
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Moderate decline"] && (
                <>
                  <span style={{ color: TREND_COLORS["Moderate decline"] }}>
                    ↓ {categorySummary["Moderate decline"]}{" "}
                    {getTrendLabel("Moderate decline").toLowerCase()}
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Strong decline"] && (
                <>
                  <span style={{ color: TREND_COLORS["Strong decline"] }}>
                    ↓↓ {categorySummary["Strong decline"]}{" "}
                    {getTrendLabel("Strong decline").toLowerCase()}
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Uncertain"] && (
                <>
                  <span style={{ color: TREND_COLORS["Uncertain"] }}>
                    ? {categorySummary["Uncertain"]} incertos
                  </span>
                  {" • "}
                </>
              )}
              {categorySummary["Unknown"] && (
                <>
                  <span style={{ color: "#d9d9d9" }}>
                    {categorySummary["Unknown"]} sem classificação
                  </span>
                  {" • "}
                </>
              )}
              {speciesWithLargeCI > 0 && (
                <Popover
                  content={
                    <div style={{ maxWidth: 400, maxHeight: 300, overflowY: "auto" }}>
                      <Typography.Text
                        style={{
                          fontSize: 11,
                          color: "#8c8c8c",
                          display: "block",
                          marginBottom: 8,
                        }}
                      >
                        Espécies com intervalos de confiança muito amplos (&gt; {CI_RANGE_THRESHOLD}
                        ) têm estimativas de baixa precisão, geralmente devido a taxa de deteção
                        baixa ou dados esparsos. Os intervalos de confiança podem não ser confiáveis
                        para estas espécies.
                      </Typography.Text>
                      <List
                        size="small"
                        dataSource={speciesWithLargeCIList.map(t => t.species).sort()}
                        renderItem={species => (
                          <List.Item style={{ padding: "4px 0" }}>
                            <Link
                              to={`/species/${encodeURIComponent(species)}`}
                              style={{ fontSize: 12 }}
                              onClick={e => e.stopPropagation()}
                            >
                              {species}
                            </Link>
                          </List.Item>
                        )}
                      />
                    </div>
                  }
                  title="Espécies com IC muito amplo"
                  trigger="hover"
                >
                  <span style={{ color: "#faad14", cursor: "help" }}>
                    ⚠ {speciesWithLargeCI} com IC muito amplo
                  </span>
                </Popover>
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
