import { Space, Tag, Typography, Avatar, Card } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import RarityBadge from './RarityBadge';
import TrendBadge from './TrendBadge';
import SpeciesSparkline from './SpeciesSparkline';
import {
  calculateRarity,
  getLastYearFlightCurve,
} from '../utils/speciesCardUtils';
import endangeredPT from '../utils/endangered_pt';
import endangeredEU from '../utils/endangered_eu';
import type { TransectStats } from '../types/transectStats';

const { Text } = Typography;

interface SpeciesCardProps {
  speciesName: string;
  commonName?: string;
  climaticRegion: string;
  municipalityTransects: TransectStats[];
  flightCurvesData: any;
}

const SpeciesCard: React.FC<SpeciesCardProps> = ({
  speciesName,
  commonName,
  climaticRegion,
  municipalityTransects,
  flightCurvesData,
}) => {
  // Calculate rarity
  const rarity = calculateRarity(speciesName, municipalityTransects);

  // Get conservation status
  const ptStatus = endangeredPT[speciesName];
  const euStatus = endangeredEU[speciesName];

  // Get last year's flight curve for sparkline
  const flightCurve = getLastYearFlightCurve(speciesName, climaticRegion, flightCurvesData);

  // Get trend classification
  const trendCategory = flightCurvesData?.species?.[speciesName]?.trendClassification?.category;

  return (
    <Card
      size="small"
      styles={{ body: { padding: 12 } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Photo placeholder - 50px thumbnail */}
        <Avatar
          size={50}
          icon={<BugOutlined />}
          style={{ backgroundColor: '#f0f0f0', color: '#8c8c8c', flexShrink: 0 }}
          aria-label={`Fotografia de ${speciesName}`}
        />

        {/* Names and info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 4 }}>
            <Link
              to={`/species/${encodeURIComponent(speciesName)}`}
              style={{ color: 'inherit' }}
            >
              <Text italic strong style={{ fontSize: 14 }}>
                {speciesName}
              </Text>
            </Link>
            {commonName && (
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                {commonName}
              </Text>
            )}
          </div>

          {/* Badges */}
          <Space size={4} wrap>
            <RarityBadge rarity={rarity} />
            {trendCategory && <TrendBadge category={trendCategory} />}
            {ptStatus && (
              <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
                PT: {ptStatus}
              </Tag>
            )}
            {euStatus && (
              <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                EU: {euStatus}
              </Tag>
            )}
          </Space>
        </div>

        {/* Sparkline */}
        {flightCurve && (
          <div style={{ flexShrink: 0 }}>
            <SpeciesSparkline weeks={flightCurve.weeks} abundance={flightCurve.abundance} />
          </div>
        )}
      </div>
    </Card>
  );
};

export default SpeciesCard;
