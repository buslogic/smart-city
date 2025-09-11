import React, { useState, useEffect } from 'react';
import { Card, Typography, Tabs, Table, Tag, Spin, Alert, Badge, Tooltip, Space, Button, Modal, DatePicker, message, Switch, Empty } from 'antd';
import { 
  DatabaseOutlined, 
  TableOutlined, 
  CompressOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  LoadingOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { timescaledbService, TimescaleTable, ContinuousAggregate } from '../../../services/timescaledb.service';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { formatDistanceToNow } from 'date-fns';
import { sr } from 'date-fns/locale';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const { RangePicker } = DatePicker;

const TimescaleDB: React.FC = () => {
  const [tables, setTables] = useState<TimescaleTable[]>([]);
  const [aggregates, setAggregates] = useState<ContinuousAggregate[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingAggregates, setLoadingAggregates] = useState(false);
  const [errorTables, setErrorTables] = useState<string | null>(null);
  const [errorAggregates, setErrorAggregates] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('tables');
  const [refreshModalVisible, setRefreshModalVisible] = useState(false);
  const [selectedAggregate, setSelectedAggregate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [useFullRefresh, setUseFullRefresh] = useState(true);
  const [refreshingAggregates, setRefreshingAggregates] = useState<Map<string, { 
    startTime: Date, 
    status: 'running' | 'completed' | 'failed',
    endTime?: Date,
    result?: any,
    dateRange?: { start?: string; end?: string }
  }>>(new Map());
  const [aggregateStatus, setAggregateStatus] = useState<any[]>([]);
  const [timescaleJobs, setTimescaleJobs] = useState<any[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshHistory, setRefreshHistory] = useState<Array<{
    id: string;
    aggregateName: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    status: 'completed' | 'failed' | 'timeout';
    rowCount?: number;
    size?: string;
    dateRange?: { start?: string; end?: string };
  }>>([]);

  const fetchTables = async () => {
    setLoadingTables(true);
    setErrorTables(null);
    try {
      const data = await timescaledbService.getTables();
      setTables(data);
    } catch (error: any) {
      setErrorTables(error.message || 'Greška pri učitavanju tabela');
    } finally {
      setLoadingTables(false);
    }
  };

  const fetchAggregates = async () => {
    setLoadingAggregates(true);
    setErrorAggregates(null);
    try {
      const data = await timescaledbService.getContinuousAggregates();
      setAggregates(data);
    } catch (error: any) {
      setErrorAggregates(error.message || 'Greška pri učitavanju agregata');
    } finally {
      setLoadingAggregates(false);
    }
  };

  const fetchAggregateStatus = async () => {
    setLoadingStatus(true);
    try {
      const data = await timescaledbService.getContinuousAggregatesStatus();
      console.log('Aggregate status data:', data); // Debug log
      setAggregateStatus(data?.aggregates || []);
    } catch (error: any) {
      console.error('Error fetching aggregate status:', error);
      setAggregateStatus([]);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchTimescaleJobs = async () => {
    setLoadingJobs(true);
    try {
      const data = await timescaledbService.getTimescaleJobs();
      setTimescaleJobs(data || []);
    } catch (error: any) {
      console.error('Error fetching TimescaleDB jobs:', error);
      setTimescaleJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Učitaj istoriju iz localStorage pri mount-u
  useEffect(() => {
    const savedHistory = localStorage.getItem('timescaledb-refresh-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        // Konvertuj string datume nazad u Date objekte i dodaj jedinstvene ID-jeve ako nedostaju
        const history = parsed.map((item: any, index: number) => ({
          ...item,
          id: item.id || `${item.aggregateName}-${new Date(item.startTime).getTime()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          startTime: new Date(item.startTime),
          endTime: new Date(item.endTime)
        }));
        // Ukloni duplikate po ID-ju
        const uniqueHistory = history.filter((item: any, index: number, self: any[]) => 
          index === self.findIndex((t) => t.id === item.id)
        );
        setRefreshHistory(uniqueHistory);
        // Ažuriraj localStorage sa očišćenom istorijom
        if (uniqueHistory.length !== history.length) {
          localStorage.setItem('timescaledb-refresh-history', JSON.stringify(uniqueHistory));
        }
      } catch (error) {
        console.error('Error loading refresh history:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'tables') {
      fetchTables();
    } else if (activeTab === 'aggregates') {
      fetchAggregates();
    } else if (activeTab === 'monitoring') {
      fetchAggregateStatus();
      fetchTimescaleJobs();
    }
  }, [activeTab]);

  // Auto-refresh za monitoring tab
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeTab === 'monitoring' && autoRefresh) {
      interval = setInterval(() => {
        fetchAggregateStatus();
        fetchTimescaleJobs();
      }, 5000); // Refresh svakih 5 sekundi
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, autoRefresh]);

  const handleRefreshAggregate = async () => {
    if (!selectedAggregate) return;
    
    setRefreshing(true);
    try {
      let startTime: string | undefined;
      let endTime: string | undefined;
      
      if (!useFullRefresh && dateRange && dateRange[0] && dateRange[1]) {
        startTime = dateRange[0].format('YYYY-MM-DD HH:mm:ss');
        endTime = dateRange[1].format('YYYY-MM-DD HH:mm:ss');
      }
      
      const result = await timescaledbService.refreshContinuousAggregate(
        selectedAggregate,
        startTime,
        endTime
      );
      
      // Sačuvaj informaciju o datumskom opsegu za istoriju
      const refreshDateRange = (startTime && endTime) ? { start: startTime, end: endTime } : undefined;
      
      // Proveri da li je pokrenut u pozadini
      if (result.details?.status === 'running_in_background') {
        // Dodaj u mapu agregata koji se osvežavaju sa statusom
        setRefreshingAggregates(prev => new Map(prev).set(selectedAggregate, {
          startTime: new Date(),
          status: 'running',
          dateRange: refreshDateRange
        }));
        
        message.info({
          content: result.message,
          duration: 8,
          key: `refresh-${selectedAggregate}`,
        });
        
        // Počni da proveravamo status svakih 30 sekundi
        let checkCount = 0;
        const maxChecks = 120; // Maksimalno 60 minuta (120 * 30 sekundi)
        
        const checkInterval = setInterval(async () => {
          checkCount++;
          
          try {
            // Proveri da li se još uvek izvršava
            const statusData = await timescaledbService.getContinuousAggregatesStatus();
            const stillRunning = statusData?.aggregates?.some(
              (agg: any) => agg.view_name === selectedAggregate && agg.is_refreshing
            );
            
            if (!stillRunning || checkCount >= maxChecks) {
              clearInterval(checkInterval);
              
              // Osveži podatke o agregatu
              await fetchAggregates();
              const updatedAggregates = await timescaledbService.getContinuousAggregates();
              const updatedAggregate = updatedAggregates.find((a: any) => a.view_name === selectedAggregate);
              
              // Ažuriraj status sa rezultatom
              setRefreshingAggregates(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(selectedAggregate);
                if (existing) {
                  const endTime = new Date();
                  const duration = Math.round((endTime.getTime() - existing.startTime.getTime()) / 1000);
                  
                  newMap.set(selectedAggregate, {
                    ...existing,
                    status: checkCount >= maxChecks ? 'completed' : 'completed',
                    endTime: endTime,
                    result: {
                      duration: duration,
                      rowCount: updatedAggregate?.row_count,
                      size: updatedAggregate?.size,
                      timeout: checkCount >= maxChecks
                    }
                  });
                  
                  // Dodaj u istoriju sa jedinstvenim ID
                  const historyEntry = {
                    id: `${selectedAggregate}-${existing.startTime.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
                    aggregateName: selectedAggregate,
                    startTime: existing.startTime,
                    endTime: endTime,
                    duration: duration,
                    status: checkCount >= maxChecks ? 'timeout' as const : 'completed' as const,
                    rowCount: updatedAggregate?.row_count,
                    size: updatedAggregate?.size,
                    dateRange: existing.dateRange // Koristi sačuvanu informaciju o datumskom opsegu
                  };
                  
                  setRefreshHistory(prevHistory => {
                    const newHistory = [historyEntry, ...prevHistory].slice(0, 50); // Čuvaj maksimalno 50 unosa
                    localStorage.setItem('timescaledb-refresh-history', JSON.stringify(newHistory));
                    return newHistory;
                  });
                }
                return newMap;
              });
              
              message.success({
                content: `Osvežavanje agregata ${selectedAggregate} je završeno nakon ${Math.round((new Date().getTime() - new Date(result.details?.startTime || new Date()).getTime()) / 60000)} minuta`,
                duration: 5,
                key: `refresh-${selectedAggregate}`,
              });
            }
          } catch (error) {
            console.error('Error checking refresh status:', error);
          }
        }, 30000); // Proveri svakih 30 sekundi
        
      } else {
        // Običan refresh koji je završen odmah
        message.success({
          content: result.message,
          duration: 5,
        });
      }
      
      // Osveži listu agregata
      fetchAggregates();
      
      // Zatvori modal
      setRefreshModalVisible(false);
      setSelectedAggregate(null);
      setDateRange(null);
      setUseFullRefresh(true);
    } catch (error: any) {
      message.error({
        content: error.response?.data?.message || error.message || 'Greška pri osvežavanju agregata',
        duration: 5,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const openRefreshModal = (aggregateName: string) => {
    setSelectedAggregate(aggregateName);
    setRefreshModalVisible(true);
  };

  const formatNumber = (num: number | null): string => {
    if (num === null) return 'N/A';
    return new Intl.NumberFormat('sr-RS').format(num);
  };

  const formatSize = (size: string): string => {
    // Parsiranje PostgreSQL pg_size_pretty formata
    const match = size.match(/^([\d.]+)\s*([A-Z]+)$/i);
    if (!match) return size;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    // Konverzija MB u GB ako je preko 1000 MB
    if (unit === 'MB' && value >= 1000) {
      const gb = value / 1024;
      return `${gb.toFixed(2)} GB`;
    }
    
    // Konverzija KB u MB ako je preko 1000 KB
    if (unit === 'KB' && value >= 1000) {
      const mb = value / 1024;
      return `${mb.toFixed(2)} MB`;
    }
    
    return size;
  };

  const tableColumns: ColumnsType<TimescaleTable> = [
    {
      title: 'Schema',
      dataIndex: 'schemaname',
      key: 'schemaname',
      width: 120,
      render: (text) => (
        <Tag color={text === 'public' ? 'green' : 'blue'}>{text}</Tag>
      ),
    },
    {
      title: 'Naziv tabele',
      dataIndex: 'tablename',
      key: 'tablename',
      render: (text, record) => (
        <Space>
          <Text strong>{text}</Text>
          {record.is_hypertable && (
            <Tooltip title="Hypertable - optimizovana za time-series podatke">
              <Badge status="processing" text="Hypertable" />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Broj redova',
      dataIndex: 'row_count',
      key: 'row_count',
      align: 'right',
      width: 120,
      render: (value) => formatNumber(value),
      sorter: (a, b) => (a.row_count || 0) - (b.row_count || 0),
    },
    {
      title: 'Veličina',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      align: 'right',
      render: (value) => formatSize(value),
    },
    {
      title: 'Broj kolona',
      dataIndex: 'column_count',
      key: 'column_count',
      width: 100,
      align: 'center',
    },
    {
      title: 'Hypertable Info',
      key: 'hypertable_info',
      width: 250,
      render: (_, record) => {
        if (!record.hypertable_info) return null;
        const info = record.hypertable_info;
        return (
          <Space direction="vertical" size="small">
            <Text type="secondary">
              <CompressOutlined /> Kompresija: {info.compression_enabled ? 
                <Tag color="green">DA</Tag> : 
                <Tag>NE</Tag>
              }
            </Text>
            <Text type="secondary">Chunks: {info.num_chunks}</Text>
            <Text type="secondary">Dimenzije: {info.num_dimensions}</Text>
            {info.total_size && (
              <Text type="secondary" strong>Ukupna veličina: {formatSize(info.total_size)}</Text>
            )}
            {info.index_size && (
              <Text type="secondary">Index veličina: {formatSize(info.index_size)}</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Opis',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || <Text type="secondary">Nema opisa</Text>,
    },
  ];

  const aggregateColumns: ColumnsType<ContinuousAggregate> = [
    {
      title: 'Akcije',
      key: 'actions',
      width: 120,
      fixed: 'left',
      render: (_, record) => {
        const isRefreshing = refreshingAggregates.has(record.view_name);
        
        return (
          <Button
            type={isRefreshing ? "default" : "primary"}
            size="small"
            icon={isRefreshing ? <LoadingOutlined spin /> : <SyncOutlined />}
            onClick={() => !isRefreshing && openRefreshModal(record.view_name)}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Osvežava se...' : 'Osveži'}
          </Button>
        );
      },
    },
    {
      title: 'Schema',
      dataIndex: 'view_schema',
      key: 'view_schema',
      width: 120,
      render: (text) => <Tag color="purple">{text}</Tag>,
    },
    {
      title: 'Naziv agregata',
      dataIndex: 'view_name',
      key: 'view_name',
      render: (text, record) => {
        const isRefreshing = refreshingAggregates.has(record.view_name);
        
        return (
          <Space>
            <Text strong>{text}</Text>
            {isRefreshing && (
              <Badge status="processing" text="Osvežava se..." />
            )}
            {record.finalized && !isRefreshing && (
              <Tooltip title="Finalizovan agregat">
                <Tag color="success">Finalizovan</Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Broj redova',
      dataIndex: 'row_count',
      key: 'row_count',
      align: 'right',
      width: 120,
      render: (value) => formatNumber(value),
      sorter: (a, b) => (a.row_count || 0) - (b.row_count || 0),
    },
    {
      title: 'Veličina',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      align: 'right',
      render: (value) => formatSize(value),
    },
    {
      title: 'Kompresija',
      dataIndex: 'compression_enabled',
      key: 'compression_enabled',
      width: 100,
      align: 'center',
      render: (value) => value ? 
        <Tag color="green">DA</Tag> : 
        <Tag>NE</Tag>,
    },
    {
      title: 'Refresh Policy',
      key: 'refresh_policy',
      width: 250,
      render: (_, record) => {
        if (!record.refresh_policy) {
          return <Text type="secondary">Nema automatskog osvežavanja</Text>;
        }
        const policy = record.refresh_policy;
        return (
          <Space direction="vertical" size="small">
            {policy.refresh_interval && (
              <Text type="secondary">
                <ClockCircleOutlined /> Interval: {policy.refresh_interval}
              </Text>
            )}
            {policy.start_offset && (
              <Text type="secondary">Start offset: {policy.start_offset}</Text>
            )}
            {policy.end_offset && (
              <Text type="secondary">End offset: {policy.end_offset}</Text>
            )}
            {policy.next_run && (
              <Text type="secondary">Sledeće izvršavanje: {new Date(policy.next_run).toLocaleString('sr-RS')}</Text>
            )}
            {policy.last_status && (
              <Text type="secondary">
                Status: <Tag color={policy.last_status === 'Success' ? 'green' : 'red'}>{policy.last_status}</Tag>
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Materijalizovana tabela',
      key: 'materialization',
      ellipsis: true,
      render: (_, record) => (
        <Text type="secondary" className="text-xs">
          {record.materialization_hypertable_schema}.{record.materialization_hypertable_name}
        </Text>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DatabaseOutlined className="text-2xl text-blue-500" />
            <Title level={2} className="mb-0">TimescaleDB Administracija</Title>
          </div>
        </div>
        
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane 
            tab={
              <span>
                <TableOutlined />
                <span className="ml-2">Tabele</span>
              </span>
            } 
            key="tables"
          >
            <div className="mb-4 flex justify-between items-center">
              <Space>
                <Text type="secondary">
                  Ukupno tabela: <Text strong>{tables.length}</Text>
                </Text>
                <Text type="secondary">
                  Hypertables: <Text strong>
                    {tables.filter(t => t.is_hypertable).length}
                  </Text>
                </Text>
              </Space>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchTables}
                loading={loadingTables}
              >
                Osveži
              </Button>
            </div>

            {errorTables && (
              <Alert
                message="Greška"
                description={errorTables}
                type="error"
                showIcon
                closable
                className="mb-4"
              />
            )}

            <Table
              columns={tableColumns}
              dataSource={tables}
              loading={loadingTables}
              rowKey={(record) => `${record.schemaname}.${record.tablename}`}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Ukupno ${total} tabela`,
              }}
              scroll={{ x: 1200 }}
            />
          </TabPane>

          <TabPane 
            tab={
              <span>
                <CompressOutlined />
                <span className="ml-2">Continuous Aggregates</span>
              </span>
            } 
            key="aggregates"
          >
            <div className="mb-4 flex justify-between items-center">
              <Space>
                <Text type="secondary">
                  Ukupno agregata: <Text strong>{aggregates.length}</Text>
                </Text>
                <Text type="secondary">
                  Sa kompresijom: <Text strong>
                    {aggregates.filter(a => a.compression_enabled).length}
                  </Text>
                </Text>
              </Space>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchAggregates}
                loading={loadingAggregates}
              >
                Osveži
              </Button>
            </div>

            {errorAggregates && (
              <Alert
                message="Greška"
                description={errorAggregates}
                type="error"
                showIcon
                closable
                className="mb-4"
              />
            )}

            {aggregates.length === 0 && !loadingAggregates ? (
              <Alert
                message="Nema Continuous Aggregates"
                description="Trenutno nema definisanih continuous aggregates u bazi podataka."
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
              />
            ) : (
              <Table
                columns={aggregateColumns}
                dataSource={aggregates}
                loading={loadingAggregates}
                rowKey={(record) => `${record.view_schema}.${record.view_name}`}
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `Ukupno ${total} agregata`,
                }}
                scroll={{ x: 1400 }}
              />
            )}
          </TabPane>

          <TabPane 
            tab={
              <span>
                <LineChartOutlined />
                <span className="ml-2">Monitoring</span>
              </span>
            } 
            key="monitoring"
          >
            <div className="space-y-6">
              {/* Auto-refresh kontrola */}
              <div className="flex justify-between items-center">
                <Space>
                  <Text type="secondary">
                    Status agregata se ažurira {autoRefresh ? 'automatski' : 'ručno'}
                  </Text>
                  {autoRefresh && (
                    <Text type="secondary">
                      <ClockCircleOutlined /> Sledeće osvežavanje za {30 - (Date.now() % 30000) / 1000 | 0}s
                    </Text>
                  )}
                </Space>
                <Space>
                  <Switch
                    checked={autoRefresh}
                    onChange={setAutoRefresh}
                    checkedChildren="Auto-refresh ON"
                    unCheckedChildren="Auto-refresh OFF"
                  />
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={() => {
                      fetchAggregateStatus();
                      fetchTimescaleJobs();
                    }}
                    loading={loadingStatus || loadingJobs}
                  >
                    Osveži sada
                  </Button>
                </Space>
              </div>

              {/* Status agregata */}
              <Card title="Real-time Status Agregata" loading={loadingStatus}>
                {aggregateStatus && aggregateStatus.length > 0 ? (
                  <Table
                    dataSource={aggregateStatus}
                    rowKey={(record) => `${record.view_name}_${record.pid || Math.random()}`}
                    pagination={false}
                    columns={[
                      {
                        title: 'Agregat',
                        dataIndex: 'view_name',
                        key: 'view_name',
                        render: (text) => <Text strong>{text}</Text>,
                      },
                      {
                        title: 'Status',
                        key: 'status',
                        render: (_, record) => {
                          if (record.is_refreshing) {
                            return (
                              <Badge status="processing" text={
                                <Space>
                                  <LoadingOutlined spin />
                                  <Text type="warning">Osvežava se</Text>
                                </Space>
                              } />
                            );
                          }
                          return <Badge status="success" text="Spreman" />;
                        },
                      },
                      {
                        title: 'Broj redova',
                        dataIndex: 'row_count',
                        key: 'row_count',
                        align: 'right',
                        render: (value) => value ? formatNumber(value) : '-',
                      },
                      {
                        title: 'Veličina',
                        dataIndex: 'size',
                        key: 'size',
                        render: (value) => value || '-',
                      },
                      {
                        title: 'Poslednji podatak',
                        dataIndex: 'last_data_point',
                        key: 'last_data_point',
                        render: (text) => text ? (
                          <Tooltip title={new Date(text).toLocaleString('sr-RS')}>
                            <Text type="secondary">
                              {formatDistanceToNow(new Date(text), { 
                                addSuffix: true, 
                                locale: sr 
                              })}
                            </Text>
                          </Tooltip>
                        ) : '-',
                      },
                      {
                        title: 'Poslednje osvežavanje',
                        dataIndex: 'last_refresh',
                        key: 'last_refresh',
                        render: (text) => text ? (
                          <Tooltip title={new Date(text).toLocaleString('sr-RS')}>
                            <Text type="secondary">
                              {formatDistanceToNow(new Date(text), { 
                                addSuffix: true, 
                                locale: sr 
                              })}
                            </Text>
                          </Tooltip>
                        ) : '-',
                      },
                      {
                        title: 'Sledeće osvežavanje',
                        dataIndex: 'next_refresh',
                        key: 'next_refresh',
                        render: (text) => text ? (
                          <Tooltip title={new Date(text).toLocaleString('sr-RS')}>
                            <Text>
                              {formatDistanceToNow(new Date(text), { 
                                addSuffix: true, 
                                locale: sr 
                              })}
                            </Text>
                          </Tooltip>
                        ) : '-',
                      },
                    ]}
                  />
                ) : (
                  <Empty description="Nema aktivnih procesa" />
                )}
              </Card>

              {/* Aktivni refresh procesi */}
              <Card title="Refresh Procesi - Istorija" loading={loadingStatus}>
                {refreshingAggregates.size > 0 ? (
                  <Table
                    dataSource={Array.from(refreshingAggregates.entries()).map(([name, data]) => ({
                      key: name,
                      aggregate_name: name,
                      ...data
                    }))}
                    pagination={false}
                    columns={[
                      {
                        title: 'Agregat',
                        dataIndex: 'aggregate_name',
                        key: 'aggregate_name',
                        render: (text, record) => (
                          <Space>
                            {record.status === 'running' ? (
                              <LoadingOutlined spin />
                            ) : record.status === 'completed' ? (
                              <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            ) : (
                              <CloseCircleOutlined style={{ color: '#f5222d' }} />
                            )}
                            <Text strong>{text}</Text>
                          </Space>
                        ),
                      },
                      {
                        title: 'Status',
                        key: 'status',
                        render: (_, record) => {
                          if (record.status === 'running') {
                            return <Badge status="processing" text="Osvežava se u pozadini" />;
                          } else if (record.status === 'completed') {
                            return <Badge status="success" text="Završeno" />;
                          } else {
                            return <Badge status="error" text="Greška" />;
                          }
                        },
                      },
                      {
                        title: 'Trajanje',
                        key: 'duration',
                        render: (_, record) => {
                          if (record.status === 'running') {
                            const elapsed = Math.round((new Date().getTime() - record.startTime.getTime()) / 1000);
                            return <Text>{elapsed < 60 ? `${elapsed}s` : `${Math.round(elapsed / 60)}min`}</Text>;
                          } else if (record.result?.duration) {
                            const dur = record.result.duration;
                            return (
                              <Text type={dur > 600 ? 'warning' : 'secondary'}>
                                {dur < 60 ? `${dur}s` : `${Math.round(dur / 60)}min`}
                              </Text>
                            );
                          }
                          return '-';
                        },
                      },
                      {
                        title: 'Pokrenuto',
                        dataIndex: 'startTime',
                        key: 'startTime',
                        render: (date) => (
                          <Tooltip title={new Date(date).toLocaleString('sr-RS')}>
                            <Text type="secondary">
                              {formatDistanceToNow(date, { 
                                addSuffix: true, 
                                locale: sr 
                              })}
                            </Text>
                          </Tooltip>
                        ),
                      },
                      {
                        title: 'Rezultat',
                        key: 'result',
                        render: (_, record) => {
                          if (record.status === 'running') {
                            const isLarge = ['daily_vehicle_stats', 'vehicle_hourly_stats', 'monthly_vehicle_raw_stats'].includes(record.aggregate_name);
                            return (
                              <Text type="secondary" className="text-xs">
                                {isLarge ? 'Veliki agregat - može trajati 20+ minuta' : 'Osvežavanje u toku...'}
                              </Text>
                            );
                          } else if (record.status === 'completed' && record.result) {
                            return (
                              <Space direction="vertical" size="small">
                                <Text type="secondary" className="text-xs">
                                  Broj redova: {record.result.rowCount ? formatNumber(record.result.rowCount) : '-'}
                                </Text>
                                <Text type="secondary" className="text-xs">
                                  Veličina: {record.result.size || '-'}
                                </Text>
                                {record.result.timeout && (
                                  <Text type="warning" className="text-xs">
                                    Dosegnut timeout provere
                                  </Text>
                                )}
                              </Space>
                            );
                          }
                          return '-';
                        },
                      },
                      {
                        title: 'Akcije',
                        key: 'actions',
                        render: (_, record) => {
                          if (record.status === 'completed') {
                            return (
                              <Button 
                                size="small" 
                                type="text"
                                danger
                                onClick={() => {
                                  setRefreshingAggregates(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(record.aggregate_name);
                                    return newMap;
                                  });
                                }}
                              >
                                Ukloni
                              </Button>
                            );
                          }
                          return null;
                        },
                      },
                    ]}
                  />
                ) : (
                  <Empty 
                    description="Nema aktivnih refresh procesa"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Text type="secondary" className="text-xs">
                      Pokrenite osvežavanje agregata iz "Continuous Aggregates" taba
                    </Text>
                  </Empty>
                )}
              </Card>

              {/* Istorija ručno pokrenutih refresh-ova */}
              <Card 
                title="Istorija Ručnih Refresh-ova" 
                extra={
                  refreshHistory.length > 0 && (
                    <Button 
                      size="small" 
                      danger
                      onClick={() => {
                        Modal.confirm({
                          title: 'Obriši istoriju',
                          content: 'Da li ste sigurni da želite da obrišete kompletnu istoriju refresh-ova?',
                          onOk: () => {
                            setRefreshHistory([]);
                            localStorage.removeItem('timescaledb-refresh-history');
                            message.success('Istorija je obrisana');
                          },
                          okText: 'Da, obriši',
                          cancelText: 'Otkaži',
                        });
                      }}
                    >
                      Obriši istoriju
                    </Button>
                  )
                }
              >
                {refreshHistory.length > 0 ? (
                  <Table
                    dataSource={refreshHistory}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                    }}
                    columns={[
                      {
                        title: 'Agregat',
                        dataIndex: 'aggregateName',
                        key: 'aggregateName',
                        render: (text) => <Text strong>{text}</Text>,
                      },
                      {
                        title: 'Pokrenuto',
                        dataIndex: 'startTime',
                        key: 'startTime',
                        render: (date) => (
                          <Tooltip title={new Date(date).toLocaleString('sr-RS')}>
                            <Text type="secondary">
                              {formatDistanceToNow(new Date(date), { 
                                addSuffix: true, 
                                locale: sr 
                              })}
                            </Text>
                          </Tooltip>
                        ),
                      },
                      {
                        title: 'Trajanje',
                        dataIndex: 'duration',
                        key: 'duration',
                        render: (seconds) => {
                          const minutes = Math.floor(seconds / 60);
                          const remainingSeconds = seconds % 60;
                          return (
                            <Text type={seconds > 600 ? 'warning' : 'secondary'}>
                              {minutes > 0 ? `${minutes}min ${remainingSeconds}s` : `${seconds}s`}
                            </Text>
                          );
                        },
                        sorter: (a, b) => a.duration - b.duration,
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        render: (status) => {
                          if (status === 'completed') {
                            return <Tag color="success">Završeno</Tag>;
                          } else if (status === 'timeout') {
                            return <Tag color="warning">Timeout</Tag>;
                          } else {
                            return <Tag color="error">Greška</Tag>;
                          }
                        },
                        filters: [
                          { text: 'Završeno', value: 'completed' },
                          { text: 'Timeout', value: 'timeout' },
                          { text: 'Greška', value: 'failed' },
                        ],
                        onFilter: (value, record) => record.status === value,
                      },
                      {
                        title: 'Broj redova',
                        dataIndex: 'rowCount',
                        key: 'rowCount',
                        align: 'right',
                        render: (value) => value ? formatNumber(value) : '-',
                        sorter: (a, b) => (a.rowCount || 0) - (b.rowCount || 0),
                      },
                      {
                        title: 'Veličina',
                        dataIndex: 'size',
                        key: 'size',
                        render: (value) => value || '-',
                      },
                      {
                        title: 'Opseg datuma',
                        dataIndex: 'dateRange',
                        key: 'dateRange',
                        render: (range) => {
                          if (!range) return <Text type="secondary">Pun refresh</Text>;
                          return (
                            <Text type="secondary" className="text-xs">
                              {range.start && range.end ? 
                                `${new Date(range.start).toLocaleDateString('sr-RS')} - ${new Date(range.end).toLocaleDateString('sr-RS')}` :
                                'Delimičan refresh'
                              }
                            </Text>
                          );
                        },
                      },
                    ]}
                  />
                ) : (
                  <Empty 
                    description="Nema istorije refresh-ova"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Text type="secondary" className="text-xs">
                      Istorija će biti prikazana kada pokrenete ručno osvežavanje agregata
                    </Text>
                  </Empty>
                )}
              </Card>

              {/* Job istorija */}
              <Card title="Automatski TimescaleDB Job-ovi" loading={loadingJobs}>
                {timescaleJobs && timescaleJobs.length > 0 ? (
                  <Table
                    dataSource={timescaleJobs}
                    rowKey="job_id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                    }}
                    columns={[
                      {
                        title: 'Job ID',
                        dataIndex: 'job_id',
                        key: 'job_id',
                        width: 80,
                      },
                      {
                        title: 'Aplikacija',
                        dataIndex: 'application_name',
                        key: 'application_name',
                        render: (text) => <Tag>{text}</Tag>,
                      },
                      {
                        title: 'Hypertable',
                        dataIndex: 'hypertable_name',
                        key: 'hypertable_name',
                        render: (text, record) => (
                          <Text className="font-mono">
                            {record.hypertable_schema}.{text}
                          </Text>
                        ),
                      },
                      {
                        title: 'Status',
                        dataIndex: 'last_run_status',
                        key: 'last_run_status',
                        render: (status) => (
                          <Tag color={
                            status === 'Success' ? 'green' : 
                            status === 'Failed' ? 'red' : 
                            'orange'
                          }>
                            {status || 'Unknown'}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Poslednje izvršavanje',
                        dataIndex: 'last_successful_finish',
                        key: 'last_successful_finish',
                        render: (text) => text ? (
                          <Tooltip title={new Date(text).toLocaleString('sr-RS')}>
                            <Text type="secondary">
                              {formatDistanceToNow(new Date(text), { 
                                addSuffix: true, 
                                locale: sr 
                              })}
                            </Text>
                          </Tooltip>
                        ) : '-',
                      },
                      {
                        title: 'Sledeće izvršavanje',
                        dataIndex: 'next_start',
                        key: 'next_start',
                        render: (text) => text ? (
                          <Tooltip title={new Date(text).toLocaleString('sr-RS')}>
                            <Text>
                              {formatDistanceToNow(new Date(text), { 
                                addSuffix: true, 
                                locale: sr 
                              })}
                            </Text>
                          </Tooltip>
                        ) : '-',
                      },
                      {
                        title: 'Trajanje',
                        dataIndex: 'last_run_duration',
                        key: 'last_run_duration',
                        render: (duration) => {
                          if (!duration) return '-';
                          if (typeof duration === 'object' && duration.milliseconds) {
                            const ms = duration.milliseconds;
                            if (ms < 1000) return `${ms}ms`;
                            if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
                            return `${(ms / 60000).toFixed(1)}min`;
                          }
                          return String(duration);
                        },
                      },
                      {
                        title: 'Ukupno izvršavanja',
                        dataIndex: 'total_runs',
                        key: 'total_runs',
                        align: 'center',
                      },
                      {
                        title: 'Neuspešnih',
                        dataIndex: 'total_failures',
                        key: 'total_failures',
                        align: 'center',
                        render: (value) => value > 0 ? (
                          <Text type="danger">{value}</Text>
                        ) : value,
                      },
                    ]}
                  />
                ) : (
                  <Empty description="Nema job istorije" />
                )}
              </Card>
            </div>
          </TabPane>
        </Tabs>
      </Card>

      {/* Modal za refresh continuous aggregate */}
      <Modal
        title={`Osveži Continuous Aggregate: ${selectedAggregate}`}
        open={refreshModalVisible}
        onOk={handleRefreshAggregate}
        onCancel={() => {
          setRefreshModalVisible(false);
          setSelectedAggregate(null);
          setDateRange(null);
          setUseFullRefresh(true);
        }}
        confirmLoading={refreshing}
        okText="Osveži"
        cancelText="Otkaži"
        width={600}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>Opcije osvežavanja:</Text>
          </div>
          
          <div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <label>
                <input
                  type="radio"
                  checked={useFullRefresh}
                  onChange={() => {
                    setUseFullRefresh(true);
                    setDateRange(null);
                  }}
                  style={{ marginRight: 8 }}
                />
                <Text>Potpuno osvežavanje (ceo opseg podataka)</Text>
              </label>
              
              <label>
                <input
                  type="radio"
                  checked={!useFullRefresh}
                  onChange={() => setUseFullRefresh(false)}
                  style={{ marginRight: 8 }}
                />
                <Text>Osvežavanje za specifičan period</Text>
              </label>
            </Space>
          </div>
          
          {!useFullRefresh && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Odaberite period:
              </Text>
              <RangePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                style={{ width: '100%' }}
                value={dateRange}
                onChange={(dates) => setDateRange(dates)}
                placeholder={['Početak perioda', 'Kraj perioda']}
              />
            </div>
          )}
          
          <Alert
            message="Napomena"
            description={
              useFullRefresh
                ? "Potpuno osvežavanje može potrajati duže vreme zavisno od količine podataka."
                : "Osvežavanje za specifičan period će ažurirati samo podatke u tom opsegu."
            }
            type="info"
            showIcon
          />
        </Space>
      </Modal>
    </div>
  );
};

export default TimescaleDB;