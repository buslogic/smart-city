import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  Tag,
  Popconfirm,
  message,
  Row,
  Col,
  Statistic,
  InputNumber,
  Badge,
  Alert,
  Descriptions,
  Spin,
  App,
  Checkbox,
} from 'antd';
import {
  UsergroupAddOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  CarOutlined,
  TeamOutlined,
  ReloadOutlined,
  SyncOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { userGroupsService, UserGroup, CreateUserGroupDto, UpdateUserGroupDto } from '../../services/userGroups';

const { Title, Text } = Typography;
const { TextArea } = Input;

const UserGroups: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [form] = Form.useForm();
  const [includeInactive, setIncludeInactive] = useState(false);

  // Sync modal state
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [legacyGroups, setLegacyGroups] = useState<any[]>([]);
  const [legacySource, setLegacySource] = useState<any>(null);
  const [loadingLegacy, setLoadingLegacy] = useState(false);
  const [syncEnabledGroups, setSyncEnabledGroups] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadGroups();
  }, [includeInactive]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await userGroupsService.getAll({ includeInactive });
      setGroups(data);
    } catch (error) {
      messageApi.error('Greška pri učitavanju grupa');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: CreateUserGroupDto | UpdateUserGroupDto) => {
    try {
      if (editingGroup) {
        await userGroupsService.update(editingGroup.id, values);
        messageApi.success('Grupa uspešno ažurirana');
      } else {
        await userGroupsService.create(values as CreateUserGroupDto);
        messageApi.success('Grupa uspešno kreirana');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingGroup(null);
      loadGroups();
    } catch (error: any) {
      messageApi.error(error.response?.data?.message || 'Greška pri čuvanju grupe');
    }
  };

  const handleEdit = (group: UserGroup) => {
    setEditingGroup(group);
    form.setFieldsValue({
      groupName: group.groupName,
      driver: group.driver,
      userClass: group.userClass,
      description: group.description,
      isActive: group.isActive,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await userGroupsService.delete(id);
      messageApi.success('Grupa uspešno obrisana');
      loadGroups();
    } catch (error: any) {
      messageApi.error(error.response?.data?.message || 'Greška pri brisanju grupe');
    }
  };

  const handleOpenSyncModal = async () => {
    setSyncModalVisible(true);
    setLoadingLegacy(true);
    try {
      const response = await userGroupsService.fetchLegacyGroups();
      setLegacyGroups(response.data || []);
      setLegacySource(response.source);

      // Pre-select groups that already have legacyId
      const preSelectedIds = new Set<number>();
      for (const group of groups) {
        if (group.legacyId && group.syncEnabled) {
          preSelectedIds.add(group.legacyId);
        }
      }
      setSyncEnabledGroups(preSelectedIds);
    } catch (error: any) {
      messageApi.error(error.response?.data?.message || 'Greška pri učitavanju legacy podataka');
      // Ako nema mapiranja, prikaži uputstva
      if (error.response?.status === 404 || error.response?.status === 400) {
        Modal.warning({
          title: 'Legacy tabela nije konfigurisana',
          content: (
            <div>
              <p>{error.response?.data?.message}</p>
              <ol style={{ marginTop: '16px' }}>
                <li>Idite na <strong>Podešavanja → Legacy tabele</strong></li>
                <li>Pronađite vašu legacy bazu</li>
                <li>Dodajte mapiranje za <strong>user_groups</strong> tabelu</li>
                <li>Omogućite sinhronizaciju za tu tabelu</li>
              </ol>
            </div>
          ),
          okText: 'Razumem',
        });
        setSyncModalVisible(false);
      }
    } finally {
      setLoadingLegacy(false);
    }
  };

  const handleSyncEnabledChange = (legacyGroupId: number, checked: boolean) => {
    const newSet = new Set(syncEnabledGroups);
    if (checked) {
      newSet.add(legacyGroupId);
    } else {
      newSet.delete(legacyGroupId);
    }
    setSyncEnabledGroups(newSet);
  };

  const handleSaveSyncSettings = async () => {
    try {
      // Pronađi koje legacy grupe odgovaraju našim lokalnim grupama
      const updates: { id: number; syncEnabled: boolean; legacyId?: number }[] = [];

      for (const group of groups) {
        // Proverim da li odabrana legacy grupa odgovara lokalnoj grupi po nazivu
        let matchedLegacyId: number | undefined = undefined;
        const shouldSync = Array.from(syncEnabledGroups).some(legacyId => {
          const legacyGroup = legacyGroups.find(lg => lg.id === legacyId);
          if (legacyGroup && legacyGroup.groupName?.toLowerCase() === group.groupName.toLowerCase()) {
            matchedLegacyId = legacyId;
            return true;
          }
          return false;
        });

        updates.push({
          id: group.id,
          syncEnabled: shouldSync,
          legacyId: matchedLegacyId
        });
      }

      await userGroupsService.updateSyncStatus(updates);
      messageApi.success('Postavke sinhronizacije su uspešno sačuvane');

      // Osveži grupe
      await loadGroups();
      setSyncModalVisible(false);
    } catch (error: any) {
      messageApi.error(error.response?.data?.message || 'Greška pri čuvanju postavki sinhronizacije');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      align: 'center' as const,
    },
    {
      title: 'Legacy ID',
      dataIndex: 'legacyId',
      key: 'legacyId',
      width: 90,
      align: 'center' as const,
      render: (legacyId: number | null) =>
        legacyId ? (
          <Tag color="purple">{legacyId}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Naziv grupe',
      dataIndex: 'groupName',
      key: 'groupName',
      render: (text: string, record: UserGroup) => (
        <Space>
          <TeamOutlined />
          <Text strong>{text}</Text>
          {!record.isActive && <Tag color="red">Neaktivna</Tag>}
        </Space>
      ),
    },
    {
      title: 'Tip',
      key: 'driver',
      render: (record: UserGroup) => (
        <Space>
          {record.driver ? (
            <Tag icon={<CarOutlined />} color="blue">Vozač</Tag>
          ) : (
            <Tag icon={<UserOutlined />} color="green">Korisnik</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Klasa korisnika',
      dataIndex: 'userClass',
      key: 'userClass',
      render: (userClass: number) => (
        <Badge count={userClass} style={{ backgroundColor: '#52c41a' }} />
      ),
    },
    {
      title: 'Broj korisnika',
      key: 'usersCount',
      render: (record: UserGroup) => (
        <Tag color="geekblue">{record._count?.users || 0} korisnika</Tag>
      ),
    },
    {
      title: 'Opis',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: 'Sinhronizacija',
      dataIndex: 'syncEnabled',
      key: 'syncEnabled',
      width: 120,
      align: 'center' as const,
      render: (syncEnabled: boolean) => (
        syncEnabled ? (
          <Tag icon={<SyncOutlined />} color="blue">Omogućena</Tag>
        ) : (
          <Tag color="default">Onemogućena</Tag>
        )
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Aktivna' : 'Neaktivna'}
        </Tag>
      ),
    },
    {
      title: 'Akcije',
      key: 'actions',
      render: (record: UserGroup) => (
        <Space size="middle">
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            type="link"
          >
            Izmeni
          </Button>
          <Popconfirm
            title="Da li ste sigurni?"
            description={`Brisanje grupe "${record.groupName}"?`}
            onConfirm={() => handleDelete(record.id)}
            okText="Da"
            cancelText="Ne"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              type="link"
              disabled={!!(record._count?.users && record._count.users > 0)}
            >
              Obriši
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Statistike
  const totalGroups = groups.length;
  const activeGroups = groups.filter(g => g.isActive).length;
  const driverGroups = groups.filter(g => g.driver).length;
  const totalUsers = groups.reduce((sum, g) => sum + (g._count?.users || 0), 0);

  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <UsergroupAddOutlined className="text-2xl text-blue-500" />
            <Title level={2} className="mb-0">Grupe Korisnika</Title>
          </div>
          <Space>
            <Switch
              checkedChildren="Sve grupe"
              unCheckedChildren="Samo aktivne"
              checked={includeInactive}
              onChange={setIncludeInactive}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={loadGroups}
            >
              Osveži
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={handleOpenSyncModal}
            >
              Sinhronizacija sa Legacy tabelom
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingGroup(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              Nova grupa
            </Button>
          </Space>
        </div>

        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card variant="borderless">
              <Statistic
                title="Ukupno grupa"
                value={totalGroups}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless">
              <Statistic
                title="Aktivne grupe"
                value={activeGroups}
                valueStyle={{ color: '#3f8600' }}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless">
              <Statistic
                title="Grupe vozača"
                value={driverGroups}
                prefix={<CarOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless">
              <Statistic
                title="Ukupno korisnika"
                value={totalUsers}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={groups}
          loading={loading}
          rowKey="id"
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Ukupno ${total} grupa`,
          }}
        />
      </Card>

      <Modal
        title={editingGroup ? 'Izmeni grupu' : 'Nova grupa'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingGroup(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            driver: false,
            userClass: 1,
            isActive: true,
          }}
        >
          <Form.Item
            label="Naziv grupe"
            name="groupName"
            rules={[
              { required: true, message: 'Naziv grupe je obavezan' },
              { min: 1, message: 'Naziv mora imati najmanje 1 karakter' },
              { max: 100, message: 'Naziv ne sme biti duži od 100 karaktera' },
            ]}
          >
            <Input placeholder="Unesite naziv grupe" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Tip grupe"
                name="driver"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="Vozač"
                  unCheckedChildren="Korisnik"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Klasa korisnika (1-20)"
                name="userClass"
                rules={[
                  { type: 'number', min: 1, max: 20, message: 'Klasa mora biti između 1 i 20' },
                ]}
              >
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Opis"
            name="description"
          >
            <TextArea
              rows={3}
              placeholder="Opišite grupu korisnika"
            />
          </Form.Item>

          <Form.Item
            label="Status"
            name="isActive"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Aktivna"
              unCheckedChildren="Neaktivna"
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setModalVisible(false);
                setEditingGroup(null);
                form.resetFields();
              }}>
                Otkaži
              </Button>
              <Button type="primary" htmlType="submit">
                {editingGroup ? 'Sačuvaj izmene' : 'Kreiraj grupu'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Legacy Sync Modal */}
      <Modal
        title={
          <Space>
            <DatabaseOutlined />
            <span>Sinhronizacija sa Legacy Bazom</span>
          </Space>
        }
        open={syncModalVisible}
        onCancel={() => {
          setSyncModalVisible(false);
          setLegacyGroups([]);
          setLegacySource(null);
        }}
        width={1200}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setSyncModalVisible(false);
              setLegacyGroups([]);
              setLegacySource(null);
            }}
          >
            Zatvori
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleSaveSyncSettings}
          >
            Sačuvaj promene
          </Button>
        ]}
      >
        {loadingLegacy ? (
          <div className="text-center py-12">
            <Spin size="large" tip="Učitavanje legacy podataka..." />
          </div>
        ) : (
          <>
            {legacySource && (
              <Alert
                message="Izvor podataka"
                description={
                  <Descriptions size="small" column={3}>
                    <Descriptions.Item label="Baza">{legacySource.database}</Descriptions.Item>
                    <Descriptions.Item label="Host">{legacySource.host}</Descriptions.Item>
                    <Descriptions.Item label="Tabela">{legacySource.table}</Descriptions.Item>
                  </Descriptions>
                }
                type="info"
                showIcon
                icon={<DatabaseOutlined />}
                className="mb-4"
              />
            )}

            <div className="mb-4">
              <Text strong>Odaberite grupe iz legacy baze koje želite da sinhronizujete:</Text>
            </div>

            <Table
              dataSource={legacyGroups}
              rowKey="id"
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Ukupno ${total} grupa`,
              }}
              columns={[
                {
                  title: 'Sinhronizovati',
                  key: 'sync',
                  width: 120,
                  align: 'center' as const,
                  fixed: 'left',
                  render: (_, record) => (
                    <Checkbox
                      checked={syncEnabledGroups.has(record.id)}
                      onChange={(e) => handleSyncEnabledChange(record.id, e.target.checked)}
                    />
                  ),
                },
                {
                  title: 'Legacy ID',
                  dataIndex: 'id',
                  key: 'id',
                  width: 100,
                },
                {
                  title: 'Naziv grupe',
                  dataIndex: 'groupName',
                  key: 'groupName',
                  render: (text: string) => (
                    <Text strong>{text || '-'}</Text>
                  ),
                },
                {
                  title: 'Tip',
                  dataIndex: 'driver',
                  key: 'driver',
                  width: 120,
                  render: (driver: boolean) => (
                    driver ? (
                      <Tag icon={<CarOutlined />} color="blue">Vozač</Tag>
                    ) : (
                      <Tag icon={<UserOutlined />} color="green">Korisnik</Tag>
                    )
                  ),
                },
                {
                  title: 'Klasa',
                  dataIndex: 'userClass',
                  key: 'userClass',
                  width: 80,
                  render: (userClass: number) => (
                    <Badge count={userClass} style={{ backgroundColor: '#52c41a' }} />
                  ),
                },
                {
                  title: 'Opis',
                  dataIndex: 'description',
                  key: 'description',
                  ellipsis: true,
                  render: (text: string | null) => text || '-',
                },
                {
                  title: 'Status',
                  dataIndex: 'isActive',
                  key: 'isActive',
                  width: 100,
                  render: (isActive: boolean) => (
                    isActive ? (
                      <Tag icon={<CheckCircleOutlined />} color="success">Aktivna</Tag>
                    ) : (
                      <Tag icon={<CloseCircleOutlined />} color="error">Neaktivna</Tag>
                    )
                  ),
                },
                {
                  title: 'Postoji lokalno',
                  key: 'exists',
                  width: 120,
                  render: (record: any) => {
                    const exists = groups.some(g =>
                      g.groupName.toLowerCase() === record.groupName?.toLowerCase()
                    );
                    return exists ? (
                      <Tag color="orange">Da</Tag>
                    ) : (
                      <Tag color="blue">Ne</Tag>
                    );
                  },
                },
              ]}
            />

            <Alert
              message="Napomena"
              description="Ovo je pregled podataka iz legacy baze. Sinhronizacija će biti implementirana u sledećoj fazi."
              type="warning"
              showIcon
              className="mt-4"
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default UserGroups;