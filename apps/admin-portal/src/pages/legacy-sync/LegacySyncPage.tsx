import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  Tag,
  Space,
  DatePicker,
  message,
  Modal,
  Progress,
  Tooltip,
  Alert,
  Badge,
  Input,
  Switch,
  Divider,
  Statistic,
  Row,
  Col,
  Tabs,
  Radio,
  InputNumber,
  Timeline,
  Descriptions,
  Checkbox,
} from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  WarningOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { api } from '../../services/api';
import SmartSlowSyncDashboard from './SmartSlowSyncDashboard';

const { RangePicker } = DatePicker;
// TabPane je deprecated, koristimo items API

interface VehicleWithSyncStatus {
  id: number;
  garage_number: string;
  vehicle_model: string;
  registration_number: string;
  last_sync_date: Date | null;
  total_gps_points: number;
  sync_status: 'never' | 'syncing' | 'completed' | 'error';
  last_sync_error: string | null;
  legacy_table_name: string;
  legacy_database: string;
}

interface SyncProgress {
  vehicle_id: number;
  garage_number: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress_percentage: number;
  total_records: number;
  processed_records: number;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
  logs?: string[];
  currentStep?: string;
}

interface WorkerStatus {
  workerId: number;
  vehicleId?: number;
  garageNumber?: string;
  status: 'idle' | 'exporting' | 'transferring' | 'importing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  startTime?: Date;
}

interface WorkerPoolStatus {
  enabled: boolean;
  activeWorkers: number;
  maxWorkers: number;
  workers: WorkerStatus[];
}

// Smart Slow Sync interfejsi
interface SlowSyncConfig {
  enabled: boolean;
  vehiclesPerBatch: number;
  workersPerBatch: number;
  batchDelayMinutes: number;
  nightHoursStart: number;
  nightHoursEnd: number;
  syncDaysBack: number;
  autoCleanup: boolean;
  compressAfterBatches: number;
  maxDailyBatches: number;
  preset: 'fast' | 'balanced' | 'conservative' | 'custom';
}

interface SlowSyncProgress {
  totalVehicles: number;
  processedVehicles: number;
  currentBatch: number;
  totalBatches: number;
  startedAt: Date;
  estimatedCompletion: Date;
  totalPointsProcessed: number;
  lastBatchDuration: number;
  status: 'idle' | 'running' | 'paused' | 'completed';
}

const SYNC_PRESETS = {
  fast: {
    name: 'Brza (3-5 dana)',
    vehiclesPerBatch: 30,
    workersPerBatch: 6,
    batchDelayMinutes: 15,
    nightHoursStart: 20,
    nightHoursEnd: 8,
    maxDailyBatches: 30,
    description: 'Agresivni parametri za brzu sinhronizaciju. Zahteva više resursa.'
  },
  balanced: {
    name: 'Balansirana (7-10 dana)',
    vehiclesPerBatch: 15,
    workersPerBatch: 3,
    batchDelayMinutes: 20,
    nightHoursStart: 22,
    nightHoursEnd: 6,
    maxDailyBatches: 15,
    description: 'Optimalan balans između brzine i resursa.'
  },
  conservative: {
    name: 'Konzervativna (12-15 dana)',
    vehiclesPerBatch: 10,
    workersPerBatch: 2,
    batchDelayMinutes: 30,
    nightHoursStart: 23,
    nightHoursEnd: 5,
    maxDailyBatches: 10,
    description: 'Sigurna opcija sa minimalnim opterećenjem servera.'
  }
};

const LegacySyncPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<VehicleWithSyncStatus[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<VehicleWithSyncStatus[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'days'),
    dayjs(),
  ]);
  const [syncProgress, setSyncProgress] = useState<Map<number, SyncProgress>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [syncModal, setSyncModal] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [refreshAggregates, setRefreshAggregates] = useState(false); // Nova opcija za refresh
  const [workerPoolStatus, setWorkerPoolStatus] = useState<WorkerPoolStatus>({
    enabled: false,
    activeWorkers: 0,
    maxWorkers: 3,
    workers: []
  });
  const [workerPoolLoading, setWorkerPoolLoading] = useState(false);

  // Učitaj vozila pri mount-u
  useEffect(() => {
    fetchVehicles();
    testLegacyConnection();
    fetchWorkerPoolStatus();
  }, []);

  // Polling za progress kada je sync aktivan
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (syncing && currentJobId) {
      intervalId = setInterval(() => {
        fetchSyncProgress();
        fetchWorkerPoolStatus(); // Ažuriraj i Worker Pool status
      }, 1000); // Svake 1 sekund za brži response
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [syncing, currentJobId]);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/legacy-sync/vehicles');
      setVehicles(response.data);
      setFilteredVehicles(response.data);
    } catch (error) {
      message.error('Greška pri učitavanju vozila');
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter vozila po search text-u
  useEffect(() => {
    if (!searchText) {
      setFilteredVehicles(vehicles);
    } else {
      const filtered = vehicles.filter(v => 
        v.garage_number.toLowerCase().includes(searchText.toLowerCase()) ||
        v.registration_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        v.vehicle_model?.toString().toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredVehicles(filtered);
    }
  }, [searchText, vehicles]);

  const testLegacyConnection = async () => {
    try {
      const response = await api.get('/api/legacy-sync/test-connection');
      setConnectionStatus({
        connected: response.data.connected,
        message: response.data.message,
      });
    } catch (error) {
      setConnectionStatus({
        connected: false,
        message: 'Nije moguće povezati se sa legacy serverom',
      });
    }
  };

  const fetchWorkerPoolStatus = async () => {
    try {
      const response = await api.get('/api/legacy-sync/worker-status');
      setWorkerPoolStatus(response.data);
    } catch (error) {
      console.error('Error fetching worker pool status:', error);
    }
  };

  const toggleWorkerPool = async (enabled: boolean) => {
    setWorkerPoolLoading(true);
    try {
      const response = await api.post('/api/legacy-sync/worker-pool/toggle', { enabled });
      message.success(response.data.message);
      setWorkerPoolStatus(prev => ({ ...prev, enabled }));
      await fetchWorkerPoolStatus(); // Refresh full status
    } catch (error: any) {
      message.error(`Greška: ${error.response?.data?.message || 'Nepoznata greška'}`);
    } finally {
      setWorkerPoolLoading(false);
    }
  };

  const fetchSyncProgress = async () => {
    if (!currentJobId) return;
    
    try {
      const response = await api.get(`/api/legacy-sync/progress?job_id=${currentJobId}`);
      const progressMap = new Map<number, SyncProgress>();
      
      let totalProcessed = 0;
      let totalRecords = 0;
      let completedVehicles = 0;
      let errorVehicles = 0;
      
      response.data.forEach((progress: SyncProgress) => {
        progressMap.set(progress.vehicle_id, progress);
        totalProcessed += progress.processed_records;
        totalRecords += progress.total_records;
        
        if (progress.status === 'completed') completedVehicles++;
        if (progress.status === 'error') errorVehicles++;
      });
      
      setSyncProgress(progressMap);
      
      // Ažuriraj overall progress
      const calculatedProgress = totalRecords > 0 ? (totalProcessed / totalRecords) * 100 : 0;
      setOverallProgress(Math.min(calculatedProgress, 95));
      
      // Ažuriraj log sa backend porukama
      setSyncLogs(prev => {
        // Sakupi sve logove iz backend-a
        const allLogs: string[] = [];
        
        response.data.forEach((progress: SyncProgress) => {
          if (progress.logs && progress.logs.length > 0) {
            allLogs.push(...progress.logs);
          }
        });
        
        // Ako imamo backend logove, potpuno zameni postojeće
        // Backend sada čuva kompletan log history uključujući "žive" ažurirane logove
        if (allLogs.length > 0) {
          return allLogs;
        }
        
        // Ako nema backend logova, zadrži postojeće
        return prev;
      });
      
      // Proveri da li su svi završeni
      const allCompleted = response.data.every(
        (p: SyncProgress) => p.status === 'completed' || p.status === 'error'
      );
      
      if (allCompleted && response.data.length > 0) {
        setSyncing(false);
        setCurrentJobId(null);
        setOverallProgress(100);
        setSyncLogs(prev => [...prev, `✅ Sinhronizacija završena! Procesirano ${totalProcessed} GPS tačaka za ${completedVehicles} vozila.`]);
        message.success('Sinhronizacija završena');
        fetchVehicles(); // Osvježi listu
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  };

  const handleStartSync = async () => {
    if (selectedVehicles.length === 0) {
      message.warning('Molimo odaberite barem jedno vozilo');
      return;
    }
    
    if (!dateRange[0] || !dateRange[1]) {
      message.warning('Molimo odaberite period za sinhronizaciju');
      return;
    }
    
    // Resetuj state i otvori modal
    setSyncLogs([]);
    setOverallProgress(0);
    setSyncModal(true);
    setSyncing(true);
    
    // Prikaži početne log poruke
    const selectedVehicleDetails = vehicles
      .filter(v => selectedVehicles.includes(v.id))
      .map(v => v.garage_number);
    
    setSyncLogs([
      `🚀 Pokretanje sinhronizacije za ${selectedVehicles.length} vozila...`,
      `🚗 Vozila: ${selectedVehicleDetails.slice(0, 3).join(', ')}${selectedVehicles.length > 3 ? '...' : ''}`,
      `📅 Period: ${dateRange[0].format('DD.MM.YYYY')} - ${dateRange[1].format('DD.MM.YYYY')}`,
      `🔄 Slanje zahteva na server...`
    ]);
    
    try {
      setSyncLogs(prev => [...prev, '📡 Povezivanje sa legacy bazom podataka...']);
      setOverallProgress(10);
      
      const response = await api.post('/api/legacy-sync/start', {
        vehicle_ids: selectedVehicles,
        sync_from: dateRange[0].toISOString(),
        sync_to: dateRange[1].toISOString(),
        refresh_aggregates: refreshAggregates, // Prosleđujemo opciju
      });
      
      setCurrentJobId(response.data.job_id);
      setSyncLogs(prev => [...prev, `✅ ${response.data.message}`]);
      setSyncLogs(prev => [...prev, `🔍 Job ID: ${response.data.job_id}`]);
      setOverallProgress(20);
      
      // Započni praćenje progresa
      setSyncLogs(prev => [...prev, '📊 Praćenje progresa sinhronizacije...']);
    } catch (error: any) {
      setSyncLogs(prev => [...prev, `❌ Greška: ${error.response?.data?.message || 'Nepoznata greška'}`]);
      message.error('Greška pri pokretanju sinhronizacije');
      setSyncing(false);
      setOverallProgress(0);
    }
  };

  const handleStopSync = async () => {
    if (!currentJobId) return;
    
    Modal.confirm({
      title: 'Zaustavi sinhronizaciju',
      content: 'Da li ste sigurni da želite da zaustavite sinhronizaciju?',
      onOk: async () => {
        try {
          await api.post('/api/legacy-sync/stop', { job_id: currentJobId });
          message.info('Sinhronizacija zaustavljena');
          setSyncing(false);
          setCurrentJobId(null);
          setSyncProgress(new Map());
        } catch (error) {
          message.error('Greška pri zaustavljanju sinhronizacije');
        }
      },
    });
  };

  const getSyncStatusTag = (status: string) => {
    switch (status) {
      case 'never':
        return <Tag>Nikad sinhronizovano</Tag>;
      case 'syncing':
        return <Tag icon={<SyncOutlined spin />} color="processing">Sinhronizuje se</Tag>;
      case 'completed':
        return <Tag icon={<CheckCircleOutlined />} color="success">Završeno</Tag>;
      case 'error':
        return <Tag icon={<CloseCircleOutlined />} color="error">Greška</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns: ColumnsType<VehicleWithSyncStatus> = [
    {
      title: 'Garažni broj',
      dataIndex: 'garage_number',
      key: 'garage_number',
      width: 120,
      fixed: 'left',
      render: (text, record) => {
        const progress = syncProgress.get(record.id);
        if (progress && progress.status === 'running') {
          return (
            <Space>
              <LoadingOutlined spin />
              <span>{text}</span>
            </Space>
          );
        }
        return text;
      },
    },
    {
      title: 'Model',
      dataIndex: 'vehicle_model',
      key: 'vehicle_model',
      width: 150,
    },
    {
      title: 'Registracija',
      dataIndex: 'registration_number',
      key: 'registration_number',
      width: 120,
    },
    {
      title: 'Legacy tabela',
      dataIndex: 'legacy_table_name',
      key: 'legacy_table_name',
      width: 150,
      render: (text) => (
        <Tooltip title={`Tabela u legacy bazi`}>
          <Tag icon={<DatabaseOutlined />}>{text}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'GPS tačaka',
      dataIndex: 'total_gps_points',
      key: 'total_gps_points',
      width: 100,
      align: 'right',
      render: (value) => value.toLocaleString(),
    },
    {
      title: 'Poslednja sinhronizacija',
      dataIndex: 'last_sync_date',
      key: 'last_sync_date',
      width: 180,
      render: (date) => {
        if (!date) return <Tag>Nikad</Tag>;
        return dayjs(date).format('DD.MM.YYYY HH:mm');
      },
    },
    {
      title: 'Status',
      dataIndex: 'sync_status',
      key: 'sync_status',
      width: 150,
      render: (status, record) => {
        const progress = syncProgress.get(record.id);
        if (progress) {
          if (progress.status === 'running') {
            return (
              <Tooltip title={`Obrađeno: ${progress.processed_records.toLocaleString()} / ${progress.total_records.toLocaleString()}`}>
                <Progress 
                  percent={progress.progress_percentage} 
                  size="small" 
                  status="active"
                />
              </Tooltip>
            );
          }
          if (progress.status === 'error') {
            return (
              <Tooltip title={progress.error_message}>
                <Tag icon={<WarningOutlined />} color="error">Greška</Tag>
              </Tooltip>
            );
          }
        }
        return getSyncStatusTag(status);
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedVehicles,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedVehicles(selectedRowKeys as number[]);
    },
    getCheckboxProps: (record: VehicleWithSyncStatus) => ({
      disabled: syncing && syncProgress.has(record.id),
    }),
  };

  const tabItems = [
    {
      key: 'manual',
      label: (
        <span>
          <SyncOutlined />
          Ručna sinhronizacija
        </span>
      ),
      children: (
        <>
          <Card 
        title={
          <Space>
            <CloudServerOutlined />
            <span>Legacy GPS Sinhronizacija</span>
            {connectionStatus && (
              <Badge
                status={connectionStatus.connected ? 'success' : 'error'}
                text={connectionStatus.connected ? 'Povezano' : 'Nije povezano'}
              />
            )}
            <Divider type="vertical" />
            <Space size="small">
              <ThunderboltOutlined 
                style={{ 
                  color: workerPoolStatus.enabled ? '#52c41a' : '#d9d9d9' 
                }} 
              />
              <span style={{ fontSize: '14px', color: '#666' }}>Worker Pool:</span>
              <Switch
                size="small"
                checked={workerPoolStatus.enabled}
                loading={workerPoolLoading}
                onChange={toggleWorkerPool}
                checkedChildren="ON"
                unCheckedChildren="OFF"
              />
              {workerPoolStatus.enabled && (
                <Tag 
                  icon={<TeamOutlined />} 
                  color={workerPoolStatus.activeWorkers > 0 ? 'processing' : 'default'}
                >
                  {workerPoolStatus.activeWorkers}/{workerPoolStatus.maxWorkers}
                </Tag>
              )}
            </Space>
          </Space>
        }
        extra={
          <Space>
            <Button
              onClick={testLegacyConnection}
              icon={<DatabaseOutlined />}
            >
              Test konekcije
            </Button>
            <Button
              onClick={fetchVehicles}
              icon={<SyncOutlined />}
              loading={loading}
            >
              Osveži listu
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {connectionStatus && !connectionStatus.connected && (
            <Alert
              message="Problem sa konekcijom"
              description={connectionStatus.message}
              type="error"
              showIcon
            />
          )}
          
          {/* Worker Pool Status Cards */}
          {workerPoolStatus.enabled && workerPoolStatus.workers.length > 0 && (
            <Card size="small" title={
              <Space>
                <RocketOutlined />
                <span>Worker Pool Status</span>
              </Space>
            }>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="Aktivni Worker-i"
                    value={workerPoolStatus.activeWorkers}
                    suffix={`/ ${workerPoolStatus.maxWorkers}`}
                    prefix={<TeamOutlined />}
                  />
                </Col>
                <Col span={18}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {workerPoolStatus.workers.map((worker) => (
                      <div key={worker.workerId} style={{
                        padding: '8px 12px',
                        border: '1px solid #d9d9d9',
                        borderRadius: '6px',
                        backgroundColor: worker.status === 'idle' ? '#f6f6f6' : '#e6f7ff',
                        minWidth: '120px'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                          Worker {worker.workerId}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          {worker.garageNumber ? `${worker.garageNumber}` : 'Idle'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#999' }}>
                          {worker.currentStep || worker.status}
                        </div>
                        {worker.status !== 'idle' && (
                          <Progress 
                            percent={worker.progress} 
                            size="small" 
                            strokeWidth={3}
                            showInfo={false}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </Col>
              </Row>
            </Card>
          )}
          
          <Space size="large" wrap>
            <Input
              placeholder="Pretraži vozila (garažni broj, registracija...)"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              format="DD.MM.YYYY"
              disabled={syncing}
              presets={[
                { label: 'Poslednih 7 dana', value: [dayjs().subtract(7, 'days'), dayjs()] },
                { label: 'Poslednji mesec', value: [dayjs().subtract(1, 'month'), dayjs()] },
                { label: 'Poslednja 3 meseca', value: [dayjs().subtract(3, 'months'), dayjs()] },
              ]}
            />
            
            <Button
              onClick={() => {
                const allFilteredIds = filteredVehicles.map(v => v.id);
                setSelectedVehicles(allFilteredIds);
              }}
              disabled={syncing || filteredVehicles.length === 0}
            >
              Selektuj sve filtrirane ({filteredVehicles.length})
            </Button>
            
            <Tooltip title="Osvežavanje continuous aggregates odmah nakon sync-a može opteretiti server. Ako nije čekirano, aggregates će se automatski osvežiti u roku od 1 sata.">
              <Checkbox
                checked={refreshAggregates}
                onChange={(e) => setRefreshAggregates(e.target.checked)}
                disabled={syncing}
              >
                Odmah osveži izveštaje nakon sync-a
              </Checkbox>
            </Tooltip>
            
            <Button
              type="primary"
              icon={workerPoolStatus.enabled ? <ThunderboltOutlined /> : <SyncOutlined />}
              onClick={handleStartSync}
              disabled={selectedVehicles.length === 0 || syncing}
              loading={syncing}
              style={{
                background: workerPoolStatus.enabled ? '#52c41a' : undefined,
                borderColor: workerPoolStatus.enabled ? '#52c41a' : undefined,
              }}
            >
              {syncing 
                ? (workerPoolStatus.enabled ? `Worker Pool radi...` : 'Sinhronizuje se...')
                : `${workerPoolStatus.enabled ? 'Paralelno' : 'Sinhronizuj'} (${selectedVehicles.length})`
              }
            </Button>
            
            {syncing && (
              <Button
                danger
                onClick={handleStopSync}
              >
                Zaustavi
              </Button>
            )}
          </Space>
          
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredVehicles}
            loading={loading}
            rowSelection={rowSelection}
            scroll={{ x: 1200 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Ukupno ${total} vozila`,
            }}
            footer={() => (
              <div style={{ textAlign: 'right' }}>
                {searchText && (
                  <span style={{ marginRight: 16 }}>
                    Filtrirano: {filteredVehicles.length} od {vehicles.length} vozila
                  </span>
                )}
                <span>
                  Selektovano: {selectedVehicles.length} vozila
                </span>
              </div>
            )}
          />
        </Space>
      </Card>

          {/* Modal za prikaz progresa sinhronizacije */}
          <Modal
        title={
          <Space>
            <SyncOutlined spin />
            <span>Legacy Sinhronizacija u toku</span>
          </Space>
        }
        open={syncModal}
        onCancel={() => setSyncModal(false)}
        footer={[
          <Button 
            key="close" 
            onClick={() => setSyncModal(false)}
            disabled={syncing && overallProgress < 100}
          >
            {overallProgress >= 100 ? 'Zatvori' : 'Sakrij'}
          </Button>,
          syncing && overallProgress < 100 && (
            <Button 
              key="stop"
              danger
              onClick={async () => {
                await handleStopSync();
                setSyncModal(false);
              }}
            >
              Zaustavi sinhronizaciju
            </Button>
          )
        ]}
        width={700}
      >
        <div className="space-y-4">
          {/* Progress bar */}
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span>Ukupan progres sinhronizacije</span>
              <span className="font-medium">{overallProgress.toFixed(1)}%</span>
            </div>
            <Progress 
              percent={overallProgress} 
              status={overallProgress >= 100 ? 'success' : 'active'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </div>

          {/* Log poruke */}
          <div 
            className="border rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto"
            ref={(el) => {
              // Auto-scroll do dna kada se dodaju novi logovi
              if (el && syncLogs.length > 0) {
                el.scrollTop = el.scrollHeight;
              }
            }}
          >
            <div className="space-y-2 font-mono text-sm">
              {syncLogs.length === 0 ? (
                <div className="text-gray-500">Priprema sinhronizacije...</div>
              ) : (
                syncLogs.map((log, index) => {
                  // Proveri da li je ovo "živi" log koji se ažurira (sadrži Batch ili Dan info)
                  const isLiveLog = log.includes('[Batch') || log.includes('Dan ') || log.includes('Procesiranje');
                  
                  return (
                    <div 
                      key={index} 
                      className={`
                        ${log.includes('✅') ? 'text-green-600' : ''}
                        ${log.includes('❌') ? 'text-red-600' : ''}
                        ${log.includes('⚠️') ? 'text-yellow-600' : ''}
                        ${log.includes('⏳') ? 'text-blue-600 animate-pulse' : ''}
                        ${log.includes('🔄') || log.includes('📡') || log.includes('📊') ? 'text-gray-700' : ''}
                        ${log.includes('🚀') || log.includes('🚗') ? 'font-semibold' : ''}
                        ${isLiveLog ? 'bg-blue-50 px-2 py-1 rounded' : ''}
                      `}
                    >
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detaljan progres po vozilu */}
          {syncProgress.size > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Progres po vozilu:</div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {Array.from(syncProgress.entries()).map(([vehicleId, progress]) => {
                  const vehicle = vehicles.find(v => v.id === vehicleId);
                  return (
                    <div key={vehicleId} className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{vehicle?.garage_number || `ID: ${vehicleId}`}</span>
                        <div className="flex items-center gap-2">
                          {progress.status === 'completed' && <CheckCircleOutlined className="text-green-500" />}
                          {progress.status === 'error' && <CloseCircleOutlined className="text-red-500" />}
                          {progress.status === 'running' && <LoadingOutlined className="text-blue-500" />}
                          <Progress 
                            percent={progress.progress_percentage} 
                            size="small" 
                            style={{ width: 100 }}
                            status={
                              progress.status === 'completed' ? 'success' :
                              progress.status === 'error' ? 'exception' :
                              'active'
                            }
                          />
                          <span className="text-xs text-gray-500 ml-2">
                            {progress.processed_records.toLocaleString()}/{progress.total_records.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {progress.currentStep && progress.status === 'running' && (
                        <div className="text-xs text-blue-600 ml-2">
                          📍 {progress.currentStep}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
          </Modal>
        </>
      ),
    },
    {
      key: 'smart',
      label: (
        <span>
          <RocketOutlined />
          Smart Slow Sync
        </span>
      ),
      children: <SmartSlowSyncDashboard />,
    },
  ];

  return (
    <div className="p-6">
      <Tabs defaultActiveKey="manual" size="large" items={tabItems} />
    </div>
  );
};

export { LegacySyncPage };