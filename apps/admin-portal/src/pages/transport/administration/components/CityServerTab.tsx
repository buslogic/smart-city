import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../hooks/usePermissions';

const { Title, Text } = Typography;

interface CentralPoint {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  type: string;
  isActive: boolean;
  createdAt: string;
}

const CityServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CentralPoint[]>([]);
  const { hasPermission } = usePermissions();

  const columns = [
    {
      title: 'Naziv',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Kod',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: 'Tip',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="green">{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center' as const,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Aktivna' : 'Neaktivna'}
        </Tag>
      ),
    },
    {
      title: 'Akcije',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: CentralPoint) => (
        <Space>
          {hasPermission('transport.administration.central_points.city:update') && (
            <Tooltip title="Izmeni">
              <Button type="text" icon={<EditOutlined />} />
            </Tooltip>
          )}
          {hasPermission('transport.administration.central_points.city:delete') && (
            <Tooltip title="Obriši">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          )}
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
              <GlobalOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Gradski Server</Title>
                <Text type="secondary">Centralne tačke na Gradskom serveru</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => setLoading(true)}>
                Osveži
              </Button>
              {hasPermission('transport.administration.central_points.city:create') && (
                <Button type="primary" icon={<PlusOutlined />}>
                  Dodaj
                </Button>
              )}
            </Space>
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

export default CityServerTab;
