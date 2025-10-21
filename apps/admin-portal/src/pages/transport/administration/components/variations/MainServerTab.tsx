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
  App,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TagsOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { priceVariationsService, PriceVariation } from '../../../../../services/price-variations.service';
import EditPriceVariationModal from './EditPriceVariationModal';

const { Title, Text } = Typography;

const MainServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PriceVariation[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<PriceVariation | null>(null);
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  const loadData = async (page = 1, pageSize = 50) => {
    setLoading(true);
    try {
      const result = await priceVariationsService.getAllMain(page, pageSize);
      setData(result.data);
      setPagination({
        current: result.page,
        pageSize: result.limit,
        total: result.total,
      });
    } catch (error: any) {
      console.error('Greška pri učitavanju varijacija:', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (record: PriceVariation) => {
    setSelectedVariation(record);
    setEditModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedVariation(null);
    setEditModalOpen(true);
  };

  const handleModalClose = () => {
    setEditModalOpen(false);
    setSelectedVariation(null);
  };

  const handleModalSuccess = () => {
    loadData(pagination.current, pagination.pageSize);
  };

  const handleTableChange = (newPagination: any) => {
    loadData(newPagination.current, newPagination.pageSize);
  };

  const handleDelete = (record: PriceVariation) => {
    modal.confirm({
      title: 'Potvrda brisanja',
      icon: <ExclamationCircleOutlined />,
      content: `Da li ste sigurni da želite da obrišete varijaciju "${record.variationName}"?`,
      okText: 'Da, obriši',
      okType: 'danger',
      cancelText: 'Otkaži',
      onOk: async () => {
        try {
          await priceVariationsService.delete(record.id);
          message.success('Varijacija uspešno obrisana');
          loadData(pagination.current, pagination.pageSize);
        } catch (error: any) {
          console.error('Greška pri brisanju:', error);
          message.error(error.response?.data?.message || 'Greška pri brisanju');
        }
      },
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a: PriceVariation, b: PriceVariation) => a.id - b.id,
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: 'Tiketing ID',
      dataIndex: 'legacyTicketingId',
      key: 'legacyTicketingId',
      width: 100,
      render: (id: string | null) => id ?? '-',
    },
    {
      title: 'Gradski ID',
      dataIndex: 'legacyCityId',
      key: 'legacyCityId',
      width: 100,
      render: (id: string | null) => id ?? '-',
    },
    {
      title: 'Naziv varijacije',
      dataIndex: 'variationName',
      key: 'variationName',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Opis',
      dataIndex: 'variationDescription',
      key: 'variationDescription',
      render: (text: string) => <Text>{text}</Text>,
    },
    {
      title: 'Tip linije ID',
      dataIndex: 'lineTypeId',
      key: 'lineTypeId',
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
      dataIndex: 'mainBasicRoute',
      key: 'mainBasicRoute',
      width: 120,
      align: 'center' as const,
      render: (flag: boolean | null) => (
        <Tag color={flag ? 'blue' : 'default'}>
          {flag ? 'Da' : 'Ne'}
        </Tag>
      ),
    },
    {
      title: 'Datum od',
      dataIndex: 'datetimeFrom',
      key: 'datetimeFrom',
      width: 180,
      render: (date: string | null) => date ? new Date(date).toLocaleString('sr-RS') : '-',
    },
    {
      title: 'Datum do',
      dataIndex: 'datetimeTo',
      key: 'datetimeTo',
      width: 180,
      render: (date: string | null) => date ? new Date(date).toLocaleString('sr-RS') : '-',
    },
    {
      title: 'Akcije',
      key: 'actions',
      align: 'center' as const,
      fixed: 'right' as const,
      width: 120,
      render: (_: any, record: PriceVariation) => (
        <Space>
          {hasPermission('transport.administration.variations.main:update') && (
            <Tooltip title="Izmeni">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {hasPermission('transport.administration.variations.main:delete') && (
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
              <TagsOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Glavni Server</Title>
                <Text type="secondary">Varijacije na glavnom serveru</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => loadData(pagination.current, pagination.pageSize)} loading={loading}>
                Osveži
              </Button>
              {hasPermission('transport.administration.variations.main:create') && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
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
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `Ukupno ${total} varijacija`,
          onChange: (page, pageSize) => handleTableChange({ current: page, pageSize }),
        }}
        onChange={handleTableChange}
        locale={{
          emptyText: 'Nema varijacija',
        }}
        scroll={{ x: 1500 }}
      />

      <EditPriceVariationModal
        open={editModalOpen}
        variation={selectedVariation}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default MainServerTab;
