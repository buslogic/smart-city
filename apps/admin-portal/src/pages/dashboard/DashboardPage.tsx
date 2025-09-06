import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Button, 
  Space, 
  Typography, 
  Spin, 
  message,
  Drawer,
  Switch,
  List,
  Empty,
  Badge,
  Tooltip
} from 'antd';
import {
  SettingOutlined,
  AppstoreOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import { api } from '../../services/api';
import VehicleStatisticsWidget from './widgets/VehicleStatisticsWidget';
import { usePermissions } from '../../hooks/usePermissions';

const { Title, Text } = Typography;

interface WidgetConfig {
  id: string;
  widgetId: string;
  enabled: boolean;
  order: number;
  config: any;
}

interface DashboardConfig {
  layout: string;
  columns: number;
  gap: number;
  theme: string;
}

interface UserDashboardConfig {
  id: number;
  userId: number;
  config: DashboardConfig;
  widgets: WidgetConfig[];
}

interface AvailableWidget {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredPermission: string;
  defaultSize: { width: number; height: number };
}

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState<UserDashboardConfig | null>(null);
  const [availableWidgets, setAvailableWidgets] = useState<AvailableWidget[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { hasPermission } = usePermissions();

  useEffect(() => {
    fetchDashboardConfig();
    fetchAvailableWidgets();
  }, []);

  const fetchDashboardConfig = async () => {
    try {
      const response = await api.get('/api/dashboard/config');
      setDashboardConfig(response.data);
    } catch (error) {
      console.error('Error fetching dashboard config:', error);
      message.error('Greška pri učitavanju dashboard konfiguracije');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableWidgets = async () => {
    try {
      const response = await api.get('/api/dashboard/widgets/available');
      setAvailableWidgets(response.data);
    } catch (error) {
      console.error('Error fetching available widgets:', error);
    }
  };

  const toggleWidget = async (widgetId: string, enabled: boolean) => {
    try {
      setSaving(true);
      await api.post('/api/dashboard/widgets/toggle', {
        widgetId,
        enabled
      });
      await fetchDashboardConfig();
      message.success(`Widget ${enabled ? 'uključen' : 'isključen'}`);
    } catch (error) {
      console.error('Error toggling widget:', error);
      message.error('Greška pri promeni statusa widget-a');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardConfig();
    setRefreshing(false);
    message.info('Dashboard osvežen');
  };

  const renderWidget = (widget: WidgetConfig) => {
    if (!widget.enabled) return null;

    switch (widget.widgetId) {
      case 'vehicle-statistics':
        return <VehicleStatisticsWidget key={widget.id} config={widget.config} />;
      default:
        return (
          <Card key={widget.id}>
            <Empty description={`Widget ${widget.widgetId} nije implementiran`} />
          </Card>
        );
    }
  };

  const getEnabledWidgets = () => {
    return dashboardConfig?.widgets.filter(w => w.enabled) || [];
  };

  const isWidgetEnabled = (widgetId: string) => {
    return dashboardConfig?.widgets.some(w => w.widgetId === widgetId && w.enabled) || false;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '10px' }}>Učitavanje dashboard-a...</div>
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Title level={2} style={{ margin: 0 }}>
            <AppstoreOutlined /> Dashboard
          </Title>
        </Col>
        <Col>
          <Space>
            <Tooltip title="Osveži dashboard">
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleRefresh}
                loading={refreshing}
              >
                Osveži
              </Button>
            </Tooltip>
            <Badge count={availableWidgets.length - getEnabledWidgets().length} offset={[-5, 5]}>
              <Button 
                type="primary" 
                icon={<SettingOutlined />}
                onClick={() => setSettingsVisible(true)}
              >
                Podešavanja
              </Button>
            </Badge>
          </Space>
        </Col>
      </Row>

      {getEnabledWidgets().length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                Nemate aktivnih widget-a na dashboard-u.
                <br />
                Kliknite na <strong>Podešavanja</strong> da biste dodali widget-e.
              </span>
            }
          >
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setSettingsVisible(true)}
            >
              Dodaj Widget-e
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {dashboardConfig?.widgets
            .filter(w => w.enabled)
            .sort((a, b) => a.order - b.order)
            .map(widget => (
              <Col 
                key={widget.id}
                xs={24} 
                sm={24} 
                md={12} 
                lg={8} 
                xl={8}
              >
                {renderWidget(widget)}
              </Col>
            ))}
        </Row>
      )}

      <Drawer
        title="Dashboard Podešavanja"
        placement="right"
        width={400}
        onClose={() => setSettingsVisible(false)}
        open={settingsVisible}
      >
        <List
          header={<Text strong>Dostupni Widget-i</Text>}
          dataSource={availableWidgets}
          renderItem={widget => {
            const enabled = isWidgetEnabled(widget.id);
            return (
              <List.Item
                actions={[
                  <Switch
                    checked={enabled}
                    onChange={(checked) => toggleWidget(widget.id, checked)}
                    loading={saving}
                    checkedChildren={<EyeOutlined />}
                    unCheckedChildren={<EyeInvisibleOutlined />}
                  />
                ]}
              >
                <List.Item.Meta
                  title={widget.name}
                  description={
                    <>
                      <Text type="secondary">{widget.description}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Kategorija: {widget.category}
                      </Text>
                    </>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Drawer>
    </div>
  );
};

export default DashboardPage;