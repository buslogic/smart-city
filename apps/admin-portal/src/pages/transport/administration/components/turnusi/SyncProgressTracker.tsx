import React, { useState, useEffect, useRef } from 'react';
import { Card, Progress, Typography, Row, Col, Statistic, Space, Tag } from 'antd';
import {
  ClockCircleOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { turnusiService, TurnusSyncLog } from '../../../../../services/turnusi.service';

const { Text, Title } = Typography;

interface SyncProgressTrackerProps {
  syncId: string;
  onComplete: (syncLog: TurnusSyncLog) => void;
  onError: (error: string) => void;
}

const SyncProgressTracker: React.FC<SyncProgressTrackerProps> = ({
  syncId,
  onComplete,
  onError,
}) => {
  const [syncLog, setSyncLog] = useState<TurnusSyncLog | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState<string>('Izračunavanje...');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(Date.now());

  useEffect(() => {
    // Start polling for sync status
    fetchSyncStatus();
    intervalRef.current = setInterval(fetchSyncStatus, 2000); // Poll every 2 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [syncId]);

  const fetchSyncStatus = async () => {
    try {
      const log = await turnusiService.getSyncStatus(syncId);
      setSyncLog(log);

      // Calculate speed (records per second)
      const now = Date.now();
      const timeDiff = (now - lastTimestampRef.current) / 1000; // seconds
      const recordsDiff = log.processedRecords - lastProcessedRef.current;

      if (timeDiff > 0 && recordsDiff > 0) {
        const currentSpeed = Math.round(recordsDiff / timeDiff);
        setSpeed(currentSpeed);

        // Calculate estimated time left
        const remainingRecords = log.totalRecords - log.processedRecords;
        if (currentSpeed > 0) {
          const secondsLeft = Math.round(remainingRecords / currentSpeed);
          setEstimatedTimeLeft(formatTime(secondsLeft));
        }
      }

      lastProcessedRef.current = log.processedRecords;
      lastTimestampRef.current = now;

      // Check if sync is complete
      if (log.status === 'completed' || log.status === 'failed') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        if (log.status === 'completed') {
          onComplete(log);
        } else {
          onError(log.errorMessage || 'Sync failed');
        }
      }
    } catch (error: any) {
      console.error('Error fetching sync status:', error);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      onError('Failed to fetch sync status');
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const calculateProgress = (): number => {
    if (!syncLog || syncLog.totalRecords === 0) return 0;
    return Math.round((syncLog.processedRecords / syncLog.totalRecords) * 100);
  };

  const getStatusTag = () => {
    if (!syncLog) return null;

    switch (syncLog.status) {
      case 'in_progress':
        return (
          <Tag icon={<LoadingOutlined />} color="processing">
            U toku
          </Tag>
        );
      case 'completed':
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Završeno
          </Tag>
        );
      case 'failed':
        return (
          <Tag icon={<ExclamationCircleOutlined />} color="error">
            Greška
          </Tag>
        );
      default:
        return (
          <Tag color="default">
            {syncLog.status}
          </Tag>
        );
    }
  };

  if (!syncLog) {
    return (
      <Card>
        <Space>
          <LoadingOutlined />
          <Text>Učitavanje statusa sinhronizacije...</Text>
        </Space>
      </Card>
    );
  }

  const progress = calculateProgress();

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={5} style={{ margin: 0 }}>
              Sinhronizacija u toku
            </Title>
          </Col>
          <Col>{getStatusTag()}</Col>
        </Row>

        {/* Progress Bar */}
        <div>
          <Progress
            percent={progress}
            status={syncLog.status === 'failed' ? 'exception' : 'active'}
            strokeColor={{
              from: '#108ee9',
              to: '#87d068',
            }}
          />
          <Text type="secondary">
            {syncLog.processedRecords.toLocaleString()} /{' '}
            {syncLog.totalRecords.toLocaleString()} rekorda
          </Text>
        </div>

        {/* Statistics */}
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="Brzina"
              value={speed}
              suffix="rec/s"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ fontSize: 20 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Preostalo vreme"
              value={estimatedTimeLeft}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ fontSize: 20 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Upsertovano"
              value={syncLog.upsertedRecords.toLocaleString()}
              valueStyle={{ fontSize: 20, color: '#52c41a' }}
            />
          </Col>
        </Row>

        {/* Additional Info */}
        <Row gutter={16}>
          <Col span={12}>
            <Text type="secondary">Greške: </Text>
            <Text strong style={{ color: syncLog.errorRecords > 0 ? '#ff4d4f' : undefined }}>
              {syncLog.errorRecords}
            </Text>
          </Col>
          <Col span={12}>
            <Text type="secondary">Batch: </Text>
            <Text strong>{syncLog.lastProcessedBatch}</Text>
          </Col>
        </Row>

        {/* Error Message */}
        {syncLog.errorMessage && (
          <div style={{ marginTop: 8 }}>
            <Text type="danger">{syncLog.errorMessage}</Text>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default SyncProgressTracker;
