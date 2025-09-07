import React, { useState, useEffect } from 'react';
import {
  Card,
  Progress,
  Statistic,
  Row,
  Col,
  Button,
  Tag,
  Space,
  Timeline,
  Alert,
  Divider,
  Select,
  InputNumber,
  Switch,
  Tooltip,
  Badge,
  Typography,
  Modal,
  Descriptions,
  message,
  Spin,
  Popconfirm,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  SettingOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  TeamOutlined,
  DatabaseOutlined,
  CompressOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CarOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { api } from '../../services/api';
import SmartSlowSyncVehicleManager from './SmartSlowSyncVehicleManager';

dayjs.extend(duration);
dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

interface SlowSyncConfig {
  preset: 'fast' | 'balanced' | 'conservative' | 'custom';
  vehiclesPerBatch: number;
  workersPerBatch: number;
  batchDelayMinutes: number;
  nightHoursStart: number;
  nightHoursEnd: number;
  maxDailyBatches: number;
  syncDaysBack: number;
  autoCleanup: boolean;
  compressAfterBatches: number;
  vacuumAfterBatches: number;
}

interface SlowSyncProgress {
  status: 'idle' | 'running' | 'paused' | 'waiting_for_next_batch' | 'completed' | 'error';
  startedAt?: string;
  lastBatchAt?: string;
  nextBatchStartTime?: string;  // Novo: vreme kada će početi sledeći batch
  completedAt?: string;
  totalVehicles: number;
  processedVehicles: number;
  currentBatch: number;
  totalBatches: number;
  vehiclesInCurrentBatch: string[];
  estimatedCompletion?: string;
  errors: Array<{ vehicleId: number; error: string; timestamp: string }>;
  stats: {
    totalPointsProcessed: number;
    averageTimePerBatch: number;
    successRate: number;
    diskSpaceUsed: string;
    compressionRatio: number;
  };
}

const PRESET_CONFIGS = {
  fast: {
    name: 'Brza (3-5 dana)',
    icon: <RocketOutlined />,
    color: '#ff4d4f',
    vehiclesPerBatch: 30,
    workersPerBatch: 6,
    batchDelayMinutes: 15,
    nightHoursStart: 20,
    nightHoursEnd: 8,
    maxDailyBatches: 30,
    description: 'Agresivni parametri za brzu sinhronizaciju. Zahteva više resursa.',
  },
  balanced: {
    name: 'Balansirana (7-10 dana)',
    icon: <ThunderboltOutlined />,
    color: '#1890ff',
    vehiclesPerBatch: 15,
    workersPerBatch: 3,
    batchDelayMinutes: 20,
    nightHoursStart: 22,
    nightHoursEnd: 6,
    maxDailyBatches: 15,
    description: 'Optimalan balans između brzine i resursa.',
  },
  conservative: {
    name: 'Konzervativna (12-15 dana)',
    icon: <ClockCircleOutlined />,
    color: '#52c41a',
    vehiclesPerBatch: 10,
    workersPerBatch: 2,
    batchDelayMinutes: 30,
    nightHoursStart: 23,
    nightHoursEnd: 5,
    maxDailyBatches: 10,
    description: 'Sigurna opcija sa minimalnim opterećenjem servera.',
  },
};

const SmartSlowSyncDashboard: React.FC = () => {
  const [progress, setProgress] = useState<SlowSyncProgress | null>(null);
  const [config, setConfig] = useState<SlowSyncConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [tempConfig, setTempConfig] = useState<SlowSyncConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleManagerVisible, setVehicleManagerVisible] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string>('');
  const [nextCronCheck, setNextCronCheck] = useState<dayjs.Dayjs | null>(null);
  const [workerStatuses, setWorkerStatuses] = useState<any[]>([]);
  const [liveActivityFeed, setLiveActivityFeed] = useState<Array<{
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>>([]);

  useEffect(() => {
    fetchProgress();
    fetchConfig();
    
    const interval = setInterval(() => {
      fetchProgress();
      updateCurrentActivity();
      
      // Računaj sledeću CRON proveru (svaka 2 minuta)
      const now = dayjs();
      const minute = now.minute();
      const nextMinute = Math.ceil(minute / 2) * 2;
      const nextCheck = now.startOf('minute').minute(nextMinute);
      if (nextCheck.isAfter(now)) {
        setNextCronCheck(nextCheck);
      } else {
        setNextCronCheck(nextCheck.add(2, 'minute'));
      }
    }, 1000); // Ažuriraj svake sekunde za precizan prikaz

    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    updateCurrentActivity();
  }, [progress, config]);

  const fetchProgress = async () => {
    try {
      const response = await api.get('/api/legacy-sync/slow-sync/progress');
      setProgress(response.data);
      
      // Ako je running, dobavi i Worker Pool statuse i live feed
      if (response.data.status === 'running') {
        try {
          const workerResponse = await api.get('/api/legacy-sync/worker-status');
          setWorkerStatuses(workerResponse.data.workers || []);
          
          // Učitaj activity feed
          try {
            const feedResponse = await api.get('/api/legacy-sync/slow-sync/activity-feed?limit=50');
            setLiveActivityFeed(feedResponse.data || []);
          } catch (feedError) {
            console.error('Error fetching activity feed:', feedError);
          }
        } catch (workerError) {
          console.error('Error fetching worker status:', workerError);
        }
      } else if (progress?.status === 'completed') {
        // Za completed status, zadrži poslednje worker statuse ali ih postavi na completed
        try {
          const workerResponse = await api.get('/api/legacy-sync/worker-status');
          const completedWorkers = (workerResponse.data.workers || []).map((worker: any) => ({
            ...worker,
            status: 'completed',
            progress: 100
          }));
          setWorkerStatuses(completedWorkers);
          
          // Učitaj activity feed i za completed
          const activityResponse = await api.get('/api/legacy-sync/slow-sync/activity-feed?limit=20');
          if (activityResponse.data?.activities) {
            setLiveActivityFeed(activityResponse.data.activities);
          }
        } catch (error) {
          console.error('Error fetching completed status:', error);
        }
      } else {
        // Očisti statuse samo za idle/stopped/error
        setWorkerStatuses([]);
        setLiveActivityFeed([]);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await api.get('/api/legacy-sync/slow-sync/config');
      setConfig(response.data);
      setTempConfig(response.data);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };
  
  const updateCurrentActivity = () => {
    if (!progress) {
      setCurrentActivity('📡 Učitavam status...');
      return;
    }
    
    if (progress.status === 'running') {
      const currentVehicles = progress.vehiclesInCurrentBatch;
      if (currentVehicles.length > 0) {
        const vehiclesList = currentVehicles.slice(0, 3).join(', ');
        const moreVehicles = currentVehicles.length > 3 ? ` i još ${currentVehicles.length - 3}` : '';
        setCurrentActivity(`🚗 Batch ${progress.currentBatch}/${progress.totalBatches} - Sinhroniše se: ${vehiclesList}${moreVehicles}`);
      } else {
        setCurrentActivity(`⏳ Priprema batch ${progress.currentBatch}/${progress.totalBatches}...`);
      }
    } else if (progress.status === 'paused') {
      setCurrentActivity('⏸️ Pauzirano - čeka nastavak');
    } else if (progress.status === 'completed') {
      setCurrentActivity('✅ Završeno - sva vozila sinhronizovana');
    } else if (progress.status === 'idle') {
      if (progress.totalVehicles > 0 && progress.processedVehicles < progress.totalVehicles) {
        // Ima još vozila za procesiranje
        if (nextCronCheck) {
          const secondsUntilCron = nextCronCheck.diff(dayjs(), 'second');
          if (secondsUntilCron > 0) {
            setCurrentActivity(`⏰ CRON provera za ${secondsUntilCron}s (automatski nastavak)`);
          } else {
            setCurrentActivity('🔄 CRON proverava...');
          }
        } else {
          setCurrentActivity('⏳ Priprema za nastavak...');
        }
      } else if (progress.lastBatchAt && config && progress.currentBatch > 0) {
        const lastBatch = dayjs(progress.lastBatchAt);
        const nextRun = lastBatch.add(config.batchDelayMinutes, 'minute');
        const remaining = nextRun.diff(dayjs(), 'second');
        if (remaining > 0) {
          const minutes = Math.floor(remaining / 60);
          const seconds = remaining % 60;
          setCurrentActivity(`⏰ Pauza između batch-ova: ${minutes}:${seconds.toString().padStart(2, '0')} do sledećeg`);
        } else {
          setCurrentActivity('🔄 Pokreće se sledeći batch...');
        }
      } else {
        setCurrentActivity('💤 Čeka se pokretanje');
      }
    } else {
      setCurrentActivity('❓ Nepoznat status');
    }
  };

  const handleStart = async () => {
    try {
      setLoading(true);
      await api.post('/api/legacy-sync/slow-sync/start', tempConfig);
      message.success('Smart Slow Sync pokrenut uspešno!');
      await fetchProgress();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri pokretanju');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      setLoading(true);
      await api.post('/api/legacy-sync/slow-sync/pause');
      message.success('Smart Slow Sync pauziran');
      await fetchProgress();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri pauziranju');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setLoading(true);
      await api.post('/api/legacy-sync/slow-sync/resume');
      message.success('Smart Slow Sync nastavljen');
      await fetchProgress();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri nastavljanju');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = () => {
    console.log('handleStop pozvano'); // Debug
    Modal.confirm({
      title: 'Zaustavi Smart Slow Sync?',
      content: 'Da li ste sigurni da želite zaustaviti proces? Progress će biti sačuvan.',
      okText: 'Da, zaustavi',
      cancelText: 'Otkaži',
      maskClosable: false,
      onOk: async () => {
        console.log('Modal onOk pozvano'); // Debug
        try {
          setLoading(true);
          const response = await api.post('/api/legacy-sync/slow-sync/stop');
          console.log('Stop response:', response.data); // Debug
          message.success('Smart Slow Sync zaustavljen');
          await fetchProgress();
        } catch (error: any) {
          console.error('Stop error:', error);
          message.error(error.response?.data?.message || 'Greška pri zaustavljanju');
        } finally {
          setLoading(false);
        }
      },
      onCancel: () => {
        console.log('Modal otkazan'); // Debug
      },
    });
  };

  const handleReset = async () => {
    Modal.confirm({
      title: 'Resetuj progress?',
      content: 'Ova akcija će obrisati sav progress i početi od početka. Da li ste sigurni?',
      okText: 'Da, resetuj',
      okType: 'danger',
      onOk: async () => {
        try {
          setLoading(true);
          await api.delete('/api/legacy-sync/slow-sync/reset');
          message.success('Progress resetovan');
          await fetchProgress();
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Greška pri resetovanju');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleSaveConfig = async () => {
    try {
      setLoading(true);
      await api.patch('/api/legacy-sync/slow-sync/config', tempConfig);
      message.success('Konfiguracija sačuvana');
      setConfig(tempConfig);
      setConfigModalVisible(false);
      await fetchConfig();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri čuvanju konfiguracije');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessBatch = async () => {
    try {
      setLoading(true);
      console.log('Pozivam process-batch endpoint...');
      const response = await api.post('/api/legacy-sync/slow-sync/process-batch');
      console.log('Process batch response:', response.data);
      message.success('Batch pokrenut');
      await fetchProgress();
    } catch (error: any) {
      console.error('Process batch error:', error);
      message.error(error.response?.data?.message || 'Greška pri pokretanju batch-a');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!progress) return null;
    
    switch (progress.status) {
      case 'running':
        return <Badge status="processing" text="U toku" />;
      case 'waiting_for_next_batch':
        return <Badge status="warning" text="Čeka sledeći batch" />;
      case 'paused':
        return <Badge status="warning" text="Pauzirano" />;
      case 'completed':
        return <Badge status="success" text="Završeno" />;
      case 'error':
        return <Badge status="error" text="Greška" />;
      default:
        return <Badge status="default" text="Neaktivno" />;
    }
  };

  const getProgressPercentage = () => {
    if (!progress || progress.totalVehicles === 0) return 0;
    return Math.round((progress.processedVehicles / progress.totalVehicles) * 100);
  };

  const formatDuration = (minutes: number) => {
    const duration = dayjs.duration(minutes, 'minutes');
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    } else if (minutes < 1440) {
      return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}min`;
    } else {
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      return `${days}d ${hours}h`;
    }
  };

  const isNightTime = () => {
    if (!config) return false;
    const hour = new Date().getHours();
    const { nightHoursStart, nightHoursEnd } = config;
    
    if (nightHoursStart < nightHoursEnd) {
      return hour >= nightHoursStart && hour < nightHoursEnd;
    } else {
      return hour >= nightHoursStart || hour < nightHoursEnd;
    }
  };

  return (
    <div className="p-6">
      <Row gutter={[16, 16]}>
        {/* Header Card */}
        <Col span={24}>
          <Card>
            <Row align="middle" justify="space-between">
              <Col>
                <Space align="center" size="large">
                  <RocketOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                  <div>
                    <Title level={3} style={{ margin: 0 }}>Smart Slow Sync - NOVI DASHBOARD</Title>
                    <Text type="secondary">Automatska noćna sinhronizacija svih vozila - sa live processingom</Text>
                  </div>
                </Space>
              </Col>
              <Col>
                <Space size="large">
                  {getStatusBadge()}
                  <Divider type="vertical" />
                  <Space>
                    {progress?.status === 'idle' && (
                      <>
                        <Button
                          type="primary"
                          size="large"
                          icon={<PlayCircleOutlined />}
                          onClick={handleStart}
                          loading={loading}
                        >
                          Pokreni
                        </Button>
                        <Popconfirm
                          title="Resetuj Smart Slow Sync?"
                          description="Ovo će obrisati sav progress i početi ispočetka. Da li ste sigurni?"
                          onConfirm={async () => {
                            try {
                              setLoading(true);
                              await api.delete('/api/legacy-sync/slow-sync/reset');
                              message.success('Smart Slow Sync resetovan');
                              await fetchProgress();
                            } catch (error: any) {
                              message.error(error.response?.data?.message || 'Greška pri resetovanju');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          okText="Da, resetuj"
                          cancelText="Otkaži"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            size="large"
                            icon={<DeleteOutlined />}
                            loading={loading}
                          >
                            Reset
                          </Button>
                        </Popconfirm>
                      </>
                    )}
                    {progress?.status === 'running' && (
                      <>
                        <Button
                          size="large"
                          icon={<PauseCircleOutlined />}
                          onClick={handlePause}
                          loading={loading}
                        >
                          Pauziraj
                        </Button>
                        <Popconfirm
                          title="Zaustavi Smart Slow Sync?"
                          description="Da li ste sigurni da želite zaustaviti proces? Progress će biti sačuvan."
                          onConfirm={async () => {
                            try {
                              setLoading(true);
                              await api.post('/api/legacy-sync/slow-sync/stop');
                              message.success('Smart Slow Sync zaustavljen');
                              await fetchProgress();
                            } catch (error: any) {
                              console.error('Stop error:', error);
                              message.error(error.response?.data?.message || 'Greška pri zaustavljanju');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          okText="Da, zaustavi"
                          cancelText="Otkaži"
                        >
                          <Button
                            danger
                            size="large"
                            icon={<StopOutlined />}
                            loading={loading}
                          >
                            Zaustavi
                          </Button>
                        </Popconfirm>
                        <Popconfirm
                          title="Resetuj Smart Slow Sync?"
                          description="UPOZORENJE: Ovo će obrisati sav progress i početi potpuno ispočetka!"
                          onConfirm={async () => {
                            try {
                              setLoading(true);
                              await api.delete('/api/legacy-sync/slow-sync/reset');
                              message.success('Smart Slow Sync resetovan');
                              await fetchProgress();
                            } catch (error: any) {
                              message.error(error.response?.data?.message || 'Greška pri resetovanju');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          okText="Da, resetuj sve"
                          cancelText="Otkaži"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            type="default"
                            size="large"
                            icon={<DeleteOutlined />}
                            loading={loading}
                          >
                            Reset
                          </Button>
                        </Popconfirm>
                      </>
                    )}
                    {progress?.status === 'paused' && (
                      <>
                        <Button
                          type="primary"
                          size="large"
                          icon={<PlayCircleOutlined />}
                          onClick={handleResume}
                          loading={loading}
                        >
                          Nastavi
                        </Button>
                        <Button
                          danger
                          size="large"
                          icon={<StopOutlined />}
                          onClick={handleStop}
                          loading={loading}
                        >
                          Zaustavi
                        </Button>
                      </>
                    )}
                    {progress?.status === 'completed' && (
                      <>
                        <Button
                          type="primary"
                          size="large"
                          icon={<PlayCircleOutlined />}
                          onClick={handleStart}
                          loading={loading}
                        >
                          Pokreni ponovo
                        </Button>
                        <Popconfirm
                          title="Resetuj Smart Slow Sync?"
                          description="Ovo će obrisati sav progress i početi potpuno ispočetka!"
                          onConfirm={async () => {
                            try {
                              setLoading(true);
                              await api.delete('/api/legacy-sync/slow-sync/reset');
                              message.success('Smart Slow Sync resetovan');
                              await fetchProgress();
                            } catch (error: any) {
                              message.error(error.response?.data?.message || 'Greška pri resetovanju');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          okText="Da, resetuj sve"
                          cancelText="Otkaži"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            size="large"
                            icon={<DeleteOutlined />}
                            loading={loading}
                          >
                            Reset
                          </Button>
                        </Popconfirm>
                      </>
                    )}
                    <Button
                      size="large"
                      icon={<SettingOutlined />}
                      onClick={() => setConfigModalVisible(true)}
                    >
                      Konfiguracija
                    </Button>
                    <Button
                      size="large"
                      icon={<CarOutlined />}
                      onClick={() => setVehicleManagerVisible(true)}
                    >
                      Upravljanje vozilima
                    </Button>
                    <Button
                      size="large"
                      icon={<ReloadOutlined />}
                      onClick={async () => {
                        setRefreshing(true);
                        await fetchProgress();
                        await fetchConfig();
                        message.info(`Status: ${progress?.status || 'nepoznat'}`);
                        setRefreshing(false);
                      }}
                      loading={refreshing}
                    >
                      Osveži
                    </Button>
                  </Space>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Live Process Monitor - Novi section */}
        {progress?.status === 'running' && (
          <>
            {/* Live Batch Overview */}
            <Col span={24}>
              <Card 
                title={
                  <Space>
                    <ThunderboltOutlined style={{ color: '#1890ff' }} />
                    <span>Live Process Monitor</span>
                    <Badge count={progress.currentBatch} style={{ backgroundColor: '#52c41a' }} />
                    <Text type="secondary">/ {progress.totalBatches} batch-ova</Text>
                  </Space>
                }
                style={{
                  background: 'linear-gradient(135deg, #f6ffed 0%, #f0f9ff 100%)',
                  border: '2px solid #1890ff',
                }}
              >
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="Trenutni batch"
                      value={progress.currentBatch}
                      suffix={`/ ${progress.totalBatches}`}
                      prefix={<RocketOutlined />}
                      valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Vozila u batch-u"
                      value={progress.vehiclesInCurrentBatch?.length || 0}
                      prefix={<CarOutlined />}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={8}>
                    <div>
                      <Text strong>Sledeći batch za:</Text>
                      <div style={{ fontSize: '20px', color: '#fa8c16', fontFamily: 'monospace' }}>
                        {nextCronCheck ? (
                          <span>{Math.max(0, nextCronCheck.diff(dayjs(), 'second'))}s</span>
                        ) : (
                          <span>--:--</span>
                        )}
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>
          </>
        )}

        {/* Live Vehicle Processing Pipeline - Prikaži za running ili waiting_for_next_batch */}
        {progress && (progress.status === 'running' || progress.status === 'waiting_for_next_batch') && (
          <Col span={24}>
            <Card title={
              <Space>
                <TeamOutlined />
                <span>Live Vehicle Processing</span>
                <Badge 
                  count={progress.vehiclesInCurrentBatch?.length || 0} 
                  style={{ backgroundColor: '#108ee9' }} 
                />
              </Space>
            }>
              {/* Prikaži countdown ako je u waiting stanju */}
              {progress.status === 'waiting_for_next_batch' && progress.nextBatchStartTime ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <ClockCircleOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
                    <Title level={3}>Čeka se sledeći batch</Title>
                    <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 24 }}>
                      Batch {progress.currentBatch} je završen. Sistem čeka pre pokretanja sledećeg batch-a.
                    </Text>
                    
                    {/* Countdown timer */}
                    <div style={{ marginBottom: 24 }}>
                      <Statistic.Countdown 
                        title="Sledeći batch počinje za:" 
                        value={dayjs(progress.nextBatchStartTime).valueOf()} 
                        format="mm:ss"
                        valueStyle={{ fontSize: 32, color: '#1890ff' }}
                        onFinish={() => {
                          message.info('Vreme je za sledeći batch!');
                          fetchProgress(); // Osveži status
                        }}
                      />
                    </div>
                    
                    <Divider />
                    
                    <Row gutter={16} justify="center">
                      <Col span={8}>
                        <Statistic 
                          title="Obrađeno vozila" 
                          value={progress.processedVehicles} 
                          suffix={`/ ${progress.totalVehicles}`}
                          valueStyle={{ color: '#52c41a' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic 
                          title="Završenih batch-ova" 
                          value={progress.currentBatch} 
                          suffix={`/ ${progress.totalBatches}`}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic 
                          title="Preostalo vozila" 
                          value={progress.totalVehicles - progress.processedVehicles}
                          valueStyle={{ color: progress.totalVehicles - progress.processedVehicles > 0 ? '#faad14' : '#52c41a' }}
                        />
                      </Col>
                    </Row>
                  </div>
                ) : progress.status === 'running' ? (
                  <Row gutter={16}>
                    {progress.vehiclesInCurrentBatch && progress.vehiclesInCurrentBatch.map((vehicleInfo, index) => {
                    // Parse vehicle info (format: "ID:123" ili "P93597")
                    const vehicleId = vehicleInfo.startsWith('ID:') 
                      ? vehicleInfo.replace('ID:', '') 
                      : vehicleInfo;
                    
                    // Pronađi odgovarajući worker status
                    // vehicleId ovde je zapravo garažni broj (npr. "P93597") iz vehiclesInCurrentBatch
                    const workerStatus = workerStatuses.find(w => {
                      // Proveri da li se garažni broj poklapa
                      if (w.garageNumber === vehicleId) return true;
                      // Ili ako je vehicleId broj, proveri da li odgovara
                      if (w.vehicleId && vehicleId.match(/^\d+$/)) {
                        return w.vehicleId.toString() === vehicleId;
                      }
                      return false;
                    });
                    
                    // Mapiranje worker status-a na faze
                    const getPhaseFromWorkerStatus = (status: string) => {
                      switch (status) {
                        case 'exporting': return 'exporting';
                        case 'transferring': return 'transferring';
                        case 'importing': return 'importing';
                        case 'detecting': return 'detecting';
                        case 'refreshing': return 'refreshing';
                        case 'completed': return 'completed';
                        case 'failed': return 'failed';
                        default: return 'idle';
                      }
                    };
                    
                    const currentPhase = workerStatus ? getPhaseFromWorkerStatus(workerStatus.status) : 'idle';
                    const currentProgress = workerStatus?.progress || 0;
                    const totalRecords = workerStatus?.totalRecords || 0;
                    const processedRecords = workerStatus?.processedRecords || 0;
                    const currentStep = workerStatus?.currentStep || '';
                    
                    return (
                      <Col key={index} span={8} style={{ marginBottom: 16 }}>
                        <Card 
                          size="small"
                          style={{
                            border: `2px solid ${
                              currentPhase === 'completed' ? '#52c41a' : 
                              currentPhase === 'failed' ? '#ff4d4f' : 
                              '#1890ff'
                            }`,
                            background: 
                              currentPhase === 'completed' ? '#f6ffed' : 
                              currentPhase === 'failed' ? '#fff2f0' :
                              '#f0f9ff'
                          }}
                        >
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 8 }}>
                              🚗 {workerStatus?.garageNumber || vehicleId}
                            </div>
                            
                            {/* Process Pipeline Visualization */}
                            <div style={{ marginBottom: 12 }}>
                              <Space size="small">
                                {/* Export faza */}
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: currentPhase === 'exporting' ? '#1890ff' : 
                                             ['transferring', 'importing', 'detecting', 'refreshing', 'completed'].includes(currentPhase) ? '#52c41a' : '#d9d9d9',
                                  color: 'white', fontSize: '12px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>📤</div>
                                <div style={{ 
                                  width: 15, height: 2, 
                                  background: ['transferring', 'importing', 'detecting', 'refreshing', 'completed'].includes(currentPhase) ? '#52c41a' : '#d9d9d9' 
                                }} />
                                
                                {/* Transfer faza */}
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: currentPhase === 'transferring' ? '#1890ff' : 
                                             ['importing', 'detecting', 'refreshing', 'completed'].includes(currentPhase) ? '#52c41a' : '#d9d9d9',
                                  color: 'white', fontSize: '12px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>🚛</div>
                                <div style={{ 
                                  width: 15, height: 2, 
                                  background: ['importing', 'detecting', 'refreshing', 'completed'].includes(currentPhase) ? '#52c41a' : '#d9d9d9' 
                                }} />
                                
                                {/* Import faza */}
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: currentPhase === 'importing' ? '#1890ff' : 
                                             ['detecting', 'refreshing', 'completed'].includes(currentPhase) ? '#52c41a' : '#d9d9d9',
                                  color: 'white', fontSize: '12px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>📥</div>
                                <div style={{ 
                                  width: 15, height: 2, 
                                  background: ['detecting', 'refreshing', 'completed'].includes(currentPhase) ? '#52c41a' : '#d9d9d9' 
                                }} />
                                
                                {/* Detecting faza */}
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: currentPhase === 'detecting' ? '#1890ff' : 
                                             ['refreshing', 'completed'].includes(currentPhase) ? '#52c41a' : '#d9d9d9',
                                  color: 'white', fontSize: '12px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>🎯</div>
                                <div style={{ 
                                  width: 15, height: 2, 
                                  background: ['refreshing', 'completed'].includes(currentPhase) ? '#52c41a' : '#d9d9d9' 
                                }} />
                                
                                {/* Refresh faza (opciona) */}
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: currentPhase === 'refreshing' ? '#1890ff' : 
                                             currentPhase === 'completed' ? '#52c41a' : '#d9d9d9',
                                  color: 'white', fontSize: '12px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>📊</div>
                              </Space>
                            </div>
                            
                            {/* Current Phase Label */}
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: 8 }}>
                              {currentPhase === 'idle' && '⏸️ Na čekanju'}
                              {currentPhase === 'exporting' && '📤 Exportovanje sa legacy servera'}
                              {currentPhase === 'transferring' && '🚛 Transfer fajla'}
                              {currentPhase === 'importing' && '📥 Import u TimescaleDB'}
                              {currentPhase === 'detecting' && '🎯 Detekcija agresivne vožnje'}
                              {currentPhase === 'refreshing' && '📊 Osvežavanje agregata'}
                              {currentPhase === 'completed' && '✅ Završeno'}
                              {currentPhase === 'failed' && '❌ Greška'}
                              {/* Prikaži custom step ako postoji */}
                              {currentStep && currentStep !== currentPhase && (
                                <div style={{ fontSize: '10px', color: '#999', marginTop: 2 }}>
                                  {currentStep}
                                </div>
                              )}
                            </div>
                            
                            {/* Progress Bar */}
                            <Progress 
                              percent={currentProgress} 
                              size="small"
                              status={
                                currentPhase === 'completed' ? 'success' : 
                                currentPhase === 'failed' ? 'exception' :
                                'active'
                              }
                              strokeColor={
                                currentPhase === 'completed' ? '#52c41a' : 
                                currentPhase === 'failed' ? '#ff4d4f' :
                                '#1890ff'
                              }
                            />
                            
                            {/* Real Stats */}
                            <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                              {currentPhase === 'completed' && totalRecords > 0 && (
                                <span>✓ {totalRecords.toLocaleString()} GPS tačaka</span>
                              )}
                              {currentPhase === 'failed' && workerStatus?.error && (
                                <span style={{ color: '#ff4d4f' }}>❌ {workerStatus.error}</span>
                              )}
                              {!['completed', 'failed', 'idle'].includes(currentPhase) && (
                                <span>
                                  {processedRecords.toLocaleString()} / {totalRecords.toLocaleString()} 
                                  {totalRecords > 0 && ` (${Math.round((processedRecords / totalRecords) * 100)}%)`}
                                </span>
                              )}
                              {currentPhase === 'idle' && (
                                <span>⏳ Čeka worker</span>
                              )}
                              
                              {/* Worker ID i time */}
                              {workerStatus && (
                                <div style={{ fontSize: '10px', color: '#ccc', marginTop: 2 }}>
                                  Worker #{workerStatus.workerId} 
                                  {workerStatus.startedAt && ` • ${dayjs(workerStatus.startedAt).fromNow()}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                  </Row>
                ) : null}
              </Card>
            </Col>
          )}

          {/* Live Activity Feed - Samo za running stanje */}
          {progress?.status === 'running' && (
            <Col span={24}>
              <Card 
                title={
                  <Space>
                    <InfoCircleOutlined />
                    <span>Live Activity Feed</span>
                    <Badge 
                      status="processing" 
                      text="Real-time" 
                      style={{ fontSize: '12px' }} 
                    />
                  </Space>
                }
                style={{ maxHeight: 400, overflowY: 'auto' }}
              >
                <div style={{ fontFamily: 'monospace', fontSize: '13px', maxHeight: '300px', overflowY: 'auto' }}>
                  {liveActivityFeed.length > 0 ? (
                    liveActivityFeed.slice().reverse().map((activity, index) => (
                      <div key={index} style={{ 
                        color: activity.type === 'success' ? '#52c41a' :
                               activity.type === 'error' ? '#ff4d4f' :
                               activity.type === 'warning' ? '#fa8c16' :
                               '#1890ff',
                        marginBottom: 4,
                        padding: '2px 0',
                        borderLeft: activity.type === 'error' ? '3px solid #ff4d4f' : 'none',
                        paddingLeft: activity.type === 'error' ? '8px' : '0'
                      }}>
                        [{dayjs(activity.timestamp).format('HH:mm:ss')}] {activity.message}
                      </div>
                    ))
                  ) : (
                    // Mock data kada nema realnih podataka
                    <>
                      <div style={{ color: '#52c41a', marginBottom: 4 }}>
                        [{dayjs().format('HH:mm:ss')}] 🚗 P93597 - Export završen: 47,382 GPS tačaka
                      </div>
                      <div style={{ color: '#1890ff', marginBottom: 4 }}>
                        [{dayjs().subtract(2, 'second').format('HH:mm:ss')}] 📥 P94001 - Import Batch 12/45: 25,000 tačaka
                      </div>
                      <div style={{ color: '#fa8c16', marginBottom: 4 }}>
                        [{dayjs().subtract(5, 'second').format('HH:mm:ss')}] 🎯 P93456 - Agresivna vožnja: 23 eventi detektovani
                      </div>
                      <div style={{ color: '#666', marginBottom: 4 }}>
                        [{dayjs().subtract(8, 'second').format('HH:mm:ss')}] 🚛 P93789 - Transfer fajla: 2.3MB (compressed)
                      </div>
                      <div style={{ color: '#52c41a', marginBottom: 4 }}>
                        [{dayjs().subtract(12, 'second').format('HH:mm:ss')}] ✅ P93123 - Kompletno završeno za 2.4min
                      </div>
                      <div style={{ color: '#999', fontSize: '11px', textAlign: 'center', marginTop: 16 }}>
                        Live feed će se prikazati kada Smart Slow Sync bude aktivan
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </Col>
          )}

          {/* Queue Preview - Samo za running stanje */}
          {progress?.status === 'running' && (
            <Col span={24}>
              <Card title={
                <Space>
                  <ClockCircleOutlined />
                  <span>Queue Preview</span>
                  <Text type="secondary">(sledeći batch-ovi)</Text>
                </Space>
              }>
                <Row gutter={8}>
                  {[1,2,3,4,5].map((batchNum) => (
                    <Col key={batchNum} span={4}>
                      <div style={{
                        padding: '12px',
                        border: '1px solid #d9d9d9',
                        borderRadius: '6px',
                        textAlign: 'center',
                        background: '#fafafa'
                      }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                          Batch {(progress.currentBatch || 0) + batchNum}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          ~{config?.vehiclesPerBatch || 10} vozila
                        </div>
                        <div style={{ fontSize: '11px', color: '#999' }}>
                          ETA: {dayjs().add(batchNum * (config?.batchDelayMinutes || 30), 'minute').format('HH:mm')}
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>
          )}

        {/* Success Summary kada je completed */}
        {progress?.status === 'completed' && (
          <Col span={24}>
            <Card 
              style={{ 
                background: 'linear-gradient(135deg, #f6ffed 0%, #f0f9ff 100%)',
                border: '2px solid #52c41a',
                borderRadius: '12px'
              }}
            >
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <Title level={2} style={{ color: '#52c41a', margin: '0 0 16px 0' }}>
                  Smart Slow Sync Završen Uspešno!
                </Title>
                <Row gutter={24} style={{ marginTop: '24px' }}>
                  <Col span={6}>
                    <Statistic
                      title="Vozila procesirana"
                      value={progress.processedVehicles}
                      suffix={`/ ${progress.totalVehicles}`}
                      valueStyle={{ color: '#52c41a', fontSize: '24px' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="GPS tačaka"
                      value={progress.stats.totalPointsProcessed || 0}
                      valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                      prefix={<DatabaseOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Uspešnost"
                      value={progress.stats.successRate || 100}
                      suffix="%"
                      valueStyle={{ color: '#52c41a', fontSize: '24px' }}
                      prefix={<ThunderboltOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Ukupno vreme"
                      value={progress.completedAt && progress.startedAt ? 
                        Math.round(dayjs(progress.completedAt).diff(dayjs(progress.startedAt), 'minute', true)) : 0}
                      suffix="min"
                      valueStyle={{ color: '#fa8c16', fontSize: '24px' }}
                      prefix={<ClockCircleOutlined />}
                    />
                  </Col>
                </Row>
                
                {progress.completedAt && (
                  <div style={{ marginTop: '24px', fontSize: '14px', color: '#666' }}>
                    Završeno: {dayjs(progress.completedAt).format('DD.MM.YYYY HH:mm:ss')}
                  </div>
                )}
              </div>
            </Card>
          </Col>
        )}

        {/* Status kada nije aktivan (osim completed) */}
        {progress?.status !== 'running' && progress?.status !== 'completed' && currentActivity && (
          <Col span={24}>
            <Alert
              message={
                <div style={{ fontSize: '16px', fontWeight: 500 }}>
                  <Space>
                    <Spin spinning={false} size="small" />
                    {currentActivity}
                  </Space>
                </div>
              }
              type={
                progress?.status === 'error' ? 'error' : 'warning'
              }
              showIcon={true}
              style={{ 
                borderRadius: '8px',
                transition: 'all 0.3s ease'
              }}
            />
          </Col>
        )}

        {/* Progress Overview */}
        <Col span={24}>
          <Card title="Napredak">
            <Row gutter={16}>
              <Col span={18}>
                <div style={{ marginBottom: 24 }}>
                  <Text strong>Ukupan napredak</Text>
                  <Progress
                    percent={getProgressPercentage()}
                    status={progress?.status === 'running' ? 'active' : undefined}
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                    format={(percent) => (
                      <span>
                        {percent}% ({progress?.processedVehicles || 0}/{progress?.totalVehicles || 0})
                      </span>
                    )}
                  />
                </div>
                <div>
                  <Text strong>Trenutni batch</Text>
                  <Progress
                    percent={
                      progress && progress.totalBatches > 0
                        ? Math.round((progress.currentBatch / progress.totalBatches) * 100)
                        : 0
                    }
                    steps={progress?.totalBatches || 0}
                    size="small"
                    strokeColor="#52c41a"
                    format={() => `${progress?.currentBatch || 0} / ${progress?.totalBatches || 0}`}
                  />
                </div>
              </Col>
              <Col span={6}>
                <Statistic
                  title="Procenjeno završetak"
                  value={progress?.estimatedCompletion ? dayjs(progress.estimatedCompletion).format('DD.MM.YYYY') : 'N/A'}
                  prefix={<ClockCircleOutlined />}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Statistics */}
        <Col span={24}>
          <Card title="Statistike">
            <Row gutter={16}>
              <Col span={4}>
                <Statistic
                  title="GPS tačaka"
                  value={progress?.stats.totalPointsProcessed || 0}
                  suffix="total"
                  prefix={<DatabaseOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="Prosečno vreme/batch"
                  value={formatDuration(progress?.stats.averageTimePerBatch || 0)}
                  prefix={<ClockCircleOutlined />}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="Uspešnost"
                  value={progress?.stats.successRate || 100}
                  suffix="%"
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ 
                    color: (progress?.stats.successRate || 100) >= 95 ? '#3f8600' : '#cf1322' 
                  }}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="Disk prostor"
                  value={progress?.stats.diskSpaceUsed || '0GB'}
                  prefix={<DatabaseOutlined />}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="Kompresija"
                  value={`${progress?.stats.compressionRatio?.toFixed(1) || '1.0'}x`}
                  prefix={<CompressOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="Greške"
                  value={progress?.errors.length || 0}
                  prefix={<WarningOutlined />}
                  valueStyle={{ 
                    color: (progress?.errors.length || 0) > 0 ? '#cf1322' : '#3f8600' 
                  }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Current Configuration */}
        <Col span={12}>
          <Card 
            title="Trenutna konfiguracija"
            extra={
              <Tag 
                icon={PRESET_CONFIGS[config?.preset as keyof typeof PRESET_CONFIGS]?.icon}
                color={PRESET_CONFIGS[config?.preset as keyof typeof PRESET_CONFIGS]?.color}
              >
                {PRESET_CONFIGS[config?.preset as keyof typeof PRESET_CONFIGS]?.name || 'Custom'}
              </Tag>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Vozila po batch-u">
                {config?.vehiclesPerBatch || 0}
              </Descriptions.Item>
              <Descriptions.Item label="Worker-a po batch-u">
                {config?.workersPerBatch || 0}
              </Descriptions.Item>
              <Descriptions.Item label="Pauza između batch-ova">
                {config?.batchDelayMinutes || 0} minuta
              </Descriptions.Item>
              <Descriptions.Item label="Noćni sati">
                {config?.nightHoursStart || 0}:00 - {config?.nightHoursEnd || 0}:00
              </Descriptions.Item>
              <Descriptions.Item label="Max batch-ova dnevno">
                {config?.maxDailyBatches || 0}
              </Descriptions.Item>
              <Descriptions.Item label="Period sinhronizacije">
                {config?.syncDaysBack || 0} dana unazad
              </Descriptions.Item>
              <Descriptions.Item label="Auto cleanup">
                <Tag color={config?.autoCleanup ? 'green' : 'red'}>
                  {config?.autoCleanup ? 'DA' : 'NE'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* System Status */}
        <Col span={12}>
          <Card title="Status sistema">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Alert
                message={isNightTime() ? 'Noćni sati - Sync može da radi' : 'Dnevni sati - Sync je pauziran'}
                type={isNightTime() ? 'success' : 'info'}
                icon={isNightTime() ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                showIcon
              />
              
              {progress?.vehiclesInCurrentBatch && progress.vehiclesInCurrentBatch.length > 0 && (
                <div>
                  <Text strong>Vozila u trenutnom batch-u:</Text>
                  <div style={{ marginTop: 8 }}>
                    <Space wrap>
                      {progress.vehiclesInCurrentBatch.map((vehicle, index) => (
                        <Tag key={index} color="blue">{vehicle}</Tag>
                      ))}
                    </Space>
                  </div>
                </div>
              )}

              {progress?.startedAt && (
                <div>
                  <Space>
                    <Text type="secondary">Započeto:</Text>
                    <Text>{dayjs(progress.startedAt).format('DD.MM.YYYY HH:mm')}</Text>
                  </Space>
                </div>
              )}

              {progress?.lastBatchAt && (
                <div>
                  <Space>
                    <Text type="secondary">Poslednji batch:</Text>
                    <Text>{dayjs(progress.lastBatchAt).fromNow()}</Text>
                  </Space>
                </div>
              )}

              {/* Debug dugme za ručno pokretanje batch-a */}
              {process.env.NODE_ENV === 'development' && (
                <Button
                  onClick={handleProcessBatch}
                  disabled={progress?.status !== 'running'}
                  size="small"
                >
                  [DEBUG] Pokreni batch ručno
                </Button>
              )}
            </Space>
          </Card>
        </Col>

        {/* Recent Errors */}
        {progress?.errors && progress.errors.length > 0 && (
          <Col span={24}>
            <Card 
              title={
                <Space>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  <span>Poslednje greške</span>
                </Space>
              }
            >
              <Timeline>
                {progress.errors.slice(-5).reverse().map((error, index) => (
                  <Timeline.Item
                    key={index}
                    color="red"
                    dot={<CloseCircleOutlined />}
                  >
                    <Space direction="vertical" size="small">
                      <Text strong>Vozilo ID: {error.vehicleId || 'N/A'}</Text>
                      <Text type="danger">{error.error}</Text>
                      <Text type="secondary">
                        {dayjs(error.timestamp).format('DD.MM.YYYY HH:mm:ss')}
                      </Text>
                    </Space>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </Col>
        )}
      </Row>

      {/* Configuration Modal */}
      <Modal
        title="Konfiguracija Smart Slow Sync"
        open={configModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalVisible(false)}
        width={600}
        confirmLoading={loading}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>Preset:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={tempConfig?.preset}
              onChange={(value) => {
                const preset = PRESET_CONFIGS[value as keyof typeof PRESET_CONFIGS];
                if (preset && value !== 'custom') {
                  setTempConfig({
                    ...tempConfig!,
                    preset: value,
                    vehiclesPerBatch: preset.vehiclesPerBatch,
                    workersPerBatch: preset.workersPerBatch,
                    batchDelayMinutes: preset.batchDelayMinutes,
                    nightHoursStart: preset.nightHoursStart,
                    nightHoursEnd: preset.nightHoursEnd,
                    maxDailyBatches: preset.maxDailyBatches,
                  });
                } else {
                  setTempConfig({ ...tempConfig!, preset: value });
                }
              }}
            >
              {Object.entries(PRESET_CONFIGS).map(([key, preset]) => (
                <Select.Option key={key} value={key}>
                  <Space>
                    {preset.icon}
                    <span>{preset.name}</span>
                  </Space>
                </Select.Option>
              ))}
              <Select.Option value="custom">
                <Space>
                  <SettingOutlined />
                  <span>Custom</span>
                </Space>
              </Select.Option>
            </Select>
            {tempConfig?.preset && tempConfig.preset !== 'custom' && (
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                {PRESET_CONFIGS[tempConfig.preset as keyof typeof PRESET_CONFIGS]?.description}
              </Paragraph>
            )}
          </div>

          <Divider />

          <Row gutter={16}>
            <Col span={12}>
              <Text strong>Vozila po batch-u:</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                min={1}
                max={50}
                value={tempConfig?.vehiclesPerBatch}
                onChange={(value) => setTempConfig({ ...tempConfig!, vehiclesPerBatch: value || 10 })}
              />
            </Col>
            <Col span={12}>
              <Text strong>Worker-a po batch-u:</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                min={1}
                max={10}
                value={tempConfig?.workersPerBatch}
                onChange={(value) => setTempConfig({ ...tempConfig!, workersPerBatch: value || 2 })}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Text strong>Pauza između batch-ova (min):</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                min={5}
                max={120}
                value={tempConfig?.batchDelayMinutes}
                onChange={(value) => setTempConfig({ ...tempConfig!, batchDelayMinutes: value || 30 })}
              />
            </Col>
            <Col span={12}>
              <Text strong>Max batch-ova dnevno:</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                min={1}
                max={50}
                value={tempConfig?.maxDailyBatches}
                onChange={(value) => setTempConfig({ ...tempConfig!, maxDailyBatches: value || 10 })}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Text strong>Noćni sati početak:</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                min={0}
                max={23}
                value={tempConfig?.nightHoursStart}
                onChange={(value) => setTempConfig({ ...tempConfig!, nightHoursStart: value || 22 })}
                formatter={(value) => `${value}:00`}
                parser={(value) => parseInt(value?.replace(':00', '') || '0')}
              />
            </Col>
            <Col span={12}>
              <Text strong>Noćni sati kraj:</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                min={0}
                max={23}
                value={tempConfig?.nightHoursEnd}
                onChange={(value) => setTempConfig({ ...tempConfig!, nightHoursEnd: value || 6 })}
                formatter={(value) => `${value}:00`}
                parser={(value) => parseInt(value?.replace(':00', '') || '0')}
              />
            </Col>
          </Row>

          <div>
            <Text strong>Period sinhronizacije (dana unazad):</Text>
            <InputNumber
              style={{ width: '100%', marginTop: 8 }}
              min={1}
              max={365}
              value={tempConfig?.syncDaysBack}
              onChange={(value) => setTempConfig({ ...tempConfig!, syncDaysBack: value || 120 })}
            />
          </div>

          <div>
            <Space>
              <Switch
                checked={tempConfig?.autoCleanup}
                onChange={(checked) => setTempConfig({ ...tempConfig!, autoCleanup: checked })}
              />
              <Text>Auto cleanup nakon svakog batch-a</Text>
            </Space>
          </div>

          <Alert
            message="Napomena"
            description="Promene će biti primenjene tek nakon restarta trenutnog procesa."
            type="info"
            showIcon
          />
        </Space>
      </Modal>

      {/* Vehicle Manager Modal */}
      <SmartSlowSyncVehicleManager
        visible={vehicleManagerVisible}
        onClose={() => setVehicleManagerVisible(false)}
      />
    </div>
  );
};

export default SmartSlowSyncDashboard;