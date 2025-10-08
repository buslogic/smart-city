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
  GlobalOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { timetableDatesService } from '../../../../../services/timetableDates.service';

const { Title, Text } = Typography;

const CityServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  const loadData = async () => {
    setLoading(true);
    try {
      const groups = await timetableDatesService.getAllCity();
      setData(groups);
    } catch (error: any) {
      console.error('Greška pri učitavanju grupa za RedVoznje (Gradski):', error);
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
          <p>Da li ste sigurni da želite da pokrenete sinhronizaciju sa Gradskog servera?</p>
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
          const result = await timetableDatesService.syncFromCity();
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
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a: any, b: any) => Number(a.id) - Number(b.id),
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: 'Naziv',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Važi od',
      dataIndex: 'date_valid_from',
      key: 'date_valid_from',
      render: (date: string) => date ? new Date(date).toLocaleDateString('sr-RS') : '-',
    },
    {
      title: 'Važi do',
      dataIndex: 'date_valid_to',
      key: 'date_valid_to',
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
      dataIndex: 'synchro_status',
      key: 'synchro_status',
      align: 'center' as const,
      render: (status: string) => (
        <Tag color={status === 'A' ? 'blue' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Promenio',
      dataIndex: 'changed_by',
      key: 'changed_by',
    },
    {
      title: 'Datum promene',
      dataIndex: 'date_time',
      key: 'date_time',
      render: (date: string) => date ? new Date(date).toLocaleString('sr-RS') : '-',
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
                <Text type="secondary">Grupe za RedVoznje na Gradskom serveru (READ-ONLY)</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                Osveži
              </Button>
              {hasPermission('transport.administration.timetable_dates.city:sync') && (
                <Button
                  type="primary"
                  icon={<SyncOutlined />}
                  onClick={handleSync}
                  loading={syncing}
                >
                  Sinhronizuj
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
      />
    </div>
  );
};

export default CityServerTab;
