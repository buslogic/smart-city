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
  Select,
} from 'antd';
import {
  ReloadOutlined,
  GlobalOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { linesService } from '../../../../../services/lines.service';
import { priceListGroupsService, PriceListGroup } from '../../../../../services/priceListGroups.service';

const { Title, Text } = Typography;

const CityServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingLineUids, setSyncingLineUids] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [groups, setGroups] = useState<PriceListGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  const loadGroups = async () => {
    setGroupsLoading(true);
    try {
      const result = await priceListGroupsService.getAllCity();
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
      const result = await linesService.getAllCity(selectedGroup, page, pageSize);
      setData(result.data);
      setPagination({
        current: result.page,
        pageSize: result.limit,
        total: result.total,
      });
    } catch (error: any) {
      console.error('Greška pri učitavanju linija (Gradski):', error);
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
          const result = await linesService.syncFromCity();
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

  const handleSyncLineUids = () => {
    if (!selectedGroup) {
      message.warning('Molimo odaberite grupu cenovnika pre sinhronizacije.');
      return;
    }

    modal.confirm({
      title: 'Potvrda sinhronizacije stanica na linijama',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            Da li ste sigurni da želite da pokrenete sinhronizaciju stanica na linijama za grupu:{' '}
            <Text strong>{selectedGroup}</Text>?
          </p>
          <p>
            <Text type="secondary">
              Sistem će automatski kreirati tabelu ako ne postoji i sinhronizovati sve stanice sa City servera.
            </Text>
          </p>
        </div>
      ),
      okText: 'Da, pokreni sinhronizaciju',
      okType: 'primary',
      cancelText: 'Otkaži',
      onOk: async () => {
        setSyncingLineUids(true);
        try {
          const result = await linesService.syncLineUidsFromCity(selectedGroup);
          message.success(result.message);
          console.log('📊 City sync result:', result);
        } catch (error: any) {
          console.error('Greška pri sinhronizaciji stanica sa City servera:', error);
          message.error(
            error.response?.data?.message || 'Greška pri sinhronizaciji stanica'
          );
        } finally {
          setSyncingLineUids(false);
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
      title: 'Broj linije',
      dataIndex: 'line_number',
      key: 'line_number',
      width: 120,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Naziv linije',
      dataIndex: 'line_title',
      key: 'line_title',
    },
    {
      title: 'Važi od',
      dataIndex: 'date_valid_from',
      key: 'date_valid_from',
      width: 150,
    },
    {
      title: 'Broj stanica',
      dataIndex: 'number_of_stations',
      key: 'number_of_stations',
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
      dataIndex: 'changed_by',
      key: 'changed_by',
      width: 150,
    },
    {
      title: 'Datum promene',
      dataIndex: 'date_time',
      key: 'date_time',
      width: 180,
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
                <Text type="secondary">Linije na Gradskom serveru (READ-ONLY)</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => loadData(pagination.current, pagination.pageSize)}
                loading={loading}
                disabled={syncing || syncingLineUids}
              >
                Osveži
              </Button>
              {hasPermission('transport.administration.lines.city:sync') && (
                <>
                  <Button
                    type="primary"
                    icon={<SyncOutlined spin={syncing} />}
                    onClick={handleSync}
                    loading={syncing}
                    disabled={loading || syncingLineUids}
                  >
                    Sinhronizacija
                  </Button>
                  <Button
                    type="default"
                    icon={<SyncOutlined spin={syncingLineUids} />}
                    onClick={handleSyncLineUids}
                    loading={syncingLineUids}
                    disabled={loading || syncing || !selectedGroup}
                  >
                    Sinhronizuj stanice
                  </Button>
                </>
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
                options={groups.map((group: any) => ({
                  value: group.date_valid_from,
                  label: `${group.name} | ${group.date_valid_from} | Status: ${group.status} | Synchro: ${group.synchro_status}`,
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
        loading={loading || syncing}
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
        scroll={{ x: 1200 }}
      />
    </div>
  );
};

export default CityServerTab;
