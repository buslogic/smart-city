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
  Tooltip,
  message,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../hooks/usePermissions';
import { centralPointsService, CentralPoint } from '../../../../services/centralPoints.service';

const { Title, Text } = Typography;
const { confirm } = Modal;

const MainServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CentralPoint[]>([]);
  const { hasPermission } = usePermissions();

  const loadData = async () => {
    setLoading(true);
    try {
      const centralPoints = await centralPointsService.getAllMain();
      setData(centralPoints);
    } catch (error: any) {
      console.error('Greška pri učitavanju centralnih tačaka:', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = (record: CentralPoint) => {
    confirm({
      title: 'Potvrda brisanja',
      icon: <ExclamationCircleOutlined />,
      content: `Da li ste sigurni da želite da obrišete centralnu tačku "${record.name}"?`,
      okText: 'Da, obriši',
      okType: 'danger',
      cancelText: 'Otkaži',
      onOk: async () => {
        try {
          await centralPointsService.delete(record.id);
          message.success('Centralna tačka uspešno obrisana');
          loadData();
        } catch (error: any) {
          console.error('Greška pri brisanju:', error);
          message.error(error.response?.data?.message || 'Greška pri brisanju');
        }
      },
    });
  };

  const columns = [
    {
      title: 'Naziv',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Adresa',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: 'Grad',
      dataIndex: 'city',
      key: 'city',
    },
    {
      title: 'Telefon',
      dataIndex: 'phone1',
      key: 'phone1',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      align: 'center' as const,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Aktivna' : 'Neaktivna'}
        </Tag>
      ),
    },
    {
      title: 'Akcije',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: CentralPoint) => (
        <Space>
          {hasPermission('transport.administration.central_points:update') && (
            <Tooltip title="Izmeni">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => message.info('Edit forma - biće implementirana')}
              />
            </Tooltip>
          )}
          {hasPermission('transport.administration.central_points:delete') && (
            <Tooltip title="Obriši">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              />
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
              <EnvironmentOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Glavni Server</Title>
                <Text type="secondary">Centralne tačke na glavnom serveru</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                Osveži
              </Button>
              {hasPermission('transport.administration.central_points:create') && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => message.info('Create forma - biće implementirana')}
                >
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

export default MainServerTab;
