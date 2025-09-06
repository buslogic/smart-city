import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Tag,
  Tooltip,
  message,
  InputNumber,
  Switch,
  Transfer,
  Badge,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { api } from '../../services/api';

const { Text, Title } = Typography;

interface SlowSyncVehicle {
  id: number;
  vehicleId: number;
  enabled: boolean;
  priority: number;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  totalSyncCount: number;
  successfulSyncCount: number;
  failedSyncCount: number;
  totalPointsProcessed: string;
  lastError: string | null;
  vehicle: {
    id: number;
    garageNumber: string;
    vehicleModel: string;
    registrationNumber: string;
  };
}

interface AvailableVehicle {
  id: number;
  garageNumber: string;
  vehicleModel: string;
  registrationNumber: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SmartSlowSyncVehicleManager: React.FC<Props> = ({ visible, onClose }) => {
  const [vehicles, setVehicles] = useState<SlowSyncVehicle[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<AvailableVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [priority, setPriority] = useState(100);
  const [editingVehicle, setEditingVehicle] = useState<SlowSyncVehicle | null>(null);

  useEffect(() => {
    if (visible) {
      fetchVehicles();
    }
  }, [visible]);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/legacy-sync/slow-sync/vehicles');
      setVehicles(response.data);
    } catch (error: any) {
      message.error('Greška pri učitavanju vozila');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableVehicles = async () => {
    try {
      const response = await api.get('/api/legacy-sync/slow-sync/available-vehicles');
      setAvailableVehicles(response.data);
    } catch (error: any) {
      message.error('Greška pri učitavanju dostupnih vozila');
    }
  };

  const handleAddVehicles = async () => {
    if (targetKeys.length === 0) {
      message.warning('Molimo selektujte vozila');
      return;
    }

    setLoading(true);
    try {
      const vehicleIds = targetKeys.map(key => parseInt(key));
      const response = await api.post('/api/legacy-sync/slow-sync/vehicles', {
        vehicleIds,
        priority,
      });
      
      message.success(response.data.message);
      setAddModalVisible(false);
      setTargetKeys([]);
      await fetchVehicles();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri dodavanju vozila');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVehicle = async (vehicleId: number, data: { enabled?: boolean; priority?: number }) => {
    try {
      await api.patch(`/api/legacy-sync/slow-sync/vehicles/${vehicleId}`, data);
      message.success('Postavke vozila ažurirane');
      await fetchVehicles();
    } catch (error: any) {
      message.error('Greška pri ažuriranju vozila');
    }
  };

  const handleRemoveVehicle = async (vehicleId: number) => {
    try {
      await api.delete(`/api/legacy-sync/slow-sync/vehicles/${vehicleId}`);
      message.success('Vozilo uklonjeno iz Smart Slow Sync');
      await fetchVehicles();
    } catch (error: any) {
      message.error('Greška pri uklanjanju vozila');
    }
  };

  const columns: ColumnsType<SlowSyncVehicle> = [
    {
      title: 'Garažni broj',
      dataIndex: ['vehicle', 'garageNumber'],
      key: 'garageNumber',
      width: 120,
      render: (text) => (
        <Tag icon={<CarOutlined />} color="blue">
          {text}
        </Tag>
      ),
      sorter: (a, b) => a.vehicle.garageNumber.localeCompare(b.vehicle.garageNumber),
    },
    {
      title: 'Registracija',
      dataIndex: ['vehicle', 'registrationNumber'],
      key: 'registrationNumber',
      width: 120,
      render: (text) => text || <Tag color="default">N/A</Tag>,
    },
    {
      title: 'Model',
      dataIndex: ['vehicle', 'vehicleModel'],
      key: 'vehicleModel',
      width: 150,
    },
    {
      title: 'ID (MySQL)',
      dataIndex: ['vehicle', 'id'],
      key: 'vehicleId',
      width: 80,
      render: (id) => (
        <Text type="secondary">#{id}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleUpdateVehicle(record.vehicleId, { enabled: checked })}
          checkedChildren="ON"
          unCheckedChildren="OFF"
        />
      ),
    },
    {
      title: 'Prioritet',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority, record) => (
        <InputNumber
          value={priority}
          min={1}
          max={1000}
          onChange={(value) => value && handleUpdateVehicle(record.vehicleId, { priority: value })}
          size="small"
        />
      ),
    },
    {
      title: 'Poslednji sync',
      dataIndex: 'lastSyncAt',
      key: 'lastSyncAt',
      width: 150,
      render: (date) => {
        if (!date) return <Tag>Nikad</Tag>;
        return (
          <Tooltip title={dayjs(date).format('DD.MM.YYYY HH:mm:ss')}>
            <Text type="secondary">{dayjs(date).fromNow()}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Statistike',
      key: 'stats',
      width: 200,
      render: (_, record) => (
        <div style={{ lineHeight: '1.2' }}>
          <div>
            <Badge 
              status="success" 
              text={`Uspešno: ${record.successfulSyncCount}`} 
            />
          </div>
          <div>
            <Badge 
              status="error" 
              text={`Neuspešno: ${record.failedSyncCount}`} 
            />
          </div>
          <div>
            <Badge 
              status="processing" 
              text={`GPS tačaka: ${parseInt(record.totalPointsProcessed).toLocaleString()}`} 
            />
          </div>
        </div>
      ),
    },
    {
      title: 'Poslednja greška',
      dataIndex: 'lastError',
      key: 'lastError',
      width: 200,
      render: (error) => {
        if (!error) return <Tag color="green">Nema grešaka</Tag>;
        return (
          <Tooltip title={error}>
            <Tag color="red">Ima grešku</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Akcije',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="Ukloniti vozilo iz Smart Slow Sync?"
            onConfirm={() => handleRemoveVehicle(record.vehicleId)}
            okText="Da"
            cancelText="Ne"
          >
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const getStatistics = () => {
    const enabled = vehicles.filter(v => v.enabled).length;
    const totalSync = vehicles.reduce((sum, v) => sum + v.totalSyncCount, 0);
    const totalPoints = vehicles.reduce((sum, v) => sum + parseInt(v.totalPointsProcessed), 0);
    
    return { enabled, totalSync, totalPoints };
  };

  const stats = getStatistics();

  return (
    <>
      <Modal
        title={
          <Space>
            <CarOutlined />
            <span>Upravljanje vozilima za Smart Slow Sync</span>
          </Space>
        }
        open={visible}
        onCancel={onClose}
        width={1600}
        footer={[
          <Button key="close" onClick={onClose}>
            Zatvori
          </Button>,
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              fetchAvailableVehicles();
              setAddModalVisible(true);
            }}
          >
            Dodaj vozila
          </Button>,
        ]}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Aktivna za sync"
                value={stats.enabled}
                suffix={`/ ${vehicles.length}`}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Ukupno sync-ova"
                value={stats.totalSync}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="Ukupno GPS tačaka"
                value={stats.totalPoints}
                prefix={<ThunderboltOutlined />}
                formatter={(value) => {
                  const num = value as number;
                  if (num >= 1000000000) {
                    return `${(num / 1000000000).toFixed(2)}B`;
                  }
                  if (num >= 1000000) {
                    return `${(num / 1000000).toFixed(2)}M`;
                  }
                  if (num >= 1000) {
                    return `${(num / 1000).toFixed(2)}K`;
                  }
                  return num.toString();
                }}
              />
            </Card>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={vehicles}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Ukupno ${total} vozila`,
          }}
        />
      </Modal>

      {/* Modal za dodavanje vozila */}
      <Modal
        title="Dodaj vozila u Smart Slow Sync"
        open={addModalVisible}
        onOk={handleAddVehicles}
        onCancel={() => {
          setAddModalVisible(false);
          setTargetKeys([]);
        }}
        width={900}
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>Prioritet za nova vozila:</Text>
            <InputNumber
              value={priority}
              min={1}
              max={1000}
              onChange={(value) => setPriority(value || 100)}
              style={{ marginLeft: 16, width: 120 }}
            />
            <Text type="secondary" style={{ marginLeft: 8 }}>
              (viši broj = viši prioritet)
            </Text>
          </div>

          <Transfer
            dataSource={availableVehicles.map(v => ({
              key: v.id.toString(),
              title: `${v.garageNumber} - ${v.registrationNumber || 'N/A'}`,
              description: `${v.vehicleModel} | ID: #${v.id}`,
              disabled: false,
            }))}
            titles={['Dostupna aktivna vozila', 'Vozila za Slow Sync']}
            targetKeys={targetKeys}
            selectedKeys={selectedKeys}
            onChange={(keys) => setTargetKeys(keys as string[])}
            onSelectChange={(sourceKeys, targetSelectedKeys) => {
              setSelectedKeys([...sourceKeys, ...targetSelectedKeys] as string[]);
            }}
            render={(item) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Space>
                  <CarOutlined />
                  <span>{item.title}</span>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.description}
                </Text>
              </div>
            )}
            listStyle={{
              width: 400,
              height: 400,
            }}
            showSearch
            filterOption={(inputValue, option) =>
              option.title.toLowerCase().includes(inputValue.toLowerCase()) ||
              option.description.toLowerCase().includes(inputValue.toLowerCase())
            }
          />
        </Space>
      </Modal>
    </>
  );
};

export default SmartSlowSyncVehicleManager;