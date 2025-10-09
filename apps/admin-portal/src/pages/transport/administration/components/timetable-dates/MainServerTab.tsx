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
import { timetableDatesService, TimetableDate } from '../../../../../services/timetableDates.service';
import EditTimetableDateModal from './EditTimetableDateModal';

const { Title, Text } = Typography;

const MainServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TimetableDate[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<TimetableDate | null>(null);
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  const loadData = async () => {
    setLoading(true);
    try {
      const groups = await timetableDatesService.getAllMain();
      setData(groups);
    } catch (error: any) {
      console.error('Greška pri učitavanju grupa za RedVoznje:', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (record: TimetableDate) => {
    setSelectedGroup(record);
    setEditModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedGroup(null);
    setEditModalOpen(true);
  };

  const handleModalClose = () => {
    setEditModalOpen(false);
    setSelectedGroup(null);
  };

  const handleModalSuccess = () => {
    loadData();
  };

  const handleDelete = (record: TimetableDate) => {
    modal.confirm({
      title: 'Potvrda brisanja',
      icon: <ExclamationCircleOutlined />,
      content: `Da li ste sigurni da želite da obrišete grupu cenovnika "${record.name}"?`,
      okText: 'Da, obriši',
      okType: 'danger',
      cancelText: 'Otkaži',
      onOk: async () => {
        try {
          await timetableDatesService.delete(Number(record.id));
          message.success('Grupa za RedVoznje uspešno obrisana');
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
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a: TimetableDate, b: TimetableDate) => Number(a.id) - Number(b.id),
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
      title: 'Naziv',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Važi od',
      dataIndex: 'dateValidFrom',
      key: 'dateValidFrom',
      render: (date: string) => new Date(date).toLocaleDateString('sr-RS'),
    },
    {
      title: 'Važi do',
      dataIndex: 'dateValidTo',
      key: 'dateValidTo',
      render: (date: string | null) => date ? new Date(date).toLocaleDateString('sr-RS') : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center' as const,
      render: (status: string) => (
        <Tag color={status === 'A' ? 'green' : 'default'}>
          {status === 'A' ? 'Aktivna' : 'Neaktivna'}
        </Tag>
      ),
    },
    {
      title: 'Synchro Status',
      dataIndex: 'synchroStatus',
      key: 'synchroStatus',
      align: 'center' as const,
      render: (status: string) => (
        <Tag color={status === 'A' ? 'blue' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Promenio',
      dataIndex: 'changedBy',
      key: 'changedBy',
    },
    {
      title: 'Datum promene',
      dataIndex: 'dateTime',
      key: 'dateTime',
      render: (date: string) => new Date(date).toLocaleString('sr-RS'),
    },
    {
      title: 'Akcije',
      key: 'actions',
      align: 'center' as const,
      fixed: 'right' as const,
      width: 120,
      render: (_: any, record: TimetableDate) => (
        <Space>
          {hasPermission('transport.administration.timetable_dates.main:update') && (
            <Tooltip title="Izmeni">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {hasPermission('transport.administration.timetable_dates.main:delete') && (
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
                <Text type="secondary">Grupe za RedVoznje na glavnom serveru</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                Osveži
              </Button>
              {hasPermission('transport.administration.timetable_dates.main:create') && (
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
          showSizeChanger: true,
          showTotal: (total) => `Ukupno ${total} grupa za RedVoznje`,
        }}
        locale={{
          emptyText: 'Nema podataka',
        }}
        scroll={{ x: 1200 }}
      />

      <EditTimetableDateModal
        open={editModalOpen}
        timetableDate={selectedGroup}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default MainServerTab;
