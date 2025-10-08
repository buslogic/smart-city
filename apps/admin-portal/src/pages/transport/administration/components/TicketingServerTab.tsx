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
  message,
} from 'antd';
import {
  ReloadOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { centralPointsService } from '../../../../services/centralPoints.service';

const { Title, Text } = Typography;

const TicketingServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const centralPoints = await centralPointsService.getAllTicketing();
      setData(centralPoints);
    } catch (error: any) {
      console.error('Greška pri učitavanju centralnih tačaka (Tiketing):', error);
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
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Naziv',
      dataIndex: 'cp_name',
      key: 'cp_name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Adresa',
      dataIndex: 'cp_address',
      key: 'cp_address',
    },
    {
      title: 'Grad',
      dataIndex: 'cp_city',
      key: 'cp_city',
    },
    {
      title: 'Telefon',
      dataIndex: 'cp_phone1',
      key: 'cp_phone1',
    },
    {
      title: 'Email',
      dataIndex: 'cp_email',
      key: 'cp_email',
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      align: 'center' as const,
      render: (active: number) => (
        <Tag color={active === 1 ? 'green' : 'red'}>
          {active === 1 ? 'Aktivna' : 'Neaktivna'}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <Card className="mb-4">
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <TagOutlined style={{ fontSize: 24, color: '#722ed1' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Tiketing Server</Title>
                <Text type="secondary">Centralne tačke na Tiketing serveru (READ-ONLY)</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              Osveži
            </Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `Ukupno ${total} centralnih tačaka`,
        }}
        locale={{
          emptyText: 'Nema podataka',
        }}
      />
    </div>
  );
};

export default TicketingServerTab;
