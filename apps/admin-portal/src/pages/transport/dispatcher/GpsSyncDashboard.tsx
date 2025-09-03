import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Progress, Typography, Space, Tag, Alert, Button, Table, Divider } from 'antd';
import { 
  DatabaseOutlined, 
  ClockCircleOutlined, 
  SyncOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { TokenManager } from '../../../utils/token';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/sr';

dayjs.extend(relativeTime);
dayjs.locale('sr');

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

interface BufferStatus {
  totalRecords: number;
  pendingRecords: number;
  processedRecords: number;
  errorRecords: number;
  oldestRecord: string | null;
  newestRecord: string | null;
  lastProcessedAt: string | null;
  recordsByStatus: {
    pending: number;
    processing: number;
    processed: number;
    error: number;
  };
  vehicleCount: number;
  averageProcessingTime: number;
  timestamp: string;
}

interface ProcessingStats {
  last24Hours: {
    total: number;
    processed: number;
    errors: number;
    successRate: string;
  };
  lastHour: {
    total: number;
    processed: number;
    recordsPerMinute: string;
  };
  topErrors: Array<{
    message: string;
    count: number;
  }>;
  timestamp: string;
}

interface TimescaleStatus {
  pendingTransfer: number;
  timescaleConnected: boolean;
  lastTransferTime: string;
  transferRate: string;
  timestamp: string;
}

const GpsSyncDashboard: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch buffer status
  const { data: bufferStatus, refetch: refetchBuffer, isLoading: isLoadingBuffer } = useQuery<BufferStatus>({
    queryKey: ['gps-buffer-status'],
    queryFn: async () => {
      const token = TokenManager.getAccessToken();
      const response = await axios.get(`${API_BASE}/api/gps-sync-dashboard/buffer-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLastUpdate(new Date());
      return response.data;
    },
    refetchInterval: autoRefresh ? 30000 : false, // 30 sekundi
    refetchIntervalInBackground: false,
  });

  // Fetch processing stats
  const { data: processingStats, refetch: refetchStats } = useQuery<ProcessingStats>({
    queryKey: ['gps-processing-stats'],
    queryFn: async () => {
      const token = TokenManager.getAccessToken();
      const response = await axios.get(`${API_BASE}/api/gps-sync-dashboard/processing-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    refetchInterval: autoRefresh ? 30000 : false,
    refetchIntervalInBackground: false,
  });

  // Fetch TimescaleDB status
  const { data: timescaleStatus, refetch: refetchTimescale } = useQuery<TimescaleStatus>({
    queryKey: ['timescale-status'],
    queryFn: async () => {
      const token = TokenManager.getAccessToken();
      const response = await axios.get(`${API_BASE}/api/gps-sync-dashboard/timescale-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    refetchInterval: autoRefresh ? 30000 : false,
    refetchIntervalInBackground: false,
  });

  const handleManualRefresh = useCallback(() => {
    refetchBuffer();
    refetchStats();
    refetchTimescale();
  }, [refetchBuffer, refetchStats, refetchTimescale]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'processing': return 'blue';
      case 'processed': return 'green';
      case 'error': return 'red';
      default: return 'default';
    }
  };

  const getProgressStatus = () => {
    if (!bufferStatus) return 'normal';
    const errorRate = (bufferStatus.errorRecords / bufferStatus.totalRecords) * 100;
    if (errorRate > 10) return 'exception';
    if (bufferStatus.pendingRecords > 10000) return 'active';
    return 'normal';
  };

  const errorColumns = [
    {
      title: 'Greška',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: 'Broj',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      render: (count: number) => <Tag color="red">{count}</Tag>,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <DashboardOutlined style={{ fontSize: 24 }} />
            <Title level={3} style={{ margin: 0 }}>
              GPS Sinhronizacija Dashboard
            </Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Text type="secondary">
              Poslednje ažuriranje: {dayjs(lastUpdate).format('HH:mm:ss')}
            </Text>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleManualRefresh}
              loading={isLoadingBuffer}
            >
              Osveži
            </Button>
            <Button
              type={autoRefresh ? 'primary' : 'default'}
              icon={<SyncOutlined spin={autoRefresh} />}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Auto-osvežavanje ON' : 'Auto-osvežavanje OFF'}
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Buffer Status Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Ukupno u buffer-u"
              value={bufferStatus?.totalRecords || 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Za procesiranje"
              value={bufferStatus?.pendingRecords || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Procesirano"
              value={bufferStatus?.processedRecords || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Greške"
              value={bufferStatus?.errorRecords || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: bufferStatus?.errorRecords ? '#ff4d4f' : '#999' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Processing Progress */}
      <Card title="Status Procesiranja" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            {bufferStatus && bufferStatus.totalRecords > 0 && (
              <Progress
                percent={Math.round((bufferStatus.processedRecords / bufferStatus.totalRecords) * 100)}
                status={getProgressStatus()}
                format={(percent) => `${percent}%`}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            )}
          </Col>
          <Col span={8}>
            <Statistic
              title="Jedinstvenih vozila"
              value={bufferStatus?.vehicleCount || 0}
              prefix={<CarOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Prosečno vreme procesiranja"
              value={bufferStatus?.averageProcessingTime || 0}
              suffix="ms"
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Poslednje procesiranje"
              value={bufferStatus?.lastProcessedAt ? dayjs(bufferStatus.lastProcessedAt).fromNow() : 'N/A'}
            />
          </Col>
        </Row>

        {bufferStatus?.oldestRecord && bufferStatus.pendingRecords > 0 && (
          <Alert
            message={`Najstariji neprocesirani slog: ${dayjs(bufferStatus.oldestRecord).fromNow()}`}
            type={dayjs().diff(dayjs(bufferStatus.oldestRecord), 'minute') > 10 ? 'warning' : 'info'}
            icon={<WarningOutlined />}
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* Two column layout for stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          {/* 24h Statistics */}
          <Card title="Statistike (24h)" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Ukupno primljeno"
                  value={processingStats?.last24Hours.total || 0}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Uspešno procesirano"
                  value={processingStats?.last24Hours.processed || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Greške"
                  value={processingStats?.last24Hours.errors || 0}
                  valueStyle={{ color: processingStats?.last24Hours.errors ? '#ff4d4f' : '#999' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Uspešnost"
                  value={processingStats?.last24Hours.successRate || '0'}
                  suffix="%"
                  valueStyle={{ 
                    color: Number(processingStats?.last24Hours.successRate) > 90 ? '#52c41a' : '#faad14' 
                  }}
                />
              </Col>
            </Row>
            <Divider />
            <Row>
              <Col span={24}>
                <Text strong>Zadnji sat:</Text>
                <Space style={{ marginLeft: 16 }}>
                  <Tag color="blue">
                    {processingStats?.lastHour.total || 0} primljeno
                  </Tag>
                  <Tag color="green">
                    {processingStats?.lastHour.processed || 0} procesirano
                  </Tag>
                  <Tag>
                    {processingStats?.lastHour.recordsPerMinute || 0} rec/min
                  </Tag>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          {/* TimescaleDB Status */}
          <Card title="TimescaleDB Status" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Za transfer"
                  value={timescaleStatus?.pendingTransfer || 0}
                  prefix={<SyncOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Space direction="vertical">
                  <Text type="secondary">Status konekcije</Text>
                  <Tag color={timescaleStatus?.timescaleConnected ? 'green' : 'red'}>
                    {timescaleStatus?.timescaleConnected ? 'Povezan' : 'Nije povezan'}
                  </Tag>
                </Space>
              </Col>
              <Col span={24}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">Interval transfera</Text>
                  <Tag color="blue">{timescaleStatus?.transferRate || 'N/A'}</Tag>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Top Errors */}
          {processingStats?.topErrors && processingStats.topErrors.length > 0 && (
            <Card title="Najčešće greške (24h)">
              <Table
                dataSource={processingStats.topErrors}
                columns={errorColumns}
                pagination={false}
                size="small"
                rowKey={(record) => record.message}
              />
            </Card>
          )}
        </Col>
      </Row>

      {/* Status by Type */}
      {bufferStatus && (
        <Card title="Distribucija po statusu">
          <Row gutter={[16, 16]}>
            {Object.entries(bufferStatus.recordsByStatus).map(([status, count]) => (
              <Col key={status} xs={12} sm={6}>
                <Space direction="vertical" align="center" style={{ width: '100%' }}>
                  <Tag color={getStatusColor(status)} style={{ fontSize: 14, padding: '4px 8px' }}>
                    {status.toUpperCase()}
                  </Tag>
                  <Statistic value={count} />
                </Space>
              </Col>
            ))}
          </Row>
        </Card>
      )}
    </div>
  );
};

export default GpsSyncDashboard;