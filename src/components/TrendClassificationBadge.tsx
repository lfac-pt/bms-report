import React from "react";
import { Tag, Tooltip } from "antd";
import {
  RiseOutlined,
  FallOutlined,
  MinusOutlined,
  QuestionOutlined,
} from "@ant-design/icons";
import type { TrendClassification } from "../types/gbiData";

interface TrendClassificationBadgeProps {
  classification: TrendClassification;
  showDetails?: boolean;
}

const TrendClassificationBadge: React.FC<TrendClassificationBadgeProps> = ({
  classification,
  showDetails = false,
}) => {
  const { category, annualRateOfChange, confidenceInterval } = classification;

  // Portuguese labels mapping
  const labelMap: Record<string, string> = {
    "Strong increase": "Aumento forte",
    "Moderate increase": "Aumento moderado",
    Stable: "Estável",
    Uncertain: "Incerto",
    "Moderate decline": "Declínio moderado",
    "Strong decline": "Declínio forte",
  };

  // Color and icon mapping
  const config: Record<
    string,
    { color: string; icon: React.ReactElement }
  > = {
    "Strong increase": { color: "#52c41a", icon: <RiseOutlined /> },
    "Moderate increase": { color: "#95de64", icon: <RiseOutlined /> },
    Stable: { color: "#1890ff", icon: <MinusOutlined /> },
    Uncertain: { color: "#8c8c8c", icon: <QuestionOutlined /> },
    "Moderate decline": { color: "#fa8c16", icon: <FallOutlined /> },
    "Strong decline": { color: "#f5222d", icon: <FallOutlined /> },
  };

  const { color, icon } = config[category] || config["Uncertain"];
  const label = labelMap[category] || category;

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
      {confidenceInterval.lower !== null &&
        confidenceInterval.upper !== null && (
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
      <Tag color={color} icon={icon} style={{ cursor: "help" }}>
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
