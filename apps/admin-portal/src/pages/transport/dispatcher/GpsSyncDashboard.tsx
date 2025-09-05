import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Progress, Typography, Space, Tag, Alert, Button, Table, Divider, Spin, Collapse, Badge, Popconfirm, message, Tooltip, Modal, Form, InputNumber, Descriptions, Switch } from 'antd';
import { 
  DatabaseOutlined, 
  ClockCircleOutlined, 
  SyncOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  DashboardOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  RedoOutlined,
  StopOutlined,
  ClearOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';
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
  totalProcessedLastHour: number;
  averageTimescaleInsertTime: number;
  processingPercent: number;
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

interface CronProcess {
  name: string;
  location: string;
  schedule: string;
  lastRun: string | null;
  isActive: boolean;
  description: string;
  type?: string;
  instance?: number;
  cronActive?: boolean; // Da li cron proces radi
  cronLastRun?: string | null; // Poslednje izvršavanje cron-a
  activeDevices?: number; // Broj aktivnih GPS uređaja
  isPaused?: boolean; // Da li je backend cron pauziran
  rawLogSize?: string | null; // Veličina smart-city-gps-raw-log.txt fajla
}

interface CronStatus {
  cronProcesses: CronProcess[];
  legacyProcessors?: CronProcess[];
  summary: {
    totalCrons: number;
    activeCrons: number;
    dataFlowStatus: string;
    activeLegacyInstances?: number[];
  };
  timestamp: string;
}

const GpsSyncDashboard: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [controllingCron, setControllingCron] = useState<string | null>(null);
  const [resettingStats, setResettingStats] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<any>(null);
  const [form] = Form.useForm();

  // Fetch buffer status
  const { data: bufferStatus, refetch: refetchBuffer, isLoading: isLoadingBuffer } = useQuery<BufferStatus>({
    queryKey: ['gps-buffer-status'],
    queryFn: async () => {
      const response = await api.get('/api/gps-sync-dashboard/buffer-status');
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
      const response = await api.get('/api/gps-sync-dashboard/processing-stats');
      return response.data;
    },
    refetchInterval: autoRefresh ? 30000 : false,
    refetchIntervalInBackground: false,
  });

  // Fetch TimescaleDB status
  const { data: timescaleStatus, refetch: refetchTimescale } = useQuery<TimescaleStatus>({
    queryKey: ['timescale-status'],
    queryFn: async () => {
      const response = await api.get('/api/gps-sync-dashboard/timescale-status');
      return response.data;
    },
    refetchInterval: autoRefresh ? 30000 : false,
    refetchIntervalInBackground: false,
  });

  // Fetch Cron status
  const { data: cronStatus, refetch: refetchCron } = useQuery<CronStatus>({
    queryKey: ['cron-status'],
    queryFn: async () => {
      const response = await api.get('/api/gps-sync-dashboard/cron-status');
      return response.data;
    },
    refetchInterval: autoRefresh ? 30000 : false,
    refetchIntervalInBackground: false,
  });

  // Fetch Connection status
  const { data: connectionStatus, refetch: refetchConnection } = useQuery<any>({
    queryKey: ['connection-status'],
    queryFn: async () => {
      const response = await api.get('/api/gps-sync-dashboard/connection-status');
      return response.data;
    },
    refetchInterval: autoRefresh ? 30000 : false,
    refetchIntervalInBackground: false,
  });

  const handleManualRefresh = useCallback(() => {
    refetchBuffer();
    refetchStats();
    refetchTimescale();
    refetchCron();
    refetchConnection();
  }, [refetchBuffer, refetchStats, refetchTimescale, refetchCron, refetchConnection]);

  const handleCronControl = useCallback(async (action: 'start' | 'stop', cronName: string, instance?: number) => {
    setControllingCron(`${cronName}-${action}`);
    try {
      await api.post('/api/gps-sync-dashboard/cron-control', { 
        action, 
        cronName,
        instance 
      });
      message.success(`Cron ${cronName} ${action === 'start' ? 'pokrenut' : 'stopiran'} uspešno`);
      // Sačekaj malo da se status ažurira na backend-u
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetchCron();
    } catch (error) {
      message.error(`Greška pri ${action === 'start' ? 'pokretanju' : 'stopiranju'} cron-a`);
    } finally {
      setControllingCron(null);
    }
  }, [refetchCron]);

  const handleCronRestart = useCallback(async (cronName: string, instance?: number) => {
    setControllingCron(`${cronName}-restart`);
    try {
      await handleCronControl('stop', cronName, instance);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      await handleCronControl('start', cronName, instance);
      message.success(`Cron ${cronName} restartovan uspešno`);
    } catch (error) {
      message.error('Greška pri restartovanju cron-a');
    } finally {
      setControllingCron(null);
    }
  }, [handleCronControl]);

  const handleCronProcessControl = useCallback(async (action: 'start' | 'stop' | 'run', instance: number) => {
    setControllingCron(`teltonika${instance}-cron-${action}`);
    try {
      await api.post('/api/gps-sync-dashboard/cron-process-control', { 
        action, 
        instance 
      });
      
      let successMessage = '';
      if (action === 'run') {
        successMessage = `Smart City processor za teltonika${instance} je ručno pokrenut`;
      } else {
        successMessage = `Smart City processor za teltonika${instance} je ${action === 'start' ? 'startovan' : 'zaustavljen'}`;
      }
      
      message.success(successMessage);
      
      // Sačekaj malo da se status ažurira
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetchCron();
    } catch (error) {
      message.error(`Greška pri kontroli Smart City processor-a`);
    } finally {
      setControllingCron(null);
    }
  }, [refetchCron]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const response = await api.get('/api/gps-sync-dashboard/settings');
      if (response.data.success) {
        setCurrentSettings(response.data.data);
        // Postavi form vrednosti
        form.setFieldsValue({
          batchSize: response.data.data['gps.processor.batch_size']?.value,
          intervalSeconds: response.data.data['gps.processor.interval_seconds']?.value,
          useWorkerPool: response.data.data['gps.processor.use_worker_pool']?.value === 'true' || response.data.data['gps.processor.use_worker_pool']?.value === true,
          workerCount: response.data.data['gps.processor.worker_count']?.value || 4,
          cleanupProcessedMinutes: response.data.data['gps.cleanup.processed_minutes']?.value,
          cleanupFailedHours: response.data.data['gps.cleanup.failed_hours']?.value,
          cleanupStatsDays: response.data.data['gps.cleanup.stats_days']?.value,
        });
      }
    } catch (error) {
      message.error('Greška pri učitavanju podešavanja');
    } finally {
      setSettingsLoading(false);
    }
  }, [form]);

  const handleUpdateSetting = useCallback(async (key: string, value: string | number) => {
    try {
      const response = await api.post('/api/gps-sync-dashboard/settings', { key, value });
      if (response.data.success) {
        message.success('Podešavanje uspešno ažurirano');
        await loadSettings(); // Osveži podešavanja
      } else {
        message.error(response.data.message || 'Greška pri ažuriranju');
      }
    } catch (error) {
      message.error('Greška pri ažuriranju podešavanja');
    }
  }, [loadSettings]);

  const handleOpenSettings = useCallback(() => {
    setSettingsModalVisible(true);
    loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSettingsLoading(true);
      
      // Ažuriraj svako podešavanje
      await handleUpdateSetting('gps.processor.batch_size', values.batchSize);
      await handleUpdateSetting('gps.processor.interval_seconds', values.intervalSeconds);
      await handleUpdateSetting('gps.processor.use_worker_pool', values.useWorkerPool ? 'true' : 'false');
      await handleUpdateSetting('gps.processor.worker_count', values.workerCount);
      await handleUpdateSetting('gps.cleanup.processed_minutes', values.cleanupProcessedMinutes);
      await handleUpdateSetting('gps.cleanup.failed_hours', values.cleanupFailedHours);
      await handleUpdateSetting('gps.cleanup.stats_days', values.cleanupStatsDays);
      
      message.success('Sva podešavanja su uspešno ažurirana');
      setSettingsModalVisible(false);
    } catch (error) {
      message.error('Greška pri čuvanju podešavanja');
    } finally {
      setSettingsLoading(false);
    }
  }, [form, handleUpdateSetting]);

  const handleResetStatistics = useCallback(async () => {
    setResettingStats(true);
    try {
      const response = await api.post('/api/gps-sync-dashboard/reset-statistics');
      if (response.data.success) {
        message.success(`Statistike resetovane! Obrisano ${response.data.deletedRows || 0} redova.`);
        // Osveži sve podatke
        await Promise.all([
          refetchBuffer(),
          refetchStats(),
          refetchTimescale(),
          refetchCron()
        ]);
      } else {
        message.error(response.data.message || 'Greška pri resetovanju statistika');
      }
    } catch (error) {
      message.error('Greška pri resetovanju statistika');
    } finally {
      setResettingStats(false);
    }
  }, [refetchBuffer, refetchStats, refetchTimescale, refetchCron]);

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
            <Button
              icon={<SettingOutlined />}
              onClick={handleOpenSettings}
            >
              Podešavanja
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
            {bufferStatus && (
              <Progress
                percent={bufferStatus.processingPercent || 0}
                status={getProgressStatus()}
                format={(percent) => `${percent}%`}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            )}
          </Col>
          <Col span={6}>
            <Statistic
              title="Jedinstvenih vozila"
              value={bufferStatus?.vehicleCount || 0}
              prefix={<CarOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Buffer → Processed"
              value={bufferStatus?.averageProcessingTime || 0}
              suffix="ms"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="TimescaleDB insert"
              value={bufferStatus?.averageTimescaleInsertTime || 0}
              suffix="ms"
              valueStyle={{ color: (bufferStatus?.averageTimescaleInsertTime || 0) > 1000 ? '#faad14' : '#52c41a' }}
            />
          </Col>
          <Col span={6}>
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

      {/* MySQL Connection Pool Status */}
      {connectionStatus && (
        <Card 
          title={
            <div className="flex items-center justify-between">
              <span>MySQL Connection Pool</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal">
                  {connectionStatus.pool?.currentConnections || 0} / {connectionStatus.pool?.maxConnections || 20} konekcija
                </span>
                <Progress 
                  type="circle" 
                  percent={connectionStatus.pool?.utilizationPercent || 0} 
                  width={40}
                  strokeColor={
                    connectionStatus.pool?.utilizationPercent > 90 ? '#ff4d4f' : 
                    connectionStatus.pool?.utilizationPercent > 75 ? '#faad14' : 
                    '#52c41a'
                  }
                />
              </div>
            </div>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Aktivne konekcije"
                value={connectionStatus.connections?.active || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Sleep konekcije"
                value={connectionStatus.connections?.sleeping || 0}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Izvršavanje"
                value={connectionStatus.connections?.executing || 0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Dugotrajna (>60s)"
                value={connectionStatus.connections?.longRunning || 0}
                valueStyle={{ color: connectionStatus.connections?.longRunning > 0 ? '#ff4d4f' : '#000' }}
              />
            </Col>
          </Row>

          {connectionStatus.longestConnections?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Najduže konekcije:
              </Typography.Text>
              <div style={{ marginTop: 8 }}>
                {connectionStatus.longestConnections.map((conn: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1">
                    <span>{conn.command} - {conn.time}s</span>
                    {conn.query && (
                      <Tooltip title={conn.query}>
                        <span className="text-gray-400">{conn.query.substring(0, 50)}...</span>
                      </Tooltip>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {connectionStatus.pool?.utilizationPercent > 85 && (
            <Alert
              message={`Upozorenje: Iskorišćeno ${connectionStatus.pool.utilizationPercent}% connection pool-a`}
              type="warning"
              icon={<WarningOutlined />}
              style={{ marginTop: 16 }}
              showIcon
            />
          )}
        </Card>
      )}

      {/* Two column layout for stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          {/* 24h Statistics */}
          <Card 
            title="Statistike (24h)" 
            style={{ marginBottom: 16 }}
            extra={
              <Popconfirm
                title="Reset statistika"
                description="Da li ste sigurni da želite da resetujete sve statistike? Ovo će obrisati sve podatke o procesiranju."
                onConfirm={handleResetStatistics}
                okText="Da, resetuj"
                cancelText="Otkaži"
                okButtonProps={{ danger: true }}
              >
                <Button 
                  danger 
                  size="small" 
                  icon={<ClearOutlined />}
                  loading={resettingStats}
                >
                  Reset statistika
                </Button>
              </Popconfirm>
            }
          >
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
        <Card title="Distribucija po statusu" style={{ marginBottom: 24 }}>
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

      {/* Cron Process Status */}
      <Card 
        title={
          <Space>
            <SyncOutlined spin={cronStatus?.cronProcesses.some(c => c.isActive)} />
            <span>Status Cron Procesa</span>
          </Space>
        }
        extra={
          cronStatus && (
            <Tag color={
              cronStatus.cronProcesses.filter(c => c.isActive).length === cronStatus.cronProcesses.length ? 'green' :
              cronStatus.cronProcesses.filter(c => c.isActive).length > 0 ? 'orange' : 'red'
            }>
              {cronStatus.cronProcesses.filter(c => c.isActive).length}/{cronStatus.cronProcesses.length} Aktivno
            </Tag>
          )
        }
      >
        {cronStatus ? (
          <>
            {/* Backend Procesi */}
            <Table
              dataSource={cronStatus.cronProcesses}
              rowKey="name"
              pagination={false}
              columns={[
                {
                  title: 'Proces',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text: string, record: CronProcess) => (
                    <Space direction="vertical" size={0}>
                      <Text strong>{text}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{record.location}</Text>
                    </Space>
                  ),
                },
                {
                  title: 'Raspored',
                  dataIndex: 'schedule',
                  key: 'schedule',
                  width: 150,
                  render: (text: string) => <Tag>{text}</Tag>,
                },
                {
                  title: 'Poslednje izvršavanje',
                  dataIndex: 'lastRun',
                  key: 'lastRun',
                  width: 200,
                  render: (text: string | null) => text ? (
                    <Space direction="vertical" size={0}>
                      <Text>{dayjs(text).format('HH:mm:ss')}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(text).fromNow()}</Text>
                    </Space>
                  ) : (
                    <Text type="secondary">N/A</Text>
                  ),
                },
                {
                  title: 'Status',
                  dataIndex: 'isActive',
                  key: 'isActive',
                  width: 100,
                  render: (isActive: boolean, record: CronProcess) => {
                    if (record.isPaused) {
                      return <Tag color="orange">Pauziran</Tag>;
                    }
                    return (
                      <Tag color={isActive ? 'green' : 'red'}>
                        {isActive ? 'Aktivan' : 'Neaktivan'}
                      </Tag>
                    );
                  },
                },
                {
                  title: 'Opis',
                  dataIndex: 'description',
                  key: 'description',
                  ellipsis: true,
                  render: (text: string) => <Text type="secondary" style={{ fontSize: 12 }}>{text}</Text>,
                },
                {
                  title: 'Akcije',
                  key: 'actions',
                  width: 200,
                  render: (_: any, record: CronProcess) => (
                    <Space size="small">
                      <Button
                        size="small"
                        type={record.isPaused ? 'primary' : 'default'}
                        icon={record.isPaused ? <PlayCircleOutlined /> : <StopOutlined />}
                        loading={controllingCron === `${record.name}-${record.isPaused ? 'start' : 'stop'}`}
                        onClick={() => handleCronControl(record.isPaused ? 'start' : 'stop', record.name)}
                      >
                        {record.isPaused ? 'Start' : 'Stop'}
                      </Button>
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={controllingCron === `${record.name}-restart`}
                        onClick={() => handleCronRestart(record.name)}
                      >
                        Restart
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
            
            {/* Legacy GPS Procesori - Collapsible */}
            {cronStatus.legacyProcessors && cronStatus.legacyProcessors.length > 0 && (
              <Collapse 
                style={{ marginTop: 16 }}
                items={[
                  {
                    key: 'legacy',
                    label: (
                      <Space>
                        <span>Legacy GPS Procesori (Teltonika 60-76)</span>
                        <Badge 
                          count={cronStatus.legacyProcessors.filter(p => p.isActive).length} 
                          style={{ backgroundColor: '#52c41a' }}
                        />
                        <Text type="secondary">
                          / {cronStatus.legacyProcessors.length} instanci
                        </Text>
                      </Space>
                    ),
                    children: (
                      <Table
                        dataSource={cronStatus.legacyProcessors}
                        rowKey="name"
                        pagination={false}
                        size="small"
                        columns={[
                          {
                            title: 'Instance',
                            dataIndex: 'name',
                            key: 'name',
                            render: (text: string, record: CronProcess) => (
                              <Space>
                                <Text strong>{text}</Text>
                                {record.isActive && <Badge status="processing" />}
                              </Space>
                            ),
                          },
                          {
                            title: 'Port',
                            key: 'port',
                            width: 80,
                            render: (record: CronProcess) => (
                              <Tag>{`120${record.instance || 60}`}</Tag>
                            ),
                          },
                          {
                            title: 'GPS Uređaji Legacy',
                            key: 'devices',
                            width: 130,
                            render: (record: CronProcess) => (
                              <Badge 
                                count={record.activeDevices || 0} 
                                showZero
                                overflowCount={999999}
                                style={{ 
                                  backgroundColor: record.activeDevices && record.activeDevices > 0 ? '#52c41a' : '#d9d9d9' 
                                }}
                              />
                            ),
                          },
                          {
                            title: 'Raw-File-Size-Legacy',
                            key: 'rawLogSize',
                            width: 150,
                            render: (record: CronProcess) => {
                              if (!record.rawLogSize) {
                                return <Text type="secondary">-</Text>;
                              }
                              // Proveri da li je fajl prevelik (preko 10MB)
                              const sizeStr = record.rawLogSize;
                              const isLarge = sizeStr.includes('M') && parseFloat(sizeStr) > 10;
                              const isCritical = sizeStr.includes('M') && parseFloat(sizeStr) > 50;
                              
                              return (
                                <Tooltip title={isCritical ? 'Kritično! Fajl je prevelik.' : isLarge ? 'Upozorenje: Fajl postaje prevelik' : 'Normalna veličina'}>
                                  <Tag color={isCritical ? 'red' : isLarge ? 'orange' : 'green'}>
                                    {record.rawLogSize}
                                  </Tag>
                                </Tooltip>
                              );
                            },
                          },
                          {
                            title: 'Screen Status Legacy',
                            dataIndex: 'isActive',
                            key: 'isActive',
                            width: 150,
                            render: (isActive: boolean) => (
                              <Tag color={isActive ? 'green' : 'default'}>
                                {isActive ? 'Aktivan' : 'Neaktivan'}
                              </Tag>
                            ),
                          },
                          {
                            title: 'Poslednje izvršavanje',
                            dataIndex: 'lastRun',
                            key: 'lastRun',
                            render: (text: string | null) => text ? (
                              <Text type="secondary">{dayjs(text).fromNow()}</Text>
                            ) : (
                              <Text type="secondary">-</Text>
                            ),
                          },
                          {
                            title: 'Opis',
                            dataIndex: 'description',
                            key: 'description',
                            ellipsis: true,
                          },
                          {
                            title: 'Screen Proces',
                            key: 'screen_process',
                            width: 180,
                            render: (_: any, record: CronProcess) => (
                              <Space size="small">
                                <Button
                                  size="small"
                                  type={record.isActive ? 'default' : 'primary'}
                                  icon={record.isActive ? <StopOutlined /> : <PlayCircleOutlined />}
                                  loading={controllingCron === `${record.name}-${record.isActive ? 'stop' : 'start'}`}
                                  onClick={() => handleCronControl(record.isActive ? 'stop' : 'start', record.name, record.instance)}
                                >
                                  {record.isActive ? 'Stop' : 'Start'}
                                </Button>
                                <Button
                                  size="small"
                                  icon={<ReloadOutlined />}
                                  loading={controllingCron === `${record.name}-restart`}
                                  onClick={() => handleCronRestart(record.name, record.instance)}
                                  title="Restart"
                                />
                              </Space>
                            ),
                          },
                          {
                            title: 'Cron Process Legacy Server',
                            key: 'cron_process',
                            width: 200,
                            render: (_: any, record: CronProcess) => {
                              // Prikaži samo za teltonika60-74 koji imaju Smart City setup
                              if (!record.instance || record.instance < 60 || record.instance > 76) {
                                return <span style={{ color: '#ccc' }}>N/A</span>;
                              }
                              
                              return (
                                <Space size="small">
                                  <Button
                                    size="small"
                                    type={record.cronActive ? 'default' : 'primary'}
                                    icon={record.cronActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                                    loading={controllingCron === `${record.name}-cron-${record.cronActive ? 'stop' : 'start'}`}
                                    onClick={() => handleCronProcessControl(record.cronActive ? 'stop' : 'start', record.instance!)}
                                  >
                                    {record.cronActive ? 'Pause' : 'Run'}
                                  </Button>
                                  <Button
                                    size="small"
                                    icon={<RedoOutlined />}
                                    loading={controllingCron === `${record.name}-cron-run`}
                                    onClick={() => handleCronProcessControl('run', record.instance!)}
                                    title="Run Now"
                                  />
                                </Space>
                              );
                            },
                          },
                        ]}
                      />
                    ),
                  },
                ]}
              />
            )}
          </>
        ) : (
          <Spin />
        )}
        
        {cronStatus && cronStatus.cronProcesses.filter(c => !c.isActive).length > 0 && (
          <Alert
            message="Neki cron procesi nisu aktivni"
            description={`${cronStatus.cronProcesses.filter(c => !c.isActive).map(c => c.name).join(', ')} nisu izvršeni u očekivanom vremenskom okviru.`}
            type="warning"
            icon={<WarningOutlined />}
            style={{ marginTop: 16 }}
            showIcon
          />
        )}
      </Card>

      {/* Settings Modal */}
      <Modal
        title="GPS Processor Podešavanja"
        visible={settingsModalVisible}
        onOk={handleSaveSettings}
        onCancel={() => setSettingsModalVisible(false)}
        width={600}
        confirmLoading={settingsLoading}
        okText="Sačuvaj"
        cancelText="Otkaži"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            batchSize: 10000,
            intervalSeconds: 30,
            useWorkerPool: true,
            workerCount: 4,
            cleanupProcessedMinutes: 5,
            cleanupFailedHours: 2,
            cleanupStatsDays: 10
          }}
        >
          <Divider orientation="left">Procesiranje</Divider>
          
          <Form.Item
            label="Batch Size (broj GPS tačaka po ciklusu)"
            name="batchSize"
            rules={[
              { required: true, message: 'Obavezno polje' },
              { type: 'number', min: 100, max: 20000, message: 'Vrednost mora biti između 100 i 20000' }
            ]}
          >
            <InputNumber 
              min={100} 
              max={20000} 
              step={1000}
              style={{ width: '100%' }}
              addonAfter="tačaka"
            />
          </Form.Item>

          <Form.Item
            label="Interval procesiranja (sekunde)"
            name="intervalSeconds"
            rules={[
              { required: true, message: 'Obavezno polje' },
              { type: 'number', min: 10, max: 300, message: 'Vrednost mora biti između 10 i 300 sekundi' }
            ]}
            help="Napomena: Ova vrednost se trenutno ne primenjuje automatski. Cron je hardkodovan na 30 sekundi."
          >
            <InputNumber 
              min={10} 
              max={300} 
              step={10}
              style={{ width: '100%' }}
              addonAfter="sekundi"
              disabled
            />
          </Form.Item>

          <Divider orientation="left">Worker Pool Podešavanja</Divider>
          
          <Form.Item
            label="Koristi Worker Pool Pattern"
            name="useWorkerPool"
            valuePropName="checked"
            tooltip="Omogućava paralelno procesiranje sa više worker-a za 3-4x bolju brzinu"
          >
            <Switch 
              checkedChildren="Omogućeno" 
              unCheckedChildren="Onemogućeno"
            />
          </Form.Item>

          <Form.Item
            label="Broj Worker-a"
            name="workerCount"
            rules={[
              { required: true, message: 'Obavezno polje' },
              { type: 'number', min: 1, max: 8, message: 'Vrednost mora biti između 1 i 8' }
            ]}
            tooltip="Broj paralelnih worker-a koji će procesirati podatke (preporučeno: 4)"
          >
            <InputNumber 
              min={1} 
              max={8} 
              step={1}
              style={{ width: '100%' }}
              addonAfter="worker-a"
            />
          </Form.Item>

          <Divider orientation="left">Čišćenje Buffer-a</Divider>

          <Form.Item
            label="Brisanje processed zapisa nakon (minuti)"
            name="cleanupProcessedMinutes"
            rules={[
              { required: true, message: 'Obavezno polje' },
              { type: 'number', min: 1, max: 60, message: 'Vrednost mora biti između 1 i 60 minuta' }
            ]}
          >
            <InputNumber 
              min={1} 
              max={60} 
              step={1}
              style={{ width: '100%' }}
              addonAfter="minuta"
            />
          </Form.Item>

          <Form.Item
            label="Brisanje failed zapisa nakon (sati)"
            name="cleanupFailedHours"
            rules={[
              { required: true, message: 'Obavezno polje' },
              { type: 'number', min: 1, max: 48, message: 'Vrednost mora biti između 1 i 48 sati' }
            ]}
          >
            <InputNumber 
              min={1} 
              max={48} 
              step={1}
              style={{ width: '100%' }}
              addonAfter="sati"
            />
          </Form.Item>

          <Form.Item
            label="Brisanje statistika starijih od (dana)"
            name="cleanupStatsDays"
            rules={[
              { required: true, message: 'Obavezno polje' },
              { type: 'number', min: 1, max: 365, message: 'Vrednost mora biti između 1 i 365 dana' }
            ]}
          >
            <InputNumber 
              min={1} 
              max={365} 
              step={1}
              style={{ width: '100%' }}
              addonAfter="dana"
            />
          </Form.Item>

          {currentSettings && (
            <Alert 
              message="Trenutna podešavanja će biti primenjena pri sledećem ciklusu procesiranja" 
              type="info" 
              showIcon 
              style={{ marginTop: 16 }}
            />
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default GpsSyncDashboard;