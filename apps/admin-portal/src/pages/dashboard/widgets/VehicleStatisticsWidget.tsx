import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Progress, Spin, Typography, Space, Tooltip } from 'antd';
import { 
  CarOutlined, 
  CheckCircleOutlined, 
  StopOutlined,
  WifiOutlined,
  DisconnectOutlined,
  RiseOutlined,
  FallOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { api } from '../../../services/api';

const { Text } = Typography;

interface VehicleStatistics {
  total: number;
  active: number;
  inactive: number;
  recentlyUpdated: number;
  withGPS: number;
  withoutGPS: number;
  activePercentage: number;
  inactivePercentage: number;
}

interface Props {
  config?: any;
}

const VehicleStatisticsWidget: React.FC<Props> = ({ config }) => {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<VehicleStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatistics();
    const interval = setInterval(fetchStatistics, 60000); // Refresh svakih 60 sekundi
    return () => clearInterval(interval);
  }, []);

  const fetchStatistics = async () => {
    try {
      setError(null);
      const response = await api.get('/api/dashboard/widgets/vehicle-statistics');
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching vehicle statistics:', error);
      setError('Greška pri učitavanju statistika');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card title={<><CarOutlined /> Statistike Vozila</>}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title={<><CarOutlined /> Statistike Vozila</>}>
        <Text type="danger">{error}</Text>
      </Card>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <Card 
      title={
        <Space>
          <CarOutlined />
          <span>Statistike Vozila</span>
        </Space>
      }
      extra={
        <Tooltip title="Ažurirano pre manje od 1 minuta">
          <DashboardOutlined style={{ color: '#52c41a' }} />
        </Tooltip>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Statistic
            title="Ukupno vozila"
            value={statistics.total}
            prefix={<CarOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="Sa GPS-om"
            value={statistics.withGPS}
            prefix={<WifiOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col span={12}>
          <Statistic
            title="Aktivna"
            value={statistics.active}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a', fontSize: 20 }}
          />
          <Progress 
            percent={statistics.activePercentage} 
            size="small" 
            strokeColor="#52c41a"
            format={percent => `${percent}%`}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="Neaktivna"
            value={statistics.inactive}
            prefix={<StopOutlined />}
            valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
          />
          <Progress 
            percent={statistics.inactivePercentage} 
            size="small" 
            strokeColor="#ff4d4f"
            format={percent => `${percent}%`}
          />
        </Col>
      </Row>

      <Row style={{ marginTop: 20 }}>
        <Col span={24}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ 
              padding: '8px 12px', 
              background: '#f0f2f5', 
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Text type="secondary">Bez GPS-a:</Text>
              <Text strong>{statistics.withoutGPS} vozila</Text>
            </div>
            {statistics.recentlyUpdated > 0 && (
              <div style={{ 
                padding: '8px 12px', 
                background: '#e6f7ff', 
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Text type="secondary">
                  <RiseOutlined style={{ color: '#1890ff' }} /> Ažurirano danas:
                </Text>
                <Text strong style={{ color: '#1890ff' }}>
                  {statistics.recentlyUpdated} vozila
                </Text>
              </div>
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

export default VehicleStatisticsWidget;