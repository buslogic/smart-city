import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Button, 
  Table, 
  DatePicker, 
  Alert, 
  Checkbox, 
  Radio, 
  Space, 
  Badge, 
  message, 
  Modal,
  Progress,
  Tabs,
  Tag,
  Tooltip,
  Spin,
  Empty,
  Statistic,
  Row,
  Col,
  Divider,
  Input
} from 'antd';
import { 
  RefreshCcw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  History,
  Play,
  Pause,
  X,
  TrendingUp,
  Activity,
  Search
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { 
  drivingRecreationService,
  type VehicleWithStats,
  type RecreationStatus,
  type RecreationHistory,
  type VehicleProgress
} from '../../../services/drivingRecreation.service';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const DataRecreation: React.FC = () => {
  // State for main recreation
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [strategy, setStrategy] = useState<'daily' | 'bulk'>('daily');
  const [loading, setLoading] = useState(false);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleWithStats[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loadStats, setLoadStats] = useState(false); // Checkbox za GPS statistiku
  const [loadEventsOnly, setLoadEventsOnly] = useState(false); // Checkbox za samo događaje
  const [pageSize, setPageSize] = useState(20); // Pagination page size
  const [currentPage, setCurrentPage] = useState(1); // Current page number

  // State for progress modal
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [currentRecreationId, setCurrentRecreationId] = useState<number | null>(null);
  const [recreationStatus, setRecreationStatus] = useState<RecreationStatus | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  // State for history
  const [historyData, setHistoryData] = useState<RecreationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);

  // Load vehicles when date range or stats options change
  useEffect(() => {
    if (dateRange) {
      loadVehicles();
    }
  }, [dateRange, loadStats, loadEventsOnly]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const loadVehicles = async () => {
    if (!dateRange) return;

    setVehiclesLoading(true);
    try {
      const vehicles = await drivingRecreationService.getVehiclesWithStats(
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD'),
        loadStats,
        loadEventsOnly
      );
      setVehicleData(vehicles);
    } catch (error) {
      message.error('Greška pri učitavanju vozila');
      console.error(error);
    } finally {
      setVehiclesLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await drivingRecreationService.getRecreationHistory(
        undefined,
        historyPage,
        10
      );
      setHistoryData(response.data);
      setHistoryTotal(response.total);
    } catch (error) {
      message.error('Greška pri učitavanju istorije');
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleStartRecreation = async () => {
    console.log('handleStartRecreation called');
    console.log('selectedRowKeys:', selectedRowKeys);
    console.log('dateRange:', dateRange);
    
    if (selectedRowKeys.length === 0) {
      message.warning('Molimo selektujte bar jedno vozilo');
      return;
    }
    if (!dateRange) {
      message.warning('Molimo odaberite vremenski period');
      return;
    }

    console.log('About to show modal');
    // Show confirmation modal
    setConfirmModalVisible(true);
  };

  const handleConfirmRecreation = async () => {
    console.log('Modal onOk called');
    setConfirmModalVisible(false);
    setLoading(true);
    try {
      console.log('Starting recreation with params:', {
        vehicleIds: selectedRowKeys,
        startDate: dateRange?.[0].format('YYYY-MM-DD'),
        endDate: dateRange?.[1].format('YYYY-MM-DD'),
        clearExisting,
        strategy,
      });
      
      if (!dateRange) return;
      
      const result = await drivingRecreationService.startRecreation({
        vehicleIds: selectedRowKeys as number[],
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        clearExisting,
        strategy,
      });
      
      console.log('Recreation started, result:', result);
      
      if (!result || !result.id) {
        throw new Error('Invalid response from server');
      }
      
      message.success(result.message);
      setCurrentRecreationId(result.id);
      console.log('Set currentRecreationId to:', result.id);
      setProgressModalVisible(true);
      
      // Start polling for status
      startStatusPolling(result.id);
      
      // Clear selection
      setSelectedRowKeys([]);
    } catch (error) {
      message.error('Greška pri pokretanju rekreacije');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const startStatusPolling = (recreationId: number) => {
    // Initial fetch
    fetchRecreationStatus(recreationId);
    
    // Set up polling
    const interval = setInterval(() => {
      fetchRecreationStatus(recreationId);
    }, 2000);
    
    setPollingInterval(interval);
  };

  const fetchRecreationStatus = async (recreationId: number) => {
    // Early return if no recreation is in progress
    if (!recreationId) {
      console.log('Skipping status fetch - no recreation ID');
      return;
    }
    
    console.log('Fetching status for recreation:', recreationId, 'current:', currentRecreationId);
    
    try {
      const status = await drivingRecreationService.getRecreationStatus(recreationId);
      setRecreationStatus(status);
      
      // Stop polling if completed
      if (['completed', 'failed', 'cancelled'].includes(status.status)) {
        console.log('Recreation finished, cleaning up');
        
        // FIRST: Clear the interval to stop polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        // SECOND: Clear the recreation ID to prevent further checks
        setCurrentRecreationId(null);
        
        // Show result message
        if (status.status === 'completed') {
          message.success(`Rekreacija završena! Detektovano ${status.totalEventsDetected} novih događaja.`);
        } else if (status.status === 'failed') {
          message.error('Rekreacija je neuspešna.');
        }
        
        // Reload vehicles to show updated stats ONLY ONCE
        // Use setTimeout to ensure this runs after state updates
        setTimeout(() => {
          loadVehicles();
        }, 500);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
      // If there's an error and we have a polling interval, stop it
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  };

  const handleStopRecreation = async () => {
    if (!currentRecreationId) return;
    
    Modal.confirm({
      title: 'Zaustavi rekreaciju?',
      content: 'Da li ste sigurni da želite da zaustavite rekreaciju u toku?',
      okText: 'Da, zaustavi',
      cancelText: 'Ne',
      okType: 'danger',
      onOk: async () => {
        try {
          await drivingRecreationService.stopRecreation(currentRecreationId);
          message.warning('Rekreacija je zaustavljena');
          
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          
          setProgressModalVisible(false);
        } catch (error) {
          message.error('Greška pri zaustavljanju rekreacije');
          console.error(error);
        }
      },
    });
  };

  const handleSelectAll = () => {
    const filteredData = getFilteredVehicles();
    if (selectedRowKeys.length === filteredData.length) {
      setSelectedRowKeys([]);
    } else {
      setSelectedRowKeys(filteredData.map(v => v.id));
    }
  };

  const handleSelectAllOnPage = () => {
    const filteredData = getFilteredVehicles();
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const vehiclesOnPage = filteredData.slice(startIndex, endIndex);
    const pageVehicleIds = vehiclesOnPage.map(v => v.id);

    // Check if all vehicles on current page are selected
    const allPageSelected = pageVehicleIds.every(id => selectedRowKeys.includes(id as React.Key));

    if (allPageSelected) {
      // Deselect all from current page
      setSelectedRowKeys(selectedRowKeys.filter(id => !pageVehicleIds.includes(id as number)));
    } else {
      // Select all from current page (merge with existing selection)
      const newSelection = [...new Set([...selectedRowKeys, ...pageVehicleIds])];
      setSelectedRowKeys(newSelection);
    }
  };

  // Filter vehicles based on search text
  const getFilteredVehicles = () => {
    if (!searchText) return vehicleData;
    
    const searchLower = searchText.toLowerCase();
    return vehicleData.filter(vehicle => 
      vehicle.garageNo.toLowerCase().includes(searchLower) ||
      vehicle.registration.toLowerCase().includes(searchLower)
    );
  };

  const presetRanges = {
    'Danas': [dayjs().startOf('day'), dayjs().endOf('day')],
    'Juče': [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')],
    'Poslednih 7 dana': [dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')],
    'Poslednji mesec': [dayjs().subtract(1, 'month').startOf('day'), dayjs().endOf('day')],
    'Poslednja 3 meseca': [dayjs().subtract(3, 'month').startOf('day'), dayjs().endOf('day')],
  };

  // Table columns for vehicles
  const vehicleColumns: ColumnsType<VehicleWithStats> = [
    {
      title: 'Garažni broj',
      dataIndex: 'garageNo',
      key: 'garageNo',
      sorter: (a, b) => a.garageNo.localeCompare(b.garageNo),
    },
    {
      title: 'Registracija',
      dataIndex: 'registration',
      key: 'registration',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge 
          status={status === 'active' ? 'success' : 'default'} 
          text={status === 'active' ? 'Aktivan' : 'Neaktivan'} 
        />
      ),
    },
    {
      title: 'GPS tačke',
      dataIndex: 'gpsPoints',
      key: 'gpsPoints',
      align: 'right',
      render: (points: number) => points.toLocaleString('sr-RS'),
      sorter: (a, b) => a.gpsPoints - b.gpsPoints,
    },
    {
      title: 'Postojeći događaji',
      dataIndex: 'existingEvents',
      key: 'existingEvents',
      align: 'right',
      sorter: (a, b) => a.existingEvents - b.existingEvents,
    },
  ];

  // Table columns for history
  const historyColumns: ColumnsType<RecreationHistory> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Korisnik',
      dataIndex: 'userEmail',
      key: 'userEmail',
    },
    {
      title: 'Period',
      key: 'period',
      render: (_, record) => (
        <span>
          {dayjs(record.startDate).format('DD.MM.YYYY')} - {dayjs(record.endDate).format('DD.MM.YYYY')}
        </span>
      ),
    },
    {
      title: 'Vozila',
      dataIndex: 'totalVehicles',
      key: 'totalVehicles',
      align: 'center',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'default',
          processing: 'processing',
          completed: 'success',
          failed: 'error',
          cancelled: 'warning',
        };
        return <Tag color={colorMap[status] || 'default'}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Detektovani događaji',
      dataIndex: 'totalEventsDetected',
      key: 'totalEventsDetected',
      align: 'right',
    },
    {
      title: 'Vreme kreiranja',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  // Render vehicle progress in modal
  const renderVehicleProgress = (vehicle: VehicleProgress) => {
    const statusIcon = {
      pending: <Clock className="h-4 w-4 text-gray-400" />,
      processing: <Activity className="h-4 w-4 text-blue-500 animate-pulse" />,
      completed: <CheckCircle className="h-4 w-4 text-green-500" />,
      error: <AlertCircle className="h-4 w-4 text-red-500" />,
    };

    return (
      <div key={vehicle.id} className="mb-3 p-3 border rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {statusIcon[vehicle.status]}
            <Text strong>{vehicle.garageNo}</Text>
            {vehicle.status === 'completed' && (
              <Tag color="success">{vehicle.eventsDetected || 0} događaja</Tag>
            )}
            {vehicle.status === 'error' && (
              <Tooltip title={vehicle.error}>
                <Tag color="error">Greška</Tag>
              </Tooltip>
            )}
          </div>
          <Text type="secondary">{vehicle.progress}%</Text>
        </div>
        <Progress 
          percent={vehicle.progress} 
          status={vehicle.status === 'error' ? 'exception' : vehicle.status === 'completed' ? 'success' : 'active'}
          showInfo={false}
        />
      </div>
    );
  };

  return (
    <div className="p-6">
      <Tabs defaultActiveKey="recreation" onChange={(key) => {
        if (key === 'history') {
          loadHistory();
        }
      }}>
        <TabPane tab="Rekreacija podataka" key="recreation">
          {/* Header */}
          <Card className="mb-4">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCcw className="text-2xl text-blue-500" />
              <Title level={2} className="mb-0">Rekreacija podataka</Title>
            </div>
            
            <Alert
              message="Ova opcija omogućava naknadno kreiranje podataka o agresivnoj vožnji za selektovana vozila"
              description="Podatci se kreiraju na osnovu postojećih GPS tačaka analizom ubrzanja i kočenja vozila."
              type="info"
              showIcon
            />
          </Card>

          {/* Vremenski period */}
          <Card title="1. Vremenski period" className="mb-4">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Text className="block mb-2">Odaberite period za analizu:</Text>
                <RangePicker
                  style={{ width: 300 }}
                  value={dateRange}
                  onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
                  format="DD.MM.YYYY"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                  presets={Object.entries(presetRanges).map(([label, value]) => ({
                    label,
                    value: value as [dayjs.Dayjs, dayjs.Dayjs],
                  }))}
                />
                {dateRange && (
                  <>
                    <Text className="ml-3 text-gray-600">
                      Period: {dateRange[1].diff(dateRange[0], 'day') + 1} dana
                    </Text>
                    {dateRange[1].diff(dateRange[0], 'day') + 1 > 31 && (
                      <Alert
                        message="Period je predugačak"
                        description={`Odabrani period (${dateRange[1].diff(dateRange[0], 'day') + 1} dana) prelazi maksimalnih 31 dan. Molimo smanjite period ili pokrenite više manjih rekreacija.`}
                        type="error"
                        showIcon
                        icon={<AlertTriangle className="h-4 w-4" />}
                        className="mt-3"
                        style={{ width: 600 }}
                      />
                    )}
                  </>
                )}
              </div>
            </Space>
          </Card>

          {/* Selekcija vozila */}
          <Card title="2. Selekcija vozila" className="mb-4">
            <div className="mb-4">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space size="middle">
                  <Input
                    placeholder="Pretraži vozila po garažnom broju ili registraciji..."
                    prefix={<Search className="h-4 w-4" />}
                    value={searchText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
                    style={{ width: 300 }}
                    allowClear
                  />
                  <Checkbox
                    checked={loadStats}
                    onChange={(e) => {
                      setLoadStats(e.target.checked);
                      if (e.target.checked) {
                        setLoadEventsOnly(false); // Isključi events-only ako se uključi full stats
                      }
                    }}
                  >
                    <Tooltip title="Učitavanje broja GPS tačaka može trajati duže za velike periode">
                      <Text>Prikaži GPS statistiku</Text>
                    </Tooltip>
                  </Checkbox>
                  <Checkbox
                    checked={loadEventsOnly}
                    onChange={(e) => {
                      setLoadEventsOnly(e.target.checked);
                      if (e.target.checked) {
                        setLoadStats(false); // Isključi full stats ako se uključi samo događaji
                      }
                    }}
                  >
                    <Tooltip title="Brže učitavanje - prikazuje samo broj postojećih događaja">
                      <Text>Prikaži samo postojeće događaje</Text>
                    </Tooltip>
                  </Checkbox>
                </Space>
                {loadStats && dateRange && dateRange[1].diff(dateRange[0], 'day') + 1 > 7 && (
                  <Alert
                    message="Napomena"
                    description="Učitavanje GPS statistike za period duži od 7 dana može trajati duže. Za brže učitavanje, koristite opciju 'Prikaži samo postojeće događaje' ili isključite statistiku."
                    type="warning"
                    showIcon
                    closable
                    className="mt-2"
                    style={{ width: 600 }}
                  />
                )}
                <Space>
                  <Button onClick={handleSelectAllOnPage} disabled={!dateRange || getFilteredVehicles().length === 0}>
                    Selektuj sa stranice
                  </Button>
                  <Button onClick={handleSelectAll} disabled={!dateRange || getFilteredVehicles().length === 0}>
                    {selectedRowKeys.length === getFilteredVehicles().length ? 'Poništi sve' : 'Selektuj sve'}
                  </Button>
                  <Text>
                    Selektovano: <strong>{selectedRowKeys.length}</strong> od {getFilteredVehicles().length} vozila
                    {searchText && ` (filtrirano od ${vehicleData.length} ukupno)`}
                  </Text>
                  {dateRange && (
                    <Button 
                      type="link" 
                      onClick={loadVehicles}
                      loading={vehiclesLoading}
                    >
                      Osveži listu
                    </Button>
                  )}
                </Space>
              </Space>
            </div>

            {!dateRange ? (
              <Empty description="Prvo odaberite vremenski period" />
            ) : (
              <Table
                rowSelection={rowSelection}
                columns={vehicleColumns}
                dataSource={getFilteredVehicles()}
                rowKey="id"
                pagination={{
                  current: currentPage,
                  pageSize: pageSize,
                  showSizeChanger: true,
                  pageSizeOptions: ['20', '50', '100', '200', '500'],
                  onChange: (page) => setCurrentPage(page),
                  onShowSizeChange: (current, size) => {
                    setPageSize(size);
                    setCurrentPage(1); // Reset to first page when changing page size
                  },
                  showTotal: (total, range) => `${range[0]}-${range[1]} od ${total} vozila`,
                }}
                size="middle"
                loading={vehiclesLoading}
              />
            )}
          </Card>

          {/* Opcije rekreacije */}
          <Card title="3. Opcije rekreacije" className="mb-4">
            <Space direction="vertical" size="large">
              <div>
                <Checkbox 
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                >
                  <Text strong>Obriši postojeće događaje pre analize</Text>
                </Checkbox>
                {clearExisting && (
                  <Alert
                    message="Upozorenje"
                    description="Postojeći događaji za selektovana vozila u odabranom periodu će biti obrisani pre kreiranja novih."
                    type="warning"
                    showIcon
                    icon={<AlertTriangle className="h-4 w-4" />}
                    className="mt-2 ml-6"
                    style={{ width: 500 }}
                  />
                )}
              </div>

              <div>
                <Text className="block mb-2">Strategija procesiranja:</Text>
                <Alert
                  message="Obaveštenje"
                  description="Bulk strategija je onemogućena. Svi podaci se procesiraju dan po dan radi optimizacije performansi."
                  type="info"
                  showIcon
                  className="mb-3"
                  style={{ width: 600 }}
                />
                <Radio.Group value={strategy} onChange={(e) => setStrategy(e.target.value)} disabled>
                  <Space direction="vertical">
                    <Radio value="daily" checked>
                      <Space>
                        <Clock className="h-4 w-4" />
                        <Text>Dan po dan (jedina dostupna opcija)</Text>
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>
            </Space>
          </Card>

          {/* Kontrole */}
          <Card>
            <Space size="large">
              <Button
                type="primary"
                size="large"
                icon={<RefreshCcw className="h-4 w-4" />}
                onClick={handleStartRecreation}
                loading={loading}
                disabled={
                  selectedRowKeys.length === 0 ||
                  !dateRange ||
                  (dateRange && dateRange[1].diff(dateRange[0], 'day') + 1 > 31)
                }
              >
                Pokreni rekreaciju ({selectedRowKeys.length} vozila)
              </Button>

              {selectedRowKeys.length > 0 && dateRange && (
                <Alert
                  message={
                    <Space>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <Text>
                        Spremno za rekreaciju: {selectedRowKeys.length} vozila, 
                        period {dateRange[0].format('DD.MM.YYYY')} - {dateRange[1].format('DD.MM.YYYY')}
                      </Text>
                    </Space>
                  }
                  type="success"
                  className="mb-0"
                />
              )}
            </Space>
          </Card>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <History className="h-4 w-4 inline mr-2" />
              Istorija rekreacija
            </span>
          } 
          key="history"
        >
          <Card>
            <Table
              columns={historyColumns}
              dataSource={historyData}
              loading={historyLoading}
              rowKey="id"
              pagination={{
                current: historyPage,
                total: historyTotal,
                pageSize: 10,
                onChange: (page) => {
                  setHistoryPage(page);
                  loadHistory();
                },
              }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Progress Modal */}
      <Modal
        title={
          <Space>
            <Activity className="h-5 w-5 text-blue-500" />
            <span>Rekreacija podataka u toku</span>
          </Space>
        }
        open={progressModalVisible}
        footer={[
          <Button 
            key="stop" 
            danger 
            onClick={handleStopRecreation}
            disabled={recreationStatus?.status !== 'processing'}
          >
            Zaustavi
          </Button>,
          <Button 
            key="close" 
            onClick={() => {
              // Clean up when closing modal
              if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
              }
              setProgressModalVisible(false);
              setCurrentRecreationId(null);
              setRecreationStatus(null);
            }}
            type={recreationStatus?.status === 'completed' ? 'primary' : 'default'}
          >
            {recreationStatus?.status === 'completed' ? 'Završi' : 'Zatvori'}
          </Button>,
        ]}
        width={700}
        maskClosable={false}
      >
        {recreationStatus && (
          <div>
            {/* Overall Progress */}
            <div className="mb-4">
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Obrađeno vozila"
                    value={recreationStatus.processedVehicles}
                    suffix={`/ ${recreationStatus.totalVehicles}`}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Detektovani događaji"
                    value={recreationStatus.totalEventsDetected}
                    prefix={<TrendingUp className="h-4 w-4" />}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Status"
                    value={recreationStatus.status.toUpperCase()}
                    valueStyle={{
                      color: recreationStatus.status === 'completed' ? '#52c41a' : 
                             recreationStatus.status === 'failed' ? '#ff4d4f' : '#1890ff'
                    }}
                  />
                </Col>
              </Row>
            </div>

            <Divider />

            {/* Current Vehicle */}
            {recreationStatus.currentVehicle && (
              <Alert
                message={`Trenutno se obrađuje: ${recreationStatus.currentVehicle.garageNo}`}
                type="info"
                showIcon
                className="mb-4"
              />
            )}

            {/* Overall Progress Bar */}
            <div className="mb-4">
              <Text>Ukupan napredak:</Text>
              <Progress 
                percent={Math.round((recreationStatus.processedVehicles / recreationStatus.totalVehicles) * 100)}
                status={recreationStatus.status === 'failed' ? 'exception' : 
                        recreationStatus.status === 'completed' ? 'success' : 'active'}
              />
            </div>

            {/* Vehicles List */}
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <Text strong className="block mb-2">Vozila:</Text>
              {recreationStatus.vehicles.map(renderVehicleProgress)}
            </div>

            {/* Time Info */}
            {recreationStatus.estimatedCompletion && (
              <div className="mt-4">
                <Text type="secondary">
                  Procenjeno vreme završetka: {dayjs(recreationStatus.estimatedCompletion).format('HH:mm:ss')}
                </Text>
              </div>
            )}
          </div>
        )}

        {!recreationStatus && (
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <Text>Učitavanje statusa...</Text>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        title="Potvrda pokretanja rekreacije"
        open={confirmModalVisible}
        onOk={handleConfirmRecreation}
        onCancel={() => setConfirmModalVisible(false)}
        confirmLoading={loading}
      >
        <div>
          <p><strong>Vozila:</strong> {selectedRowKeys.length}</p>
          <p><strong>Period:</strong> {dateRange?.[0].format('DD.MM.YYYY')} - {dateRange?.[1].format('DD.MM.YYYY')}</p>
          <p><strong>Strategija:</strong> {strategy === 'daily' ? 'Dan po dan' : 'Ceo period'}</p>
          {clearExisting && (
            <Alert 
              message="Postojeći događaji će biti obrisani!" 
              type="warning" 
              showIcon 
              className="mt-2"
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default DataRecreation;