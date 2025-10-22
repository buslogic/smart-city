import React from 'react';
import { Modal, Typography, Button, Space, Alert, List, Tag } from 'antd';
import { ExclamationCircleOutlined, DeleteOutlined, StopOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface ConflictResolutionModalProps {
  visible: boolean;
  conflictDates: string[];
  totalDays: number;
  driverName?: string;
  onOverwrite: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  conflictDates,
  totalDays,
  driverName,
  onOverwrite,
  onSkip,
  onCancel,
}) => {
  const conflictCount = conflictDates.length;
  const availableDays = totalDays - conflictCount;

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ExclamationCircleOutlined className="text-orange-500 text-xl" />
          <Title level={4} className="mb-0">
            Konflikt - Vozač već ima raspored
          </Title>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
    >
      <div className="space-y-4">
        {/* Upozorenje */}
        <Alert
          message="Pronađeni su postojeći rasporedi"
          description={
            <div>
              <Paragraph className="mb-2">
                Vozač <Text strong>{driverName}</Text> već ima raspored za <Text strong>{conflictCount}</Text> od{' '}
                <Text strong>{totalDays}</Text> dana u izabranom mesecu.
              </Paragraph>
              <Paragraph className="mb-0">
                Preostalo <Text strong>{availableDays}</Text> dana može biti isplanirano.
              </Paragraph>
            </div>
          }
          type="warning"
          showIcon
        />

        {/* Lista conflict datuma */}
        {conflictDates.length <= 10 ? (
          <div>
            <Text strong className="block mb-2">
              Datumi sa postojećim rasporedom:
            </Text>
            <div className="flex flex-wrap gap-2">
              {conflictDates.map((date) => (
                <Tag key={date} color="orange">
                  {date}
                </Tag>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <Text strong className="block mb-2">
              Datumi sa postojećim rasporedom ({conflictCount}):
            </Text>
            <div className="max-h-40 overflow-y-auto border rounded p-2">
              <List
                size="small"
                dataSource={conflictDates}
                renderItem={(date) => (
                  <List.Item>
                    <Tag color="orange">{date}</Tag>
                  </List.Item>
                )}
              />
            </div>
          </div>
        )}

        {/* Akcije */}
        <div>
          <Text strong className="block mb-3">
            Odaberite akciju:
          </Text>
          <Space direction="vertical" className="w-full" size="middle">
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              size="large"
              block
              onClick={onOverwrite}
            >
              Prepiši sve ({totalDays} dana)
            </Button>
            <div className="text-xs text-gray-500 -mt-2 pl-4">
              Obriše postojeće rasporede i kreira nove za svih {totalDays} dana
            </div>

            <Button type="default" icon={<StopOutlined />} size="large" block onClick={onSkip}>
              Preskoči postojeće ({availableDays} dana)
            </Button>
            <div className="text-xs text-gray-500 -mt-2 pl-4">
              Zadrži postojeće rasporede, kreira samo za preostalih {availableDays} dana
            </div>

            <Button size="large" block onClick={onCancel}>
              Otkaži
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
};
