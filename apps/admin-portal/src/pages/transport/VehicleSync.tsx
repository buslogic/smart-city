import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Progress, 
  Table, 
  Tag, 
  Space, 
  Alert, 
  Statistic, 
  Row, 
  Col,
  Modal,
  message,
  Descriptions,
  Badge,
  Tooltip,
  Select,
  InputNumber,
  Form,
} from 'antd';
import { 
  SyncOutlined, 
  StopOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { vehicleSyncService } from '../../services/vehicle-sync.service';
import type { SyncLog, SyncStatus } from '../../services/vehicle-sync.service';
import { usePermissions } from '../../hooks/usePermissions';

const { Option } = Select;

const VehicleSync: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentSync, setCurrentSync] = useState<SyncLog | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState<ReturnType<typeof setInterval> | null>(null);
  const [syncType, setSyncType] = useState<'full' | 'incremental'>('full');
  
  // Sync konfiguracija
  const [batchSize, setBatchSize] = useState(50);
  const [delay, setDelay] = useState(2000);
  const [showConfig, setShowConfig] = useState(false);
  
  const { hasPermission } = usePermissions();
  const canSync = hasPermission('vehicles:sync');

  // Učitaj status pri mount
  useEffect(() => {
    loadStatus();
    loadHistory();

    // Cleanup polling pri unmount
    return () => {
      if (polling) {
        clearInterval(polling);
      }
    };
  }, []);

  // Pokreni polling kad je sync aktivan
  useEffect(() => {
    if (isRunning && !polling) {
      const interval = setInterval(() => {
        loadStatus();
      }, 2000); // Update svake 2 sekunde
      setPolling(interval);
    } else if (!isRunning && polling) {
      clearInterval(polling);
      setPolling(null);
      loadHistory(); // Refresh istoriju nakon završetka
    }
  }, [isRunning]);

  const loadStatus = async () => {
    try {
      const status = await vehicleSyncService.getStatus();
      setIsRunning(status.isRunning);
      setCurrentSync(status.syncLog || null);
    } catch (error) {
      // Greška pri učitavanju statusa
    }
  };

  const loadHistory = async () => {
    try {
      const history = await vehicleSyncService.getHistory();
      setSyncHistory(history);
    } catch (error) {
      // Greška pri učitavanju istorije
    }
  };

  const handleStartSync = async () => {
    // Direktan poziv bez Modal.confirm zbog React 19 kompatibilnosti
    const confirmed = window.confirm(`Da li ste sigurni da želite da pokrenete ${syncType === 'full' ? 'punu' : 'inkrementalnu'} sinhronizaciju vozila?`);
    
    if (!confirmed) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await vehicleSyncService.startSync(syncType, {
        batchSize,
        delay
      });
      message.success(result.message);
      loadStatus();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri pokretanju sinhronizacije');
    } finally {
      setLoading(false);
    }
  };

  const handleStopSync = async () => {
    const confirmed = window.confirm('Da li ste sigurni da želite da zaustavite trenutnu sinhronizaciju?');
    
    if (!confirmed) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await vehicleSyncService.stopSync();
      message.success(result.message);
      loadStatus();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri zaustavljanju sinhronizacije');
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'default', icon: <LoadingOutlined />, text: 'Čeka' },
      in_progress: { color: 'processing', icon: <SyncOutlined spin />, text: 'U toku' },
      completed: { color: 'success', icon: <CheckCircleOutlined />, text: 'Završeno' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: 'Neuspešno' },
      cancelled: { color: 'warning', icon: <StopOutlined />, text: 'Otkazano' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const calculateProgress = () => {
    if (!currentSync) return 0;
    if (currentSync.totalRecords === 0) return 0;
    return Math.round((currentSync.processedRecords / currentSync.totalRecords) * 100);
  };

  const formatDuration = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const duration = endDate.getTime() - startDate.getTime();
    
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const historyColumns = [
    {
      title: 'Datum i vreme',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (date: string) => new Date(date).toLocaleString('sr-RS'),
      width: 180,
    },
    {
      title: 'Tip',
      dataIndex: 'syncType',
      key: 'syncType',
      render: (type: string) => (
        <Tag color={type === 'full' ? 'blue' : 'green'}>
          {type === 'full' ? 'Puna' : 'Inkrementalna'}
        </Tag>
      ),
      width: 120,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
      width: 120,
    },
    {
      title: 'Trajanje',
      key: 'duration',
      render: (_: any, record: SyncLog) => formatDuration(record.startedAt, record.completedAt),
      width: 100,
    },
    {
      title: 'Obrađeno',
      key: 'processed',
      render: (_: any, record: SyncLog) => `${record.processedRecords} / ${record.totalRecords}`,
      width: 120,
    },
    {
      title: 'Rezultat',
      key: 'result',
      render: (_: any, record: SyncLog) => (
        <Space size="small">
          <Tooltip title="Kreirano">
            <Badge count={record.createdRecords} style={{ backgroundColor: '#52c41a' }} />
          </Tooltip>
          <Tooltip title="Ažurirano">
            <Badge count={record.updatedRecords} style={{ backgroundColor: '#1890ff' }} />
          </Tooltip>
          <Tooltip title="Preskočeno">
            <Badge count={record.skippedRecords} style={{ backgroundColor: '#d9d9d9' }} />
          </Tooltip>
          {record.errorRecords > 0 && (
            <Tooltip title="Greške">
              <Badge count={record.errorRecords} />
            </Tooltip>
          )}
        </Space>
      ),
      width: 150,
    },
    {
      title: 'Korisnik',
      dataIndex: ['user', 'firstName'],
      key: 'user',
      render: (_: any, record: SyncLog) => 
        record.user ? `${record.user.firstName} ${record.user.lastName}` : '-',
      width: 150,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Sinhronizacija vozila</h1>
        <p className="text-gray-600 mt-1">
          Sinhronizacija podataka između legacy baze i Smart City sistema
        </p>
      </div>

      {/* Status kartica */}
      {currentSync && isRunning && (
        <Card className="mb-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Trenutna sinhronizacija</h3>
            <Progress 
              percent={calculateProgress()} 
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </div>

          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Ukupno vozila"
                value={currentSync.totalRecords}
                prefix={<InfoCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Obrađeno"
                value={currentSync.processedRecords}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Kreirano"
                value={currentSync.createdRecords}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Ažurirano"
                value={currentSync.updatedRecords}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
          </Row>

          {currentSync.errorRecords > 0 && (
            <Alert
              message={`Detektovano je ${currentSync.errorRecords} grešaka tokom sinhronizacije`}
              type="warning"
              showIcon
              className="mt-4"
            />
          )}
        </Card>
      )}

      {/* Podešavanja */}
      <Card 
        className="mb-6"
        title={
          <Space>
            <SettingOutlined />
            Podešavanja sinhronizacije
          </Space>
        }
        extra={
          <Button 
            type="link" 
            size="small"
            onClick={() => setShowConfig(!showConfig)}
          >
            {showConfig ? 'Sakrij' : 'Prikaži'} napredna podešavanja
          </Button>
        }
      >
        <Space size="large" wrap>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tip sinhronizacije
            </label>
            <Select
              value={syncType}
              onChange={setSyncType}
              disabled={isRunning}
              style={{ width: 150 }}
            >
              <Option value="full">Puna sinhronizacija</Option>
              <Option value="incremental">Inkrementalna</Option>
            </Select>
          </div>

          {showConfig && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch veličina
                </label>
                <InputNumber
                  min={1}
                  max={100}
                  value={batchSize}
                  onChange={(value) => setBatchSize(value || 50)}
                  disabled={isRunning}
                  style={{ width: 100 }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Broj vozila po grupi
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pauza (ms)
                </label>
                <InputNumber
                  min={500}
                  max={10000}
                  step={500}
                  value={delay}
                  onChange={(value) => setDelay(value || 2000)}
                  disabled={isRunning}
                  style={{ width: 100 }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Pauza između grupa
                </div>
              </div>
            </>
          )}
        </Space>
      </Card>

      {/* Kontrole */}
      <Card className="mb-6">
        <Space size="middle">
          
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={handleStartSync}
            loading={loading}
            disabled={isRunning || !canSync}
          >
            Pokreni sinhronizaciju
          </Button>

          <Button
            danger
            icon={<StopOutlined />}
            onClick={handleStopSync}
            loading={loading}
            disabled={!isRunning}
          >
            Zaustavi
          </Button>
        </Space>

        {!isRunning && syncHistory.length > 0 && (
          <div className="mt-4">
            <Alert
              message={`Poslednja sinhronizacija: ${new Date(syncHistory[0].startedAt).toLocaleString('sr-RS')}`}
              type="info"
              showIcon
              icon={<HistoryOutlined />}
            />
          </div>
        )}
      </Card>

      {/* Istorija sinhronizacija */}
      <Card title="Istorija sinhronizacija">
        <Table
          columns={historyColumns}
          dataSource={syncHistory}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
          }}
          locale={{
            emptyText: 'Nema prethodnih sinhronizacija',
          }}
        />
      </Card>
    </div>
  );
};

export default VehicleSync;