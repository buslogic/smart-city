import React, { useState, useEffect } from 'react';
import { Card, Typography, Tabs, Table, Tag, Spin, Alert, Badge, Tooltip, Space, Button, Modal, DatePicker, message } from 'antd';
import { 
  DatabaseOutlined, 
  TableOutlined, 
  CompressOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  SyncOutlined 
} from '@ant-design/icons';
import { timescaledbService, TimescaleTable, ContinuousAggregate } from '../../../services/timescaledb.service';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

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

  useEffect(() => {
    if (activeTab === 'tables') {
      fetchTables();
    } else if (activeTab === 'aggregates') {
      fetchAggregates();
    }
  }, [activeTab]);

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
      
      message.success({
        content: result.message,
        duration: 5,
      });
      
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
      width: 100,
      fixed: 'left',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<SyncOutlined />}
          onClick={() => openRefreshModal(record.view_name)}
        >
          Osveži
        </Button>
      ),
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
      render: (text, record) => (
        <Space>
          <Text strong>{text}</Text>
          {record.finalized && (
            <Tooltip title="Finalizovan agregat">
              <Tag color="success">Finalizovan</Tag>
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