import { Tag } from 'antd';
import type { RarityLevel } from '../utils/speciesCardUtils';

interface RarityBadgeProps {
  rarity: RarityLevel;
}

const RarityBadge: React.FC<RarityBadgeProps> = ({ rarity }) => {
  return (
    <Tag color={rarity.color} style={{ margin: 0 }}>
      {rarity.label}
    </Tag>
  );
};

export default RarityBadge;
