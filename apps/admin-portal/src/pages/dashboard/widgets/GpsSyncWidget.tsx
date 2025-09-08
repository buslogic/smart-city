import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  Spin, 
  Typography, 
  Space, 
  Tag, 
  Tooltip,
  Badge,
  Divider
} from 'antd';
import { 
  SyncOutlined, 
  DatabaseOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  WifiOutlined
} from '@ant-design/icons';
import { api } from '../../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/sr';

dayjs.extend(relativeTime);
dayjs.locale('sr');

const { Text, Title } = Typography;

interface GpsSyncData {
  buffer: {
    totalRecords: number;
    pendingRecords: number;
    processingRecords: number;
    processedRecords: number;
    errorRecords: number;
  };
  lastBatch: {
    number: number;
    startedAt: string;
    completedAt: string;
    processed: number;
    duration: number;
    recordsPerSecond: number;
    status: string;
  } | null;
  config: {
    batchSize: number;
    workerCount: number;
    useWorkerPool: boolean;
  };
  systemStatus: {
    isActive: boolean;
    lastSync: string | null;
  };
}

interface Props {
  config?: any;
}

const GpsSyncWidget: React.FC<Props> = ({ config }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GpsSyncData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh svakih 30 sekundi
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setError(null);
      const response = await api.get('/api/dashboard/widgets/gps-sync-status');
      setData(response.data);
    } catch (error) {
      console.error('Error fetching GPS sync data:', error);
      setError('Greška pri učitavanju GPS sync podataka');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? '#52c41a' : '#ff4d4f';
  };

  const getBufferProgress = () => {
    if (!data?.buffer.totalRecords) return 0;
    const processed = data.buffer.processedRecords;
    const total = data.buffer.totalRecords;
    return Math.round((processed / total) * 100);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  if (loading) {
    return (
      <Card title={<><SyncOutlined spin /> GPS Real-Time Sync</>}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title={<><SyncOutlined /> GPS Real-Time Sync</>}>
        <Text type="danger">{error}</Text>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card 
      title={
        <Space>
          <Badge 
            status={data.systemStatus.isActive ? 'processing' : 'error'} 
            style={{ marginRight: 8 }}
          />
          <SyncOutlined spin={data.systemStatus.isActive} />
          <span>GPS Real-Time Sync</span>
        </Space>
      }
      extra={
        <Space>
          <Tag color={data.systemStatus.isActive ? 'green' : 'red'}>
            {data.systemStatus.isActive ? 'AKTIVAN' : 'NEAKTIVAN'}
          </Tag>
          {data.systemStatus.lastSync && (
            <Tooltip title={`Poslednja sinhronizacija: ${dayjs(data.systemStatus.lastSync).format('HH:mm:ss')}`}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(data.systemStatus.lastSync).fromNow()}
              </Text>
            </Tooltip>
          )}
        </Space>
      }
    >
      {/* Buffer Status */}
      <div style={{ marginBottom: 20 }}>
        <Space style={{ marginBottom: 8 }}>
          <DatabaseOutlined />
          <Text strong>Buffer Status</Text>
          <Badge 
            count={data.buffer.pendingRecords} 
            overflowCount={999999}
            style={{ backgroundColor: '#faad14' }}
          />
        </Space>
        
        <Progress 
          percent={getBufferProgress()} 
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
          status={data.buffer.errorRecords > 0 ? 'exception' : 'normal'}
        />
        
        <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
          <Col span={6}>
            <Statistic
              title="Ukupno"
              value={data.buffer.totalRecords}
              valueStyle={{ fontSize: 14 }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Za sync"
              value={data.buffer.pendingRecords}
              valueStyle={{ fontSize: 14, color: '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Procesirano"
              value={data.buffer.processedRecords}
              valueStyle={{ fontSize: 14, color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Greške"
              value={data.buffer.errorRecords}
              valueStyle={{ fontSize: 14, color: data.buffer.errorRecords > 0 ? '#ff4d4f' : '#999' }}
            />
          </Col>
        </Row>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Batch Configuration */}
      <div style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <TeamOutlined />
          <Text strong>Konfiguracija</Text>
        </Space>
        
        <Row gutter={[16, 0]}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Batch Size</Text>
              <div>
                <Text strong style={{ fontSize: 16 }}>{data.config.batchSize}</Text>
              </div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Worker-i</Text>
              <div>
                <TeamOutlined style={{ marginRight: 4 }} />
                <Text strong style={{ fontSize: 16 }}>{data.config.workerCount}</Text>
              </div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Worker Pool</Text>
              <div>
                <Tag color={data.config.useWorkerPool ? 'green' : 'default'}>
                  {data.config.useWorkerPool ? 'ON' : 'OFF'}
                </Tag>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Last Batch Info */}
      {data.lastBatch && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div>
            <Space style={{ marginBottom: 8 }}>
              <ClockCircleOutlined />
              <Text strong>Poslednji Batch #{data.lastBatch.number}</Text>
              {data.lastBatch.status === 'completed' ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
              )}
            </Space>
            
            <Row gutter={[16, 8]}>
              <Col span={12}>
                <div style={{ 
                  padding: '4px 8px', 
                  background: '#f0f2f5', 
                  borderRadius: '4px'
                }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Procesirano:</Text>
                  <div>
                    <Text strong>{data.lastBatch.processed} zapisa</Text>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ 
                  padding: '4px 8px', 
                  background: '#f0f2f5', 
                  borderRadius: '4px'
                }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Trajanje:</Text>
                  <div>
                    <Text strong>{formatDuration(data.lastBatch.duration)}</Text>
                  </div>
                </div>
              </Col>
            </Row>
            
            {data.lastBatch.recordsPerSecond > 0 && (
              <div style={{ 
                marginTop: 8,
                padding: '4px 8px', 
                background: '#e6f7ff', 
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <ThunderboltOutlined style={{ color: '#1890ff', marginRight: 4 }} />
                <Text type="secondary" style={{ fontSize: 11 }}>Brzina: </Text>
                <Text strong style={{ color: '#1890ff' }}>
                  {Math.round(data.lastBatch.recordsPerSecond)} rec/s
                </Text>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
};

export default GpsSyncWidget;