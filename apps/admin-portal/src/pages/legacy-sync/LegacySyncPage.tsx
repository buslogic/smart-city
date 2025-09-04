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
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { api } from '../../services/api';

const { RangePicker } = DatePicker;

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
}

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

  // Učitaj vozila pri mount-u
  useEffect(() => {
    fetchVehicles();
    testLegacyConnection();
  }, []);

  // Polling za progress kada je sync aktivan
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (syncing && currentJobId) {
      intervalId = setInterval(() => {
        fetchSyncProgress();
      }, 2000); // Svake 2 sekunde
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
      
      // Ažuriraj log sa trenutnim statusom
      setSyncLogs(prev => {
        const newLogs = [...prev];
        const lastLog = newLogs[newLogs.length - 1];
        const progressMsg = `⏳ Procesiranje: ${totalProcessed}/${totalRecords} GPS tačaka (${Math.round(calculatedProgress)}%) - ${completedVehicles}/${response.data.length} vozila završeno`;
        
        // Ažuriraj poslednji log ako je progress update
        if (lastLog && lastLog.includes('⏳ Procesiranje:')) {
          newLogs[newLogs.length - 1] = progressMsg;
        } else {
          newLogs.push(progressMsg);
        }
        
        if (errorVehicles > 0) {
          const errorMsg = `⚠️ Greške na ${errorVehicles} vozila`;
          if (!newLogs.some(log => log.includes(errorMsg))) {
            newLogs.push(errorMsg);
          }
        }
        
        return newLogs;
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
              <Tooltip title={`Obrađeno: ${progress.processed_records} / ${progress.total_records}`}>
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

  return (
    <div className="p-6">
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
            
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={handleStartSync}
              disabled={selectedVehicles.length === 0 || syncing}
              loading={syncing}
            >
              {syncing ? 'Sinhronizuje se...' : `Sinhronizuj (${selectedVehicles.length})`}
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
          <div className="border rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
            <div className="space-y-2 font-mono text-sm">
              {syncLogs.length === 0 ? (
                <div className="text-gray-500">Priprema sinhronizacije...</div>
              ) : (
                syncLogs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`
                      ${log.includes('✅') ? 'text-green-600' : ''}
                      ${log.includes('❌') ? 'text-red-600' : ''}
                      ${log.includes('⚠️') ? 'text-yellow-600' : ''}
                      ${log.includes('⏳') ? 'text-blue-600' : ''}
                      ${log.includes('🔄') || log.includes('📡') || log.includes('📊') ? 'text-gray-700' : ''}
                      ${log.includes('🚀') || log.includes('🚗') ? 'font-semibold' : ''}
                    `}
                  >
                    {log}
                  </div>
                ))
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
                    <div key={vehicleId} className="flex items-center justify-between text-sm">
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
                        <span className="text-xs text-gray-500">
                          {progress.processed_records}/{progress.total_records}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export { LegacySyncPage };