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
  ReloadOutlined,
  ShoppingOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { priceVariationsService } from '../../../../../services/price-variations.service';

const { Title, Text } = Typography;

const TicketingServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  const loadData = async (page = 1, pageSize = 50) => {
    setLoading(true);
    try {
      const result = await priceVariationsService.getAllTicketing(page, pageSize);
      setData(result.data);
      setPagination({
        current: result.page,
        pageSize: result.limit,
        total: result.total,
      });
    } catch (error: any) {
      console.error('❌ Greška pri učitavanju varijacija (Tiketing):', error);
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
              Napomena: Rekodi će biti sinhronizovani sa glavnim serverom.
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
          const result = await priceVariationsService.syncFromTicketing();
          message.success(result.message);
          loadData(1, pagination.pageSize); // Reload data after sync
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

  const handleTableChange = (newPagination: any) => {
    loadData(newPagination.current, newPagination.pageSize);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a: any, b: any) => Number(a.id) - Number(b.id),
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: 'Naziv varijacije',
      dataIndex: 'variation_name',
      key: 'variation_name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Opis',
      dataIndex: 'variation_description',
      key: 'variation_description',
    },
    {
      title: 'Tip linije ID',
      dataIndex: 'line_type_id',
      key: 'line_type_id',
      width: 120,
      align: 'center' as const,
    },
    {
      title: 'Smer',
      dataIndex: 'direction',
      key: 'direction',
      width: 100,
      align: 'center' as const,
      render: (dir: string | null) => dir ?? '-',
    },
    {
      title: 'Glavna ruta',
      dataIndex: 'main_basic_route',
      key: 'main_basic_route',
      width: 120,
      align: 'center' as const,
      render: (flag: number | null) => (
        <Tag color={flag ? 'blue' : 'default'}>
          {flag ? 'Da' : 'Ne'}
        </Tag>
      ),
    },
    {
      title: 'Datum od',
      dataIndex: 'datetime_from',
      key: 'datetime_from',
      width: 180,
      render: (date: string | null) => date ? new Date(date).toLocaleString('sr-RS') : '-',
    },
    {
      title: 'Datum do',
      dataIndex: 'datetime_to',
      key: 'datetime_to',
      width: 180,
      render: (date: string | null) => date ? new Date(date).toLocaleString('sr-RS') : '-',
    },
  ];

  return (
    <div>
      <Card className="mb-4">
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <ShoppingOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Tiketing Server</Title>
                <Text type="secondary">Varijacije na Tiketing serveru (READ-ONLY)</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => loadData(pagination.current, pagination.pageSize)}
                loading={loading}
                disabled={syncing}
              >
                Osveži
              </Button>
              {hasPermission('transport.administration.variations.ticketing:sync') && (
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
        rowKey="id"
        loading={loading || syncing}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `Ukupno ${total} varijacija`,
          onChange: (page, pageSize) => handleTableChange({ current: page, pageSize }),
        }}
        onChange={handleTableChange}
        locale={{
          emptyText: 'Nema varijacija',
        }}
        scroll={{ x: 1200 }}
      />
    </div>
  );
};

export default TicketingServerTab;
