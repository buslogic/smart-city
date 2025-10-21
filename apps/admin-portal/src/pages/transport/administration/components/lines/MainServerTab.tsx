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
  Select,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  BranchesOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { linesService, Line } from '../../../../../services/lines.service';
import { priceListGroupsService, PriceListGroup } from '../../../../../services/priceListGroups.service';
import EditLineModal from './EditLineModal';

const { Title, Text } = Typography;

const MainServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [data, setData] = useState<Line[]>([]);
  const [groups, setGroups] = useState<PriceListGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  const loadGroups = async () => {
    setGroupsLoading(true);
    try {
      const result = await priceListGroupsService.getAllMain();
      setGroups(result);
    } catch (error: any) {
      console.error('Greška pri učitavanju grupa:', error);
      message.error('Greška pri učitavanju grupa cenovnika');
    } finally {
      setGroupsLoading(false);
    }
  };

  const loadData = async (page = 1, pageSize = 50) => {
    if (!selectedGroup) {
      setData([]);
      setPagination({ current: 1, pageSize: 50, total: 0 });
      return;
    }

    setLoading(true);
    try {
      const result = await linesService.getAllMain(selectedGroup, page, pageSize);
      setData(result.data);
      setPagination({
        current: result.page,
        pageSize: result.limit,
        total: result.total,
      });
    } catch (error: any) {
      console.error('Greška pri učitavanju linija:', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadData(1, pagination.pageSize);
    }
  }, [selectedGroup]);

  const handleEdit = (record: Line) => {
    setSelectedLine(record);
    setEditModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedLine(null);
    setEditModalOpen(true);
  };

  const handleModalClose = () => {
    setEditModalOpen(false);
    setSelectedLine(null);
  };

  const handleModalSuccess = () => {
    loadData(pagination.current, pagination.pageSize);
  };

  const handleTableChange = (newPagination: any) => {
    loadData(newPagination.current, newPagination.pageSize);
  };

  const handleDelete = (record: Line) => {
    modal.confirm({
      title: 'Potvrda brisanja',
      icon: <ExclamationCircleOutlined />,
      content: `Da li ste sigurni da želite da obrišete liniju "${record.lineNumber} - ${record.lineTitle}"?`,
      okText: 'Da, obriši',
      okType: 'danger',
      cancelText: 'Otkaži',
      onOk: async () => {
        try {
          await linesService.delete(Number(record.id));
          message.success('Linija uspešno obrisana');
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
      sorter: (a: Line, b: Line) => Number(a.id) - Number(b.id),
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
      title: 'Broj linije',
      dataIndex: 'lineNumber',
      key: 'lineNumber',
      width: 120,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Naziv linije',
      dataIndex: 'lineTitle',
      key: 'lineTitle',
      render: (text: string) => <Text>{text}</Text>,
    },
    {
      title: 'Važi od',
      dataIndex: 'dateValidFrom',
      key: 'dateValidFrom',
      width: 150,
      render: (date: string) => date,
    },
    {
      title: 'Broj stanica',
      dataIndex: 'numberOfStations',
      key: 'numberOfStations',
      width: 120,
      align: 'center' as const,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (status: string) => (
        <Tag color={status === 'A' ? 'green' : 'default'}>
          {status === 'A' ? 'Aktivna' : 'Neaktivna'}
        </Tag>
      ),
    },
    {
      title: 'Promenio',
      dataIndex: 'changedBy',
      key: 'changedBy',
      width: 150,
    },
    {
      title: 'Datum promene',
      dataIndex: 'dateTime',
      key: 'dateTime',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('sr-RS'),
    },
    {
      title: 'Akcije',
      key: 'actions',
      align: 'center' as const,
      fixed: 'right' as const,
      width: 120,
      render: (_: any, record: Line) => (
        <Space>
          {hasPermission('transport.administration.lines.main:update') && (
            <Tooltip title="Izmeni">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {hasPermission('transport.administration.lines.main:delete') && (
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
              <BranchesOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Glavni Server</Title>
                <Text type="secondary">Linije na glavnom serveru</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => loadData(pagination.current, pagination.pageSize)} loading={loading}>
                Osveži
              </Button>
              {hasPermission('transport.administration.lines.main:create') && (
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

      <Card className="mb-4">
        <Row gutter={16}>
          <Col span={24}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Izaberite grupu cenovnika:</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Odaberite grupu cenovnika"
                value={selectedGroup}
                onChange={setSelectedGroup}
                loading={groupsLoading}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={groups.map((group) => ({
                  value: group.dateValidFrom,
                  label: `${group.name} | ${group.dateValidFrom} | Status: ${group.status} | Synchro: ${group.synchroStatus}`,
                }))}
              />
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
          showTotal: (total) => `Ukupno ${total} linija`,
          onChange: (page, pageSize) => handleTableChange({ current: page, pageSize }),
        }}
        onChange={handleTableChange}
        locale={{
          emptyText: selectedGroup
            ? 'Nema linija za odabranu grupu'
            : 'Molimo odaberite grupu cenovnika',
        }}
        scroll={{ x: 1500 }}
      />

      <EditLineModal
        open={editModalOpen}
        line={selectedLine}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default MainServerTab;
