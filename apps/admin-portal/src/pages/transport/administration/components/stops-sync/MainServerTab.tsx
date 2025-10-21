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
  ReloadOutlined,
} from '@ant-design/icons';
import { stopsSyncService, Stop } from '../../../../../services/stopsSync.service';

const { Title, Text } = Typography;

const MainServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Stop[]>([]);
  const { message } = App.useApp();

  const loadData = async () => {
    setLoading(true);
    try {
      const stops = await stopsSyncService.getAllMain();
      setData(stops);
    } catch (error: any) {
      console.error('Greška pri učitavanju stajališta (Glavni):', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
              <EnvironmentOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Glavni Server</Title>
                <Text type="secondary">Lokalna stajališta u našoj bazi</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
            >
              Osveži
            </Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="uniqueId"
        loading={loading}
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

export default MainServerTab;
