import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  App,
} from 'antd';
import {
  EnvironmentOutlined,
  SyncOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { stopsSyncService, Stop } from '../../../../../services/stopsSync.service';

const { Title, Text } = Typography;

const TicketingServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<Stop[]>([]);
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  const loadData = async () => {
    setLoading(true);
    try {
      const stops = await stopsSyncService.getAllTicketing();
      setData(stops);
    } catch (error: any) {
      console.error('Greška pri učitavanju stajališta (Tiketing):', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = () => {
    modal.confirm({
      title: 'Potvrda sinhronizacije',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Da li ste sigurni da želite da pokrenete sinhronizaciju sa Tiketing servera?</p>
          <p>
            <Text type="warning">
              Napomena: Stajališta će biti sinhronizovana sa glavnim serverom.
            </Text>
          </p>
        </div>
      ),
      okText: 'Da, pokreni sinhronizaciju',
      okType: 'primary',
      cancelText: 'Otkaži',
      onOk: async () => {
        setSyncing(true);
        try {
          const result = await stopsSyncService.syncFromTicketing();
          message.success(result.message);
          loadData(); // Reload data after sync
        } catch (error: any) {
          console.error('Greška pri sinhronizaciji:', error);
          message.error(
            error.response?.data?.message || 'Greška pri sinhronizaciji podataka'
          );
        } finally {
          setSyncing(false);
        }
      },
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'uniqueId',
      key: 'uniqueId',
      width: 80,
      sorter: (a: Stop, b: Stop) => a.uniqueId.localeCompare(b.uniqueId),
    },
    {
      title: 'Naziv stajališta',
      dataIndex: 'stationName',
      key: 'stationName',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'GPS Koordinate',
      key: 'coordinates',
      render: (_: any, record: Stop) => (
        <Text type="secondary">
          {record.gpsx.toFixed(6)}, {record.gpsy.toFixed(6)}
        </Text>
      ),
    },
    {
      title: 'Opseg (m)',
      dataIndex: 'range',
      key: 'range',
      width: 100,
      align: 'center' as const,
    },
    {
      title: 'Grupa',
      dataIndex: 'groupId',
      key: 'groupId',
      width: 80,
      align: 'center' as const,
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: Stop) => (
        <Space>
          {record.changed && <Tag color="orange">Promenjen</Tag>}
          {record.mainOperator && <Tag color="blue">Glavni</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card className="mb-4">
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <EnvironmentOutlined style={{ fontSize: 24, color: '#722ed1' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Tiketing Server</Title>
                <Text type="secondary">Stajališta na Tiketing serveru (READ-ONLY)</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadData}
                loading={loading}
                disabled={syncing}
              >
                Osveži
              </Button>
              {hasPermission('transport.administration.stops_sync.ticketing:sync') && (
                <Button
                  type="primary"
                  icon={<SyncOutlined spin={syncing} />}
                  onClick={handleSync}
                  loading={syncing}
                  disabled={loading}
                >
                  Sinhronizacija
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="uniqueId"
        loading={loading || syncing}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `Ukupno ${total} stajališta`,
        }}
        locale={{
          emptyText: 'Nema podataka',
        }}
      />
    </div>
  );
};

export default TicketingServerTab;
