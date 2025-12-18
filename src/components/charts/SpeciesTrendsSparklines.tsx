import React, { useEffect, useState } from "react";
import { Collapse, Typography, Row, Col, Spin } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

interface SpeciesIndices {
  [species: string]: {
    collatedIndices: {
      [year: string]: number;
    };
    confidenceIntervals?: {
      [year: string]: {
        ci_lower: number;
        ci_upper: number;
      };
    };
  };
}

interface FlightCurvesData {
  species: SpeciesIndices;
  years: number[];
}

interface SpeciesTrend {
  species: string;
  indices: number[];
  years: number[];
  trend: number; // Percentage change from first to last year
  direction: "up" | "down" | "stable";
  ciLower?: number[];
  ciUpper?: number[];
}

const SpeciesTrendsSparklines: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [speciesTrends, setSpeciesTrends] = useState<SpeciesTrend[]>([]);

  useEffect(() => {
    fetchFlightCurvesData();
  }, []);

  const fetchFlightCurvesData = async () => {
    try {
      // eslint-disable-next-line no-undef
      const response = await fetch("/data/flight-curves-data.json");
      const data: FlightCurvesData = await response.json();

      // Process species data
      const trends: SpeciesTrend[] = [];

      Object.entries(data.species).forEach(([speciesName, speciesData]) => {
        const { collatedIndices, confidenceIntervals } = speciesData;
        const years = Object.keys(collatedIndices)
          .map(Number)
          .sort((a, b) => a - b);
        const indices = years.map(year => collatedIndices[year.toString()]);

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
            ciLower = years.map(year => confidenceIntervals[year.toString()]?.ci_lower ?? 0);
            ciUpper = years.map(year => confidenceIntervals[year.toString()]?.ci_upper ?? 0);
          }

          trends.push({
            species: speciesName,
            indices,
            years,
            trend,
            direction,
            ciLower,
            ciUpper,
          });
        }
      });

      // Sort by trend (highest first)
      trends.sort((a, b) => b.trend - a.trend);

      setSpeciesTrends(trends);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error loading flight curves data:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderSparkline = (
    indices: number[],
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

    // Determine color based on trend
    let strokeColor = "#d9d9d9";
    if (indices[indices.length - 1] > indices[0]) {
      strokeColor = "#52c41a"; // Green for positive
    } else if (indices[indices.length - 1] < indices[0]) {
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

  // Calculate trend summary
  const trendSummary = speciesTrends.reduce(
    (acc, trend) => {
      acc[trend.direction]++;
      return acc;
    },
    { up: 0, stable: 0, down: 0 }
  );

  const items = [
    {
      key: "1",
      label: (
        <div>
          <Title level={4} style={{ marginBottom: 0, display: "inline" }}>
            Tendências por Espécie ({speciesTrends.length} espécies)
          </Title>
          <Text type="secondary" style={{ marginLeft: 16 }}>
            <span style={{ color: "#52c41a" }}>↑ {trendSummary.up} a aumentar</span>
            {" • "}
            <span style={{ color: "#8c8c8c" }}>− {trendSummary.stable} estáveis</span>
            {" • "}
            <span style={{ color: "#ff4d4f" }}>↓ {trendSummary.down} a diminuir</span>
          </Text>
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
                    {renderSparkline(trend.indices, trend.ciLower, trend.ciUpper)}
                  </div>

                  {/* Trend value and icon */}
                  <div
                    style={{
                      marginLeft: 16,
                      minWidth: 90,
                      textAlign: "right",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 8,
                    }}
                  >
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
