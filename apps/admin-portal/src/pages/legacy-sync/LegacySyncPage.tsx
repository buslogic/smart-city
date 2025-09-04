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
      
      response.data.forEach((progress: SyncProgress) => {
        progressMap.set(progress.vehicle_id, progress);
      });
      
      setSyncProgress(progressMap);
      
      // Proveri da li su svi završeni
      const allCompleted = response.data.every(
        (p: SyncProgress) => p.status === 'completed' || p.status === 'error'
      );
      
      if (allCompleted && response.data.length > 0) {
        setSyncing(false);
        setCurrentJobId(null);
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
    
    Modal.confirm({
      title: 'Potvrda sinhronizacije',
      content: (
        <div>
          <p>Da li ste sigurni da želite da pokrenete sinhronizaciju za:</p>
          <ul>
            <li>{selectedVehicles.length} vozila</li>
            <li>Period: {dateRange[0].format('DD.MM.YYYY')} - {dateRange[1].format('DD.MM.YYYY')}</li>
          </ul>
          <Alert
            message="Napomena"
            description="Proces može potrajati nekoliko minuta u zavisnosti od količine podataka."
            type="info"
            showIcon
          />
        </div>
      ),
      onOk: async () => {
        setSyncing(true);
        try {
          const response = await api.post('/api/legacy-sync/start', {
            vehicle_ids: selectedVehicles,
            sync_from: dateRange[0].toISOString(),
            sync_to: dateRange[1].toISOString(),
          });
          
          setCurrentJobId(response.data.job_id);
          message.success(response.data.message);
        } catch (error) {
          message.error('Greška pri pokretanju sinhronizacije');
          setSyncing(false);
        }
      },
    });
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
    </div>
  );
};

export { LegacySyncPage };