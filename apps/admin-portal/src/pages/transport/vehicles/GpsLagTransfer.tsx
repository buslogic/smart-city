import React, { useEffect, useState } from 'react';
import { Card, Typography, Statistic, Row, Col, Progress, Table, Tag, Alert, Spin, message } from 'antd';
import {
  DatabaseOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  GpsLagMonitoringService,
  ProcessingOverview,
  HealthCheck,
  VehicleProgress
} from '../../../services/gps-lag-monitoring.service';

const { Title, Text } = Typography;

const GpsLagTransfer: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<ProcessingOverview | null>(null);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [vehicleProgress, setVehicleProgress] = useState<VehicleProgress[]>([]);

  const formatProcessingLag = (lag: any): string => {
    if (typeof lag === 'string') return lag;
    if (typeof lag === 'object' && lag !== null) {
      return `${lag.days} days ${lag.hours}:${String(lag.minutes).padStart(2, '0')}:${String(lag.seconds).padStart(2, '0')}`;
    }
    return '0';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await GpsLagMonitoringService.getDashboard();

        // Convert string numbers to actual numbers
        const overview = {
          ...data.overview,
          total_raw_points: Number(data.overview.total_raw_points),
          total_vehicles: Number(data.overview.total_vehicles),
          total_processed_points: Number(data.overview.total_processed_points),
          processed_vehicles: Number(data.overview.processed_vehicles),
          total_outliers: Number(data.overview.total_outliers),
          processing_percentage: Number(data.overview.processing_percentage),
          outlier_percentage: Number(data.overview.outlier_percentage),
          completed_batches: Number(data.overview.completed_batches),
          failed_batches: Number(data.overview.failed_batches),
          active_batches: Number(data.overview.active_batches),
        };

        const vehicleProgress = data.vehicleProgress.map(v => ({
          ...v,
          vehicle_id: Number(v.vehicle_id),
          progress_percentage: Number(v.progress_percentage),
          processed_points: Number(v.processed_points),
          remaining_points: Number(v.remaining_points),
          outlier_percentage: Number(v.outlier_percentage),
        }));

        setOverview(overview);
        setHealthChecks(data.healthChecks);
        setVehicleProgress(vehicleProgress);
      } catch (error) {
        console.error('Error fetching GPS LAG monitoring data:', error);
        message.error('Greška pri učitavanju podataka. Pokušajte ponovo.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Auto-refresh svakih 30 sekundi
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'WARNING':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'CRITICAL':
        return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      default:
        return <SyncOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK':
        return 'success';
      case 'WARNING':
        return 'warning';
      case 'CRITICAL':
        return 'error';
      default:
        return 'processing';
    }
  };

  const vehicleColumns = [
    {
      title: 'Vehicle ID',
      dataIndex: 'vehicle_id',
      key: 'vehicle_id',
    },
    {
      title: 'Garage No',
      dataIndex: 'garage_no',
      key: 'garage_no',
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (record: VehicleProgress) => (
        <Progress
          percent={parseFloat(record.progress_percentage.toFixed(2))}
          size="small"
          status={record.progress_percentage === 100 ? 'success' : 'active'}
        />
      ),
    },
    {
      title: 'Processed',
      dataIndex: 'processed_points',
      key: 'processed_points',
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: 'Remaining',
      dataIndex: 'remaining_points',
      key: 'remaining_points',
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: 'Outliers',
      dataIndex: 'outlier_percentage',
      key: 'outlier_percentage',
      render: (val: number) => `${val.toFixed(2)}%`,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <DatabaseOutlined className="text-3xl text-blue-500" />
          <Title level={2} className="mb-0">GPS LAG Transfer Dashboard</Title>
        </div>
        <Text type="secondary">
          Real-time monitoring GPS batch procesiranja iz gps_data u gps_data_lag_filtered tabelu
        </Text>
      </Card>

      {/* Overview Statistics */}
      {overview && (
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total GPS Points"
                value={overview.total_raw_points}
                formatter={(value) => value.toLocaleString()}
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Processed Points"
                value={overview.total_processed_points}
                formatter={(value) => value.toLocaleString()}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                suffix={`(${overview.processing_percentage.toFixed(2)}%)`}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Outliers Detected"
                value={overview.total_outliers}
                formatter={(value) => value.toLocaleString()}
                prefix={<WarningOutlined style={{ color: '#faad14' }} />}
                suffix={`(${overview.outlier_percentage.toFixed(2)}%)`}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Processing Lag"
                value={formatProcessingLag(overview.processing_lag)}
                prefix={<ClockCircleOutlined style={{ color: '#f5222d' }} />}
                valueStyle={{ fontSize: '16px' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Progress Bar */}
      {overview && (
        <Card className="mb-6">
          <Title level={4}>Processing Progress</Title>
          <Progress
            percent={parseFloat(overview.processing_percentage.toFixed(2))}
            status={overview.processing_percentage === 100 ? 'success' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div className="mt-4 flex justify-between text-sm text-gray-600">
            <span>Completed Batches: {overview.completed_batches}</span>
            <span>Failed Batches: {overview.failed_batches}</span>
            <span>Active Batches: {overview.active_batches}</span>
          </div>
        </Card>
      )}

      {/* Health Checks */}
      <Card title="System Health Checks" className="mb-6">
        {healthChecks.map((check, index) => (
          <Alert
            key={index}
            message={
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {getStatusIcon(check.status)}
                  <strong>{check.check_name}</strong>
                </span>
                <Tag color={getStatusColor(check.status)}>{check.status}</Tag>
              </div>
            }
            description={check.message}
            type={check.status === 'OK' ? 'success' : check.status === 'WARNING' ? 'warning' : 'error'}
            showIcon={false}
            className="mb-2"
          />
        ))}
      </Card>

      {/* Vehicle Progress Table */}
      {vehicleProgress.length > 0 && (
        <Card title="Vehicle Processing Progress (Top 10 Slowest)">
          <Table
            dataSource={vehicleProgress}
            columns={vehicleColumns}
            rowKey="vehicle_id"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {vehicleProgress.length === 0 && (
        <Card>
          <Alert
            message="No Vehicle Data"
            description="Započnite procesiranje GPS podataka pomoću backend batch processor-a"
            type="info"
            showIcon
          />
        </Card>
      )}
    </div>
  );
};

export default GpsLagTransfer;
