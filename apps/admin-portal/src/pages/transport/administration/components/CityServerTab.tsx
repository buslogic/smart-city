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
  Divider,
  Statistic,
} from 'antd';
import {
  ReloadOutlined,
  GlobalOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { centralPointsService, SyncResult } from '../../../../services/centralPoints.service';
import { usePermissions } from '../../../../hooks/usePermissions';

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
      const centralPoints = await centralPointsService.getAllCity();
      setData(centralPoints);
    } catch (error: any) {
      console.error('Greška pri učitavanju centralnih tačaka (Gradski):', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showSyncResults = (result: SyncResult) => {
    modal.success({
      title: 'Sinhronizacija završena',
      width: 600,
      content: (
        <div>
          <Text>{result.message}</Text>
          <Divider />
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="Ukupno obrađeno"
                value={result.totalProcessed}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Kreirano"
                value={result.created}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Statistic
                title="Ažurirano"
                value={result.updated}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Preskočeno"
                value={result.skipped}
                valueStyle={{ color: '#8c8c8c' }}
              />
            </Col>
          </Row>
          {result.errors > 0 && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={24}>
                <Statistic
                  title="Greške"
                  value={result.errors}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Col>
            </Row>
          )}
        </div>
      ),
    });
  };

  const handleSync = () => {
    modal.confirm({
      title: 'Potvrda sinhronizacije',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Da li ste sigurni da želite da pokrenete sinhronizaciju sa Gradskog servera?</p>
          <p>
            <Text type="warning">
              Napomena: Rekodi koji su ručno kreirani neće biti izmenjeni.
            </Text>
          </p>
        </div>
      ),
      okText: 'Da, sinhronizuj',
      cancelText: 'Otkaži',
      onOk: async () => {
        setSyncing(true);
        try {
          const result = await centralPointsService.syncFromCity();
          showSyncResults(result);

          // Osveži podatke nakon uspešne sinhronizacije
          await loadData();
        } catch (error: any) {
          console.error('Greška pri sinhronizaciji:', error);
          modal.error({
            title: 'Greška pri sinhronizaciji',
            content: error.response?.data?.message || 'Došlo je do greške pri sinhronizaciji',
          });
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
      sorter: (a: any, b: any) => a.id - b.id,
      defaultSortOrder: 'ascend' as const,
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
              <GlobalOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Gradski Server</Title>
                <Text type="secondary">Centralne tačke na Gradskom serveru (READ-ONLY)</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                Osveži
              </Button>
              {hasPermission('transport.administration.central_points.city:sync') && (
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
