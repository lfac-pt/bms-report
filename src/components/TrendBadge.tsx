import { Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';

interface TrendBadgeProps {
  category: string;
}

const getTrendConfig = (category: string) => {
  const configs: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    'Strong increase': {
      color: '#52c41a',
      icon: <ArrowUpOutlined />,
      label: 'Aumento Forte',
    },
    'Moderate increase': {
      color: '#95de64',
      icon: <ArrowUpOutlined />,
      label: 'Aumento Moderado',
    },
    'Uncertain': {
      color: '#d9d9d9',
      icon: <MinusOutlined />,
      label: 'Incerto',
    },
    'Moderate decline': {
      color: '#faad14',
      icon: <ArrowDownOutlined />,
      label: 'Declínio Moderado',
    },
    'Strong decline': {
      color: '#ff4d4f',
      icon: <ArrowDownOutlined />,
      label: 'Declínio Forte',
    },
  };

  return configs[category] || configs['Uncertain'];
};

const TrendBadge: React.FC<TrendBadgeProps> = ({ category }) => {
  const config = getTrendConfig(category);

  return (
    <Tag color={config.color} style={{ margin: 0, fontSize: 11 }} icon={config.icon}>
      {config.label}
    </Tag>
  );
};

export default TrendBadge;
