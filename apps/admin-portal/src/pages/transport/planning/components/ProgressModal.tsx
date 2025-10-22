import React from 'react';
import { Modal, Progress, Typography, List, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface ProgressData {
  current: number;
  total: number;
  status: 'processing' | 'success' | 'error';
  results: Array<{
    date: string;
    status: 'success' | 'error';
    departuresCount?: number;
    error?: string;
  }>;
}

interface ProgressModalProps {
  visible: boolean;
  progress: ProgressData;
  onClose?: () => void;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({ visible, progress, onClose }) => {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const isCompleted = progress.current === progress.total;

  const successCount = progress.results.filter((r) => r.status === 'success').length;
  const errorCount = progress.results.filter((r) => r.status === 'error').length;

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ClockCircleOutlined className="text-blue-500" />
          <Title level={4} className="mb-0">
            {isCompleted ? 'Mesečno planiranje završeno' : 'Mesečno planiranje u toku...'}
          </Title>
        </div>
      }
      open={visible}
      onCancel={onClose}
      onOk={onClose}
      footer={isCompleted && onClose ? undefined : null}
      width={700}
      closable={isCompleted}
      maskClosable={false}
    >
      <div className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between mb-2">
            <Text strong>Napredak:</Text>
            <Text>
              {progress.current} / {progress.total} dana
            </Text>
          </div>
          <Progress
            percent={percentage}
            status={
              progress.status === 'error' ? 'exception' : progress.status === 'success' ? 'success' : 'active'
            }
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
        </div>

        {/* Sumarni rezultati */}
        {progress.results.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-3 rounded">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Uspešno:</span>
                <Tag color="success" className="text-lg">
                  <CheckCircleOutlined /> {successCount}
                </Tag>
              </div>
            </div>
            <div className="bg-red-50 p-3 rounded">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Greške:</span>
                <Tag color="error" className="text-lg">
                  <CloseCircleOutlined /> {errorCount}
                </Tag>
              </div>
            </div>
          </div>
        )}

        {/* Detaljna lista */}
        {progress.results.length > 0 && (
          <div>
            <Text strong className="mb-2 block">
              Detalji:
            </Text>
            <div className="max-h-60 overflow-y-auto border rounded p-2">
              <List
                size="small"
                dataSource={progress.results}
                renderItem={(item) => (
                  <List.Item>
                    <div className="flex items-center justify-between w-full">
                      <span>
                        {item.status === 'success' ? (
                          <CheckCircleOutlined className="text-green-500 mr-2" />
                        ) : (
                          <CloseCircleOutlined className="text-red-500 mr-2" />
                        )}
                        {item.date}
                      </span>
                      {item.status === 'success' ? (
                        <Text type="secondary">{item.departuresCount} polazaka</Text>
                      ) : (
                        <Text type="danger" className="text-xs">
                          {item.error}
                        </Text>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            </div>
          </div>
        )}

        {/* Status poruka */}
        {!isCompleted && (
          <div className="text-center text-gray-500">
            <ClockCircleOutlined className="mr-2" />
            Molimo sačekajte dok se ne završi kreiranje rasporeda...
          </div>
        )}
      </div>
    </Modal>
  );
};
