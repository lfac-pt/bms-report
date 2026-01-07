import { Tag, Tooltip } from 'antd';
import type { RarityData } from '../utils/speciesCardUtils';

interface RarityBadgeProps {
  rarityData: RarityData;
}

const RarityBadge: React.FC<RarityBadgeProps> = ({ rarityData }) => {
  const tooltipTitle = `Observado em ${rarityData.observedSeasons} de ${rarityData.totalSeasons} ${
    rarityData.totalSeasons === 1 ? 'época de monitorização' : 'épocas de monitorização'
  } (${rarityData.percentage.toFixed(1)}%)`;

  return (
    <Tooltip title={tooltipTitle}>
      <Tag color={rarityData.level.color} style={{ margin: 0, cursor: 'help' }}>
        {rarityData.level.label}
      </Tag>
    </Tooltip>
  );
};

export default RarityBadge;
