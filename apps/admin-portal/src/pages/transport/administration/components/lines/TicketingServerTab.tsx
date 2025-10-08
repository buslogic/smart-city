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
  Alert,
} from 'antd';
import {
  ReloadOutlined,
  ShoppingOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { linesService } from '../../../../../services/lines.service';
import { priceListGroupsService, PriceListGroup } from '../../../../../services/priceListGroups.service';
import { centralPointsService, SyncedCentralPoint } from '../../../../../services/centralPoints.service';

const { Title, Text } = Typography;

const TicketingServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [groups, setGroups] = useState<PriceListGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [syncedCentralPoints, setSyncedCentralPoints] = useState<SyncedCentralPoint[]>([]);
  const [cpLoading, setCpLoading] = useState(false);
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
      const result = await priceListGroupsService.getAllTicketing();
      setGroups(result);
    } catch (error: any) {
      console.error('Greška pri učitavanju grupa:', error);
      message.error('Greška pri učitavanju grupa cenovnika');
    } finally {
      setGroupsLoading(false);
    }
  };

  const loadCentralPoints = async () => {
    setCpLoading(true);
    try {
      const result = await centralPointsService.getSyncedWithTicketing();
      setSyncedCentralPoints(result);
    } catch (error: any) {
      console.error('Greška pri učitavanju centralnih tačaka:', error);
      message.error('Greška pri učitavanju centralnih tačaka');
    } finally {
      setCpLoading(false);
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
      const result = await linesService.getAllTicketing(selectedGroup, page, pageSize);
      setData(result.data);
      setPagination({
        current: result.page,
        pageSize: result.limit,
        total: result.total,
      });
    } catch (error: any) {
      console.error('❌ Greška pri učitavanju linija (Tiketing):', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
    loadCentralPoints(); // Učitaj sve sinhronizovane CP na mount
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
          const result = await linesService.syncFromTicketing();
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
      title: 'Naziv Centralne Tačke',
      dataIndex: 'central_point_name',
      key: 'central_point_name',
      width: 250,
      render: (_: any, record: any) => {
        const cpId = record.central_point_db_id;
        const cpName = record.central_point_name;

        if (!cpId || cpId === '0') {
          return '-';
        }

        return (
          <Text>
            <Text type="secondary">{cpId}</Text> - {cpName || 'Nepoznato'}
          </Text>
        );
      },
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
              <ShoppingOutlined style={{ fontSize: 24, color: '#722ed1' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Tiketing Server</Title>
                <Text type="secondary">Linije na Tiketing serveru (READ-ONLY)</Text>
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
              {hasPermission('transport.administration.lines.ticketing:sync') && (
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

      {syncedCentralPoints.length > 0 && (
        <Card className="mb-4" loading={cpLoading}>
          <Alert
            message="Centralne tačke za sinhronizaciju"
            description={
              <div>
                <Text strong>
                  Sledeće centralne tačke biće sinhronizovane sa glavnim serverom:
                </Text>
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                  {syncedCentralPoints.map((cp) => (
                    <li key={cp.id}>
                      <Text>
                        ID: <Text strong>{cp.legacyTicketingId}</Text> - {cp.name}
                      </Text>
                    </li>
                  ))}
                </ul>
              </div>
            }
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />
        </Card>
      )}

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

export default TicketingServerTab;
