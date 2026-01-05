import React from "react";
import { Tag, Tooltip } from "antd";
import { RiseOutlined, FallOutlined, MinusOutlined, QuestionOutlined } from "@ant-design/icons";
import type { TrendClassification } from "../types/gbiData";
import { getTrendColor, getTrendLabel } from "../constants";

interface TrendClassificationBadgeProps {
  classification: TrendClassification;
  showDetails?: boolean;
  style?: React.CSSProperties;
}

const TrendClassificationBadge: React.FC<TrendClassificationBadgeProps> = ({
  classification,
  showDetails = false,
  style,
}) => {
  const { category, annualRateOfChange, confidenceInterval } = classification;

  // Icon mapping
  const iconMap: Record<string, React.ReactElement> = {
    "Strong increase": <RiseOutlined />,
    "Moderate increase": <RiseOutlined />,
    Stable: <MinusOutlined />,
    Uncertain: <QuestionOutlined />,
    "Moderate decline": <FallOutlined />,
    "Strong decline": <FallOutlined />,
  };

  const color = getTrendColor(category);
  const icon = iconMap[category] || iconMap["Uncertain"];
  const label = getTrendLabel(category);

  // Format rate of change
  const rateText =
    annualRateOfChange !== null
      ? `${annualRateOfChange > 0 ? "+" : ""}${annualRateOfChange.toFixed(1)}% ao ano`
      : "Taxa não disponível";

  // Tooltip content
  const tooltipContent = (
    <div>
      <div>
        <strong>Categoria:</strong> {category}
      </div>
      <div>
        <strong>Taxa anual:</strong> {rateText}
      </div>
      {confidenceInterval.lower !== null && confidenceInterval.upper !== null && (
        <div>
          <strong>IC 95%:</strong> [{confidenceInterval.lower.toFixed(1)}%,{" "}
          {confidenceInterval.upper.toFixed(1)}%]
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: "12px", color: "#888" }}>
        Baseado em regressão log-linear com bootstrap (metodologia EGBI)
      </div>
    </div>
  );

  return (
    <Tooltip title={tooltipContent}>
      <Tag color={color} icon={icon} style={{ cursor: "help", ...style }}>
        {label}
        {showDetails && annualRateOfChange !== null && (
          <span style={{ marginLeft: 8 }}>
            ({annualRateOfChange > 0 ? "+" : ""}
            {annualRateOfChange.toFixed(1)}%)
          </span>
        )}
      </Tag>
    </Tooltip>
  );
};

export default TrendClassificationBadge;
