import React from 'react';
import {
  Modal,
  Progress,
  Alert,
  Descriptions,
  Typography,
  Space,
  Tag,
  Button,
  Card,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface BatchSyncProgress {
  success: number;
  skipped: number;
  errors: number;
  totalBatches: number;
  processedBatches: number;
  processedUsers: number;
  totalUsers: number;
  currentBatch?: number;
  batchResult?: {
    success: number;
    skipped: number;
    errors: number;
  };
  batchDuration?: number;
  estimatedTimeRemaining?: number;
  error?: string;
}

interface BatchSyncProgressModalProps {
  visible: boolean;
  onClose: () => void;
  progress: BatchSyncProgress | null;
  isCompleted: boolean;
  isError: boolean;
}

export const BatchSyncProgressModal: React.FC<BatchSyncProgressModalProps> = ({
  visible,
  onClose,
  progress,
  isCompleted,
  isError,
}) => {
  const getProgressPercent = () => {
    if (!progress) return 0;
    return Math.round((progress.processedUsers / progress.totalUsers) * 100);
  };

  const getBatchPercent = () => {
    if (!progress) return 0;
    return Math.round((progress.processedBatches / progress.totalBatches) * 100);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusColor = () => {
    if (isError) return 'red';
    if (isCompleted) return 'green';
    return 'blue';
  };

  const getStatusText = () => {
    if (isError) return 'Greška tokom sinhronizacije';
    if (isCompleted) return 'Sinhronizacija završena';
    return 'Sinhronizacija u toku...';
  };

  return (
    <Modal
      title={
        <Space>
          <SyncOutlined spin={!isCompleted && !isError} />
          <span>Batch sinhronizacija korisnika</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button
          key="close"
          type={isCompleted || isError ? "primary" : "default"}
          onClick={onClose}
        >
          {isCompleted || isError ? 'Zatvori' : 'Zatvori (sync će nastaviti)'}
        </Button>,
      ]}
      width={800}
      maskClosable={false}
    >
      {progress && (
        <>
          {/* Status Alert */}
          <Alert
            message={getStatusText()}
            type={isError ? 'error' : isCompleted ? 'success' : 'info'}
            showIcon
            icon={
              isError ? <CloseCircleOutlined /> :
              isCompleted ? <CheckCircleOutlined /> :
              <SyncOutlined spin />
            }
            className="mb-6"
          />

          {/* Overall Progress */}
          <Card className="mb-4">
            <Title level={5}>
              <UserOutlined /> Ukupan progres korisnika
            </Title>
            <Progress
              percent={getProgressPercent()}
              status={isError ? 'exception' : isCompleted ? 'success' : 'active'}
              strokeColor={getStatusColor()}
              format={() => `${progress.processedUsers}/${progress.totalUsers}`}
            />
            <div className="mt-2 text-center">
              <Text type="secondary">
                {getProgressPercent()}% završeno ({progress.processedUsers} od {progress.totalUsers} korisnika)
              </Text>
            </div>
          </Card>

          {/* Batch Progress */}
          <Card className="mb-4">
            <Title level={5}>
              <TeamOutlined /> Progres batch-ova
            </Title>
            <Progress
              percent={getBatchPercent()}
              status={isError ? 'exception' : isCompleted ? 'success' : 'active'}
              strokeColor={getStatusColor()}
              format={() => `${progress.processedBatches}/${progress.totalBatches}`}
            />
            <div className="mt-2 text-center">
              <Text type="secondary">
                Batch {progress.processedBatches} od {progress.totalBatches} završen
              </Text>
            </div>
          </Card>

          {/* Current Batch Info */}
          {progress.currentBatch && !isCompleted && (
            <Alert
              message={`Obrađuje se batch ${progress.currentBatch}/${progress.totalBatches}`}
              description={
                progress.batchResult && (
                  <div>
                    Poslednji batch: {progress.batchResult.success} uspešno, {progress.batchResult.skipped} preskočeno, {progress.batchResult.errors} grešaka
                    {progress.batchDuration && ` (${progress.batchDuration}ms)`}
                  </div>
                )
              }
              type="info"
              showIcon
              className="mb-4"
            />
          )}

          {/* Statistics */}
          <Row gutter={16} className="mb-4">
            <Col span={6}>
              <Card>
                <Statistic
                  title="Uspešno"
                  value={progress.success}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Preskočeno"
                  value={progress.skipped}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Greške"
                  value={progress.errors}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Preostalo vreme"
                  value={progress.estimatedTimeRemaining ? formatTime(progress.estimatedTimeRemaining) : '-'}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* Batch Details */}
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Batch veličina">50 korisnika</Descriptions.Item>
            <Descriptions.Item label="Ukupno batch-ova">{progress.totalBatches}</Descriptions.Item>
            <Descriptions.Item label="Obrađeni batch-ovi">{progress.processedBatches}</Descriptions.Item>
            <Descriptions.Item label="Preostali batch-ovi">{progress.totalBatches - progress.processedBatches}</Descriptions.Item>
          </Descriptions>

          {/* Error Details */}
          {progress.error && (
            <Alert
              message="Greška u batch-u"
              description={progress.error}
              type="error"
              showIcon
              className="mt-4"
            />
          )}

          {/* Completion Summary */}
          {isCompleted && (
            <Alert
              message="Sinhronizacija završena"
              description={
                <div>
                  <p><strong>Rezultati:</strong></p>
                  <ul>
                    <li>Uspešno sinhronizovano: <Tag color="green">{progress.success}</Tag> korisnika</li>
                    <li>Preskočeno (već postoje): <Tag color="orange">{progress.skipped}</Tag> korisnika</li>
                    <li>Greške: <Tag color="red">{progress.errors}</Tag> korisnika</li>
                    <li>Obrađeno batch-ova: <Tag color="blue">{progress.processedBatches}/{progress.totalBatches}</Tag></li>
                  </ul>
                </div>
              }
              type="success"
              showIcon
              className="mt-4"
            />
          )}
        </>
      )}
    </Modal>
  );
};