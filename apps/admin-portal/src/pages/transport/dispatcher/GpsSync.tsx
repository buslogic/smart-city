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
  Select,
  InputNumber,
  DatePicker,
  Form,
  Tooltip,
  Badge,
  Divider,
  Radio,
} from 'antd';
import { 
  SyncOutlined, 
  StopOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  SettingOutlined,
  CarOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { gpsSyncService } from '../../../services/gps-sync.service';
import { vehiclesService } from '../../../services/vehicles.service';
import type { GpsSyncLog, GpsSyncStatus } from '../../../services/gps-sync.service';
import { usePermissions } from '../../../hooks/usePermissions';
import { VehicleMapper } from '../../../utils/vehicle-mapper';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const GpsSync: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentSync, setCurrentSync] = useState<GpsSyncLog | null>(null);
  const [syncHistory, setSyncHistory] = useState<GpsSyncLog[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState<ReturnType<typeof setInterval> | null>(null);
  
  // Sync parametri - sada koristimo vehicle ID umesto garage number
  const [selectionMode, setSelectionMode] = useState<'single' | 'multiple' | 'all'>('single');
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null); // vehicle ID
  const [selectedVehicles, setSelectedVehicles] = useState<number[]>([]); // vehicle IDs
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('day'),
    dayjs().endOf('day')
  ]);
  const [batchSize, setBatchSize] = useState(1000);
  const [delay, setDelay] = useState(3000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const { hasPermission } = usePermissions();
  const canSync = hasPermission('dispatcher:sync_gps');

  // Učitaj podatke pri mount
  useEffect(() => {
    loadVehicles();
    loadStatus();
    loadHistory();

    return () => {
      if (polling) {
        clearInterval(polling);
      }
    };
  }, []);

  // Pokreni polling kad je sync aktivan
  useEffect(() => {
    if (isRunning && !polling) {
      const interval = setInterval(async () => {
        try {
          const status = await gpsSyncService.getStatus();
          if (status.syncLog) {
            // Direktno ažuriraj currentSync da bi se prikazao progres
            setCurrentSync(status.syncLog);
            setIsRunning(status.isRunning);
          } else {
            setIsRunning(false);
            setCurrentSync(null);
          }
        } catch (error: any) {
          if (error.response?.status === 401) {
            window.location.reload();
          }
        }
      }, 3000); // Vraćeno na 3 sekunde za bolji prikaz progresa
      setPolling(interval);
    } else if (!isRunning && polling) {
      clearInterval(polling);
      setPolling(null);
      loadHistory();
    }
  }, [isRunning]);

  const loadVehicles = async () => {
    try {
      const data = await vehiclesService.getAll(1, 2000);
      setVehicles(data.data);
    } catch (error) {
      console.error('Greška pri učitavanju vozila:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const status = await gpsSyncService.getStatus();
      setIsRunning(status.isRunning);
      setCurrentSync(status.syncLog || null);
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Token je istekao, osveži stranicu
        window.location.reload();
      } else {
        console.error('Greška pri učitavanju statusa:', error);
      }
    }
  };

  const loadHistory = async () => {
    try {
      const history = await gpsSyncService.getHistory();
      setSyncHistory(history);
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Token je istekao, osveži stranicu
        window.location.reload();
      } else {
        console.error('Greška pri učitavanju istorije:', error);
      }
    }
  };

  const handleStartSync = async () => {
    // Proveri da li su vozila izabrana
    if (selectionMode === 'single' && !selectedVehicle) {
      message.warning('Molimo izaberite vozilo za sinhronizaciju');
      return;
    }
    if (selectionMode === 'multiple' && selectedVehicles.length === 0) {
      message.warning('Molimo izaberite vozila za sinhronizaciju');
      return;
    }

    // Pripremi listu vozila - sada šaljemo vehicle IDs
    let vehicleList: number[] | null = null;
    let syncDescription = '';
    
    if (selectionMode === 'all') {
      vehicleList = null;
      syncDescription = 'sva vozila';
    } else if (selectionMode === 'single' && selectedVehicle) {
      vehicleList = [selectedVehicle];
      // Dohvati garage number za prikaz
      const garageNo = await VehicleMapper.idToGarageNumber(selectedVehicle);
      syncDescription = `vozilo ${garageNo}`;
    } else if (selectionMode === 'multiple') {
      vehicleList = selectedVehicles;
      // Dohvati garage numbers za prikaz
      const garageNumbers = await VehicleMapper.mapIdsToGarageNumbers(selectedVehicles);
      const displayNames = selectedVehicles.slice(0, 3).map(id => garageNumbers.get(id) || `ID:${id}`);
      syncDescription = `${selectedVehicles.length} vozila (${displayNames.join(', ')}${selectedVehicles.length > 3 ? '...' : ''})`;
    }

    const confirmed = window.confirm(
      `Da li ste sigurni da želite da pokrenete GPS sinhronizaciju za ${syncDescription}?\n\nPeriod: ${dateRange[0].format('DD.MM.YYYY')} - ${dateRange[1].format('DD.MM.YYYY')}`
    );
    
    if (!confirmed) {
      return;
    }
    
    setLoading(true);
    try {
      // Formiraj datume sa početkom i krajem dana
      const startDate = dateRange[0].startOf('day').toISOString();
      const endDate = dateRange[1].endOf('day').toISOString();
      
      const params = {
        vehicleIds: vehicleList,
        startDate,
        endDate,
        batchSize,
        delay,
      };
      
      // Loguj parametre koji se šalju
      console.log('🚀 GPS Sync parametri:', {
        vehicleIds: params.vehicleIds,
        startDate: params.startDate,
        endDate: params.endDate,
        batchSize: params.batchSize,
        delay: params.delay,
        startDateLocal: dateRange[0].format('YYYY-MM-DD HH:mm:ss'),
        endDateLocal: dateRange[1].format('YYYY-MM-DD HH:mm:ss'),
      });
      
      const result = await gpsSyncService.startSync(params);
      message.success(result.message);
      loadStatus();
    } catch (error: any) {
      // Proveri da li je greška zbog nemapiranja
      if (error.response?.status === 404 && error.response?.data?.message?.includes('mapiranje')) {
        // Prikaži modal sa detaljnim uputstvima
        Modal.error({
          title: 'Mapiranje nije konfigurisano',
          content: (
            <div>
              <p>{error.response.data.message}</p>
              <ol style={{ marginTop: '16px' }}>
                <li>Idite na <strong>Podešavanja → Legacy baze</strong></li>
                <li>Pronađite vašu legacy bazu u listi</li>
                <li>Kliknite na <strong>Mapiranje tabela</strong></li>
                <li>Dodajte mapiranje za <strong>bus_vehicles</strong> tabelu</li>
                <li>Aktivirajte sinhronizaciju za tu tabelu</li>
              </ol>
            </div>
          ),
          okText: 'Razumem',
          width: 520,
        });
      } else {
        message.error(error.response?.data?.message || 'Greška pri pokretanju sinhronizacije');
      }
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
      const result = await gpsSyncService.stopSync();
      message.success(result.message);
      loadStatus();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri zaustavljanju sinhronizacije');
    } finally {
      setLoading(false);
    }
  };

  const handleStopSyncById = async (syncId: number) => {
    const confirmed = window.confirm('Da li ste sigurni da želite da zaustavite ovu sinhronizaciju?');
    
    if (!confirmed) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await gpsSyncService.stopSyncById(syncId);
      message.success(result.message || 'Sinhronizacija je zaustavljena');
      loadStatus();
      loadHistory();
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
    if (currentSync.totalPoints === 0) return 0;
    return Math.round((currentSync.processedPoints / currentSync.totalPoints) * 100);
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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('sr-RS').format(num);
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
      title: 'Vozilo',
      dataIndex: 'vehicleGarageNo',
      key: 'vehicle',
      render: (garageNo: string, record: any) => (
        <Space>
          <CarOutlined />
          {garageNo || 'Sva vozila'}
        </Space>
      ),
      width: 150,
    },
    {
      title: 'Period',
      key: 'period',
      render: (_: any, record: GpsSyncLog) => (
        <Space direction="vertical" size="small">
          <span>{new Date(record.syncStartDate).toLocaleDateString('sr-RS')}</span>
          <span>{new Date(record.syncEndDate).toLocaleDateString('sr-RS')}</span>
        </Space>
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
      render: (_: any, record: GpsSyncLog) => formatDuration(record.startedAt, record.completedAt),
      width: 100,
    },
    {
      title: 'GPS tačke',
      key: 'points',
      render: (_: any, record: GpsSyncLog) => (
        <Space direction="vertical" size="small">
          <span>{formatNumber(record.processedPoints)} / {formatNumber(record.totalPoints)}</span>
          {record.totalDistance && (
            <span className="text-xs text-gray-500">
              {record.totalDistance.toFixed(2)} km
            </span>
          )}
        </Space>
      ),
      width: 150,
    },
    {
      title: 'Rezultat',
      key: 'result',
      render: (_: any, record: GpsSyncLog) => (
        <Space size="small">
          <Tooltip title="Novo ubačeno">
            <Badge count={record.insertedPoints} style={{ backgroundColor: '#52c41a' }} />
          </Tooltip>
          <Tooltip title="Ažurirano">
            <Badge count={record.updatedPoints} style={{ backgroundColor: '#1890ff' }} />
          </Tooltip>
          <Tooltip title="Preskočeno">
            <Badge count={record.skippedPoints} style={{ backgroundColor: '#d9d9d9' }} />
          </Tooltip>
          {record.errorPoints > 0 && (
            <Tooltip title="Greške">
              <Badge count={record.errorPoints} />
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
      render: (_: any, record: GpsSyncLog) => 
        record.user ? `${record.user.firstName} ${record.user.lastName}` : '-',
      width: 150,
    },
    {
      title: 'Akcije',
      key: 'actions',
      fixed: 'right' as const,
      width: 100,
      render: (_: any, record: GpsSyncLog) => {
        // Prikaži dugme za zaustavljanje samo za aktivne sinhronizacije
        if (record.status === 'in_progress' || record.status === 'pending') {
          return (
            <Button
              danger
              size="small"
              icon={<StopOutlined />}
              onClick={() => handleStopSyncById(record.id)}
              loading={loading}
              title="Zaustavi ovu sinhronizaciju"
            >
              Stop
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">GPS Sinhronizacija</h1>
        <p className="text-gray-600 mt-1">
          Sinhronizacija GPS podataka iz legacy baze u TimescaleDB
        </p>
      </div>

      {/* Status kartica */}
      {currentSync && isRunning && (
        <Card className="mb-6" style={{ borderTop: '3px solid #1890ff' }}>
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">
              <SyncOutlined spin className="mr-2" />
              Sinhronizacija u toku - {currentSync.vehicleGarageNo || 'Sva vozila'}
            </h3>
            <Progress 
              percent={calculateProgress()} 
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              format={(percent) => (
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {percent?.toFixed(1)}%
                </span>
              )}
            />
            <div className="mt-2 text-sm text-gray-600">
              {formatNumber(currentSync.processedPoints)} od {formatNumber(currentSync.totalPoints)} tačaka obrađeno
            </div>
          </div>

          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Ukupno GPS tačaka"
                value={currentSync.totalPoints}
                formatter={(value) => formatNumber(value as number)}
                prefix={<DatabaseOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Obrađeno"
                value={currentSync.processedPoints}
                formatter={(value) => formatNumber(value as number)}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
                suffix={
                  <span className="text-xs text-gray-500">
                    ({calculateProgress().toFixed(0)}%)
                  </span>
                }
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Brzina obrade"
                value={`${Math.round(currentSync.processedPoints / 
                  ((new Date().getTime() - new Date(currentSync.startedAt).getTime()) / 1000) || 1)} t/s`}
                valueStyle={{ color: '#1890ff' }}
                prefix={<FieldTimeOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Preostalo vreme"
                value={(() => {
                  const speed = currentSync.processedPoints / 
                    ((new Date().getTime() - new Date(currentSync.startedAt).getTime()) / 1000);
                  const remaining = currentSync.totalPoints - currentSync.processedPoints;
                  const seconds = remaining / speed;
                  if (seconds < 60) return `${Math.round(seconds)}s`;
                  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
                  return `${Math.round(seconds / 3600)}h`;
                })()}
                valueStyle={{ color: '#fa8c16' }}
                prefix={<ClockCircleOutlined />}
              />
            </Col>
          </Row>
          
          <Row gutter={16} className="mt-4">
            <Col span={6}>
              <Statistic
                title="Novo ubačeno"
                value={currentSync.insertedPoints}
                formatter={(value) => formatNumber(value as number)}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Ažurirano"
                value={currentSync.updatedPoints}
                formatter={(value) => formatNumber(value as number)}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Greške"
                value={currentSync.errorPoints}
                formatter={(value) => formatNumber(value as number)}
                valueStyle={{ color: currentSync.errorPoints > 0 ? '#ff4d4f' : '#d9d9d9' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Kilometraža"
                value={currentSync.totalDistance?.toFixed(2) || '0'}
                suffix="km"
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
          </Row>

          {currentSync.errorPoints > 0 && (
            <Alert
              message={`Detektovano je ${currentSync.errorPoints} grešaka tokom sinhronizacije`}
              type="warning"
              showIcon
              className="mt-4"
            />
          )}
        </Card>
      )}

      {/* Parametri sinhronizacije */}
      <Card 
        className="mb-6"
        title={
          <Space>
            <SettingOutlined />
            Parametri sinhronizacije
          </Space>
        }
        extra={
          <Button 
            type="link" 
            size="small"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Sakrij' : 'Prikaži'} napredna podešavanja
          </Button>
        }
      >
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Način selekcije vozila">
                <Radio.Group 
                  value={selectionMode} 
                  onChange={(e) => {
                    setSelectionMode(e.target.value);
                    setSelectedVehicles([]);
                    setSelectedVehicle(null);
                  }}
                  disabled={isRunning}
                >
                  <Radio.Button value="single">Jedno vozilo</Radio.Button>
                  <Radio.Button value="multiple">Grupa vozila</Radio.Button>
                  <Radio.Button value="all">Sva vozila</Radio.Button>
                </Radio.Group>
              </Form.Item>
              
              {selectionMode === 'single' && (
                <Form.Item label="Izaberite vozilo">
                  <Select
                    value={selectedVehicle}
                    onChange={setSelectedVehicle}
                    disabled={isRunning}
                    style={{ width: '100%' }}
                    showSearch
                    placeholder="Izaberite vozilo"
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={vehicles.map(v => ({
                      value: v.id, // koristimo vehicle ID kao value
                      label: `${v.garageNumber} - ${v.registrationNumber || v.plateNumber || 'N/A'}`,
                    }))}
                  />
                </Form.Item>
              )}
              
              {selectionMode === 'multiple' && (
                <Form.Item label="Izaberite vozila">
                  <Select
                    mode="multiple"
                    value={selectedVehicles}
                    onChange={setSelectedVehicles}
                    disabled={isRunning}
                    style={{ width: '100%' }}
                    placeholder="Izaberite jedno ili više vozila"
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={vehicles.map(v => ({
                      value: v.id, // koristimo vehicle ID kao value
                      label: `${v.garageNumber} - ${v.registrationNumber || v.plateNumber || 'N/A'}`,
                    }))}
                  />
                  {selectedVehicles.length > 0 && (
                    <div className="mt-2 text-sm text-gray-500">
                      Izabrano: {selectedVehicles.length} vozila
                    </div>
                  )}
                </Form.Item>
              )}
              
              {selectionMode === 'all' && (
                <Alert
                  message={`Biće sinhronizovano svih ${vehicles.length} vozila`}
                  type="info"
                  showIcon
                  className="mt-2"
                />
              )}
            </Col>
            
            <Col span={10}>
              <Form.Item label="Vremenski period">
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
                  disabled={isRunning}
                  format="DD.MM.YYYY"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item label="Broj dana">
                <div className="text-lg font-medium text-blue-600">
                  {dateRange[1].diff(dateRange[0], 'day') + 1} {dateRange[1].diff(dateRange[0], 'day') + 1 === 1 ? 'dan' : 'dana'}
                </div>
              </Form.Item>
            </Col>
          </Row>

          {showAdvanced && (
            <>
              <Divider />
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item 
                    label="Veličina batch-a"
                    tooltip="Broj GPS tačaka koje se obrađuju odjednom"
                  >
                    <InputNumber
                      min={100}
                      max={5000}
                      step={100}
                      value={batchSize}
                      onChange={(value) => setBatchSize(value || 1000)}
                      disabled={isRunning}
                      style={{ width: '100%' }}
                      addonAfter="tačaka"
                    />
                  </Form.Item>
                </Col>
                
                <Col span={8}>
                  <Form.Item 
                    label="Pauza između batch-ova"
                    tooltip="Vreme čekanja između obrade grupa podataka"
                  >
                    <InputNumber
                      min={1000}
                      max={10000}
                      step={500}
                      value={delay}
                      onChange={(value) => setDelay(value || 3000)}
                      disabled={isRunning}
                      style={{ width: '100%' }}
                      addonAfter="ms"
                    />
                  </Form.Item>
                </Col>

                <Col span={8}>
                  <Form.Item label="Procenjeno vreme">
                    <div className="text-lg">
                      {selectionMode === 'all' 
                        ? `~${Math.round(vehicles.length * dateRange[1].diff(dateRange[0], 'day') * 2)} min`
                        : selectionMode === 'multiple'
                        ? `~${Math.round(selectedVehicles.length * dateRange[1].diff(dateRange[0], 'day') * 2)} min`
                        : `~${Math.round(dateRange[1].diff(dateRange[0], 'day') * 2)} min`
                      }
                    </div>
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </Form>
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
            size="large"
          >
            Pokreni sinhronizaciju
          </Button>

          <Button
            danger
            icon={<StopOutlined />}
            onClick={handleStopSync}
            loading={loading}
            disabled={!isRunning && !currentSync}
            size="large"
            title="Zaustavi sve aktivne sinhronizacije"
          >
            Zaustavi sve
          </Button>

          <Button
            icon={<HistoryOutlined />}
            onClick={loadHistory}
            disabled={isRunning}
          >
            Osveži istoriju
          </Button>
        </Space>

        {!isRunning && syncHistory.length > 0 && (
          <div className="mt-4">
            <Alert
              message={`Poslednja sinhronizacija: ${new Date(syncHistory[0].startedAt).toLocaleString('sr-RS')}`}
              type="info"
              showIcon
              icon={<HistoryOutlined />}
              description={
                <Space>
                  <span>Vozilo: {syncHistory[0].vehicleGarageNo || 'Sva vozila'}</span>
                  <span>•</span>
                  <span>Status: {getStatusTag(syncHistory[0].status)}</span>
                  <span>•</span>
                  <span>GPS tačke: {formatNumber(syncHistory[0].processedPoints)}</span>
                </Space>
              }
            />
          </div>
        )}
      </Card>

      {/* Istorija sinhronizacija */}
      <Card 
        title={
          <Space>
            <HistoryOutlined />
            Istorija GPS sinhronizacija
          </Space>
        }
        extra={
          <Button 
            size="small" 
            onClick={async () => {
              try {
                await gpsSyncService.cleanupStale();
                message.success('Stare sinhronizacije su očišćene');
                loadHistory();
                loadStatus();
              } catch (error) {
                message.error('Greška pri čišćenju starih sinhronizacija');
              }
            }}
          >
            Očisti nezavršene
          </Button>
        }
      >
        <Table
          columns={historyColumns}
          dataSource={syncHistory}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
          }}
          locale={{
            emptyText: 'Nema prethodnih GPS sinhronizacija',
          }}
        />
      </Card>
    </div>
  );
};

export default GpsSync;