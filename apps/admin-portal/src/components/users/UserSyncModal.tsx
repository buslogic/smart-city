import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Tag,
  Alert,
  Descriptions,
  Spin,
  Checkbox,
  Badge,
  message,
  Row,
  Col,
  Card,
  Statistic,
  Switch,
  Typography,
  Divider,
} from 'antd';
import {
  DatabaseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  UserOutlined,
  TeamOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { userService } from '../../services/userService';
import { userGroupsService, UserGroup } from '../../services/userGroups';
import { RoleSyncSettingsModal } from './RoleSyncSettingsModal';
import { BatchSyncProgressModal } from './BatchSyncProgressModal';

const { Text, Title } = Typography;

interface UserSyncModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface LegacyUser {
  id: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  groupId?: number;
  groupName?: string;
  isActive?: boolean;
  createdAt?: string;
  legacyData?: any;
}


export const UserSyncModal: React.FC<UserSyncModalProps> = ({ visible, onClose, onSuccess }) => {
  const [modal, contextHolder] = Modal.useModal();

  // State management
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [legacyUsers, setLegacyUsers] = useState<LegacyUser[]>([]);
  const [syncGroups, setSyncGroups] = useState<UserGroup[]>([]);
  const [legacySource, setLegacySource] = useState<any>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [showOnlyUnsync, setShowOnlyUnsync] = useState(false);
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set());
  const [existingLegacyIds, setExistingLegacyIds] = useState<Set<number>>(new Set());
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [syncSettings, setSyncSettings] = useState<any>(null);
  const [batchProgressVisible, setBatchProgressVisible] = useState(false);
  const [batchProgress, setBatchProgress] = useState<any>(null);
  const [batchCompleted, setBatchCompleted] = useState(false);
  const [batchError, setBatchError] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 50,
    showSizeChanger: true,
    pageSizeOptions: ['20', '50', '100', '200'],
    showTotal: (total) => `Ukupno ${total} korisnika`,
  });

  // Statistics
  const [stats, setStats] = useState({
    totalLegacy: 0,
    synchronized: 0,
    unsynchronized: 0,
    selectedCount: 0,
  });

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      loadData();
    } else {
      // Reset state when modal closes
      setSelectedUsers(new Set());
      setShowOnlyUnsync(false);
      setPagination({ ...pagination, current: 1 });
    }
  }, [visible]);

  // Load sync settings
  const loadSyncSettings = async () => {
    try {
      const settings = await userService.getSyncSettings();
      setSyncSettings(settings);
      return settings;
    } catch (error) {
      console.error('Error loading sync settings:', error);
      return null;
    }
  };

  // Load sync groups and legacy users
  const loadData = async () => {
    setLoading(true);
    try {
      // Load sync settings first
      await loadSyncSettings();

      // Load sync-enabled groups
      const groupsResponse = await userGroupsService.getAll({ includeInactive: false });
      const syncEnabledGroups = groupsResponse.filter(g => g.syncEnabled);
      setSyncGroups(syncEnabledGroups);

      // Load existing users to check for duplicates
      const existingUsersResponse = await userService.getExistingUsersForSync();
      setExistingEmails(existingUsersResponse.emails);
      setExistingLegacyIds(existingUsersResponse.legacyIds);

      // Load legacy users
      const legacyResponse = await userService.fetchLegacyUsers();

      // Check if we got a message about no groups
      if (legacyResponse.data.length === 0 && legacyResponse.message) {
        message.warning(legacyResponse.message);
      }

      setLegacyUsers(legacyResponse.data || []);
      setLegacySource(legacyResponse.source);

      // Store sync groups information if available
      if (legacyResponse.syncGroups) {
        setSyncGroups(legacyResponse.syncGroups);
      }

      // Calculate statistics
      const syncedUsers = legacyResponse.data.filter(u =>
        existingUsersResponse.emails.has(u.email?.toLowerCase()) ||
        existingUsersResponse.legacyIds.has(u.id)
      );
      const syncedCount = syncedUsers.length;

      setStats({
        totalLegacy: legacyResponse.data.length,
        synchronized: syncedCount,
        unsynchronized: legacyResponse.data.length - syncedCount,
        selectedCount: 0,
      });

    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri učitavanju podataka');

      // Check if legacy table is not configured
      if (error.response?.status === 404 || error.response?.status === 400) {
        modal.warning({
          title: 'Legacy tabela nije konfigurisana',
          content: (
            <div>
              <p>{error.response?.data?.message}</p>
              <ol style={{ marginTop: '16px' }}>
                <li>Idite na <strong>Podešavanja → Legacy tabele</strong></li>
                <li>Pronađite vašu legacy bazu</li>
                <li>Dodajte mapiranje za <strong>users</strong> tabelu</li>
                <li>Omogućite sinhronizaciju za tu tabelu</li>
              </ol>
            </div>
          ),
          okText: 'Razumem',
        });
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle user selection
  const handleSelectUser = (userId: number, checked: boolean) => {
    const newSelection = new Set(selectedUsers);
    if (checked) {
      newSelection.add(userId);
    } else {
      newSelection.delete(userId);
    }
    setSelectedUsers(newSelection);
    setStats({ ...stats, selectedCount: newSelection.size });
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const filteredUsers = getFilteredUsers();
      const newSelection = new Set(filteredUsers.map(u => u.id));
      setSelectedUsers(newSelection);
      setStats({ ...stats, selectedCount: newSelection.size });
    } else {
      setSelectedUsers(new Set());
      setStats({ ...stats, selectedCount: 0 });
    }
  };

  // Get filtered users based on sync status
  const getFilteredUsers = () => {
    if (showOnlyUnsync) {
      return legacyUsers.filter(u =>
        !existingEmails.has(u.email?.toLowerCase() || '') &&
        !existingLegacyIds.has(u.id)
      );
    }
    return legacyUsers;
  };

  // Handle settings
  const handleSettings = () => {
    setSettingsModalVisible(true);
  };

  const handleSettingsSuccess = async () => {
    await loadSyncSettings();
    setSettingsModalVisible(false);
    message.success('Podešavanja uspešno ažurirana');
  };

  // Handle sync
  const handleSync = async () => {
    if (selectedUsers.size === 0) {
      message.warning('Molimo odaberite korisnike za sinhronizaciju');
      return;
    }

    // Proveri da li je konfigurisan default role
    if (!syncSettings || !syncSettings.configured) {
      modal.warning({
        title: 'Default rola nije konfigurirana',
        content: (
          <div>
            <p>Molimo prvo definišite default rolu koja će biti dodeljena sinhronizovanim korisnicima.</p>
            <p>Kliknite na dugme "Podešavanja" da konfigurirate default rolu.</p>
          </div>
        ),
        okText: 'Razumem',
        onOk: () => {
          setSettingsModalVisible(true);
        },
      });
      return;
    }

    // Pametno odlučiti da li koristiti batch ili obične sync
    const usersToSync = legacyUsers.filter(u => selectedUsers.has(u.id));
    const shouldUseBatch = usersToSync.length > 100; // Batch za više od 100 korisnika

    modal.confirm({
      title: 'Potvrdite sinhronizaciju',
      content: (
        <div>
          <p>Da li ste sigurni da želite da sinhronizujete {selectedUsers.size} korisnika?</p>
          {shouldUseBatch && (
            <Alert
              message="Batch sinhronizacija"
              description={`Zbog velikog broja korisnika (${usersToSync.length}), koristiće se batch sinhronizacija po 50 korisnika. Videćete progress u posebnom modalu.`}
              type="info"
              showIcon
              className="mt-4 mb-4"
            />
          )}
          <Alert
            message="Napomena"
            description="Korisnici koji već postoje (isti email) će biti preskočeni."
            type="info"
            showIcon
            className="mt-4"
          />
        </div>
      ),
      onOk: async () => {
        if (shouldUseBatch) {
          // Batch sinhronizacija
          handleBatchSync(usersToSync);
        } else {
          // Obična sinhronizacija
          handleRegularSync(usersToSync);
        }
      },
    });
  };

  // Batch sync handler
  const handleBatchSync = async (usersToSync: any[]) => {
    try {
      // Resetuj state i prikaži progress modal
      setBatchProgress(null);
      setBatchCompleted(false);
      setBatchError(false);
      setBatchProgressVisible(true);
      setSyncing(true);

      // Pokreni batch sync sa real-time progress
      await userService.syncLegacyUsersBatch(
        usersToSync,
        50,
        // onProgress callback
        (progress) => {
          setBatchProgress(progress);
        },
        // onComplete callback
        (result) => {
          setBatchProgress(result);
          setBatchCompleted(true);

          // Show success message
          message.success(`Batch sinhronizacija završena: ${result.success} uspešno, ${result.skipped} preskočeno, ${result.errors} grešaka`);

          // Reload data
          loadData();
          setSelectedUsers(new Set());

          if (result.success > 0) {
            onSuccess();
          }
        },
        // onError callback
        (error) => {
          setBatchError(true);
          setBatchProgress((prev: any) => prev ? { ...prev, error } : null);
          message.error(error);
        }
      );

    } catch (error: any) {
      setBatchError(true);
      setBatchProgress((prev: any) => prev ? { ...prev, error: error.message } : null);
      message.error(error.message || 'Greška pri batch sinhronizaciji');
    } finally {
      setSyncing(false);
    }
  };

  // Regular sync handler (za manje od 100 korisnika)
  const handleRegularSync = async (usersToSync: any[]) => {
    setSyncing(true);
    try {
      const response = await userService.syncLegacyUsers(usersToSync);

      // Show detailed results
      let resultMessage = `Uspešno sinhronizovano: ${response.success} korisnika. `;

      if (response.skipped > 0) {
        resultMessage += `Preskočeno: ${response.skipped} (već postoje). `;
      }

      if (response.errors > 0) {
        resultMessage += `Greške: ${response.errors}. `;
      }

      if (response.success > 0) {
        message.success(resultMessage);
      } else if (response.skipped > 0) {
        message.warning(resultMessage);
      } else {
        message.error(resultMessage);
      }

      // Show duplicates if any
      if (response.duplicates && response.duplicates.length > 0) {
        modal.info({
          title: 'Preskočeni korisnici',
          content: (
            <div>
              <p>Sledeći korisnici već postoje u sistemu:</p>
              <ul>
                {response.duplicates.slice(0, 10).map((dup: any, idx: number) => (
                  <li key={idx}>
                    {dup.firstName} {dup.lastName} - {dup.email}
                  </li>
                ))}
                {response.duplicates.length > 10 && (
                  <li>... i još {response.duplicates.length - 10} korisnika</li>
                )}
              </ul>
            </div>
          ),
        });
      }

      // Reload data
      await loadData();
      setSelectedUsers(new Set());

      // Call success callback to refresh main table if any users were synced
      if (response.success > 0) {
        onSuccess();
      }

    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri sinhronizaciji');
    } finally {
      setSyncing(false);
    }
  };

  // Table columns
  const columns: ColumnsType<LegacyUser> = [
    {
      title: (
        <Checkbox
          checked={selectedUsers.size > 0 && selectedUsers.size === getFilteredUsers().length}
          indeterminate={selectedUsers.size > 0 && selectedUsers.size < getFilteredUsers().length}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      key: 'select',
      width: 50,
      fixed: 'left',
      render: (_, record) => {
        const isSynced = existingEmails.has(record.email?.toLowerCase() || '') ||
                         existingLegacyIds.has(record.id);
        return (
          <Checkbox
            checked={selectedUsers.has(record.id)}
            onChange={(e) => handleSelectUser(record.id, e.target.checked)}
            disabled={isSynced}
          />
        );
      },
    },
    {
      title: 'Legacy ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: 'Ime i prezime',
      key: 'fullName',
      render: (_, record) => (
        <div>
          <Text strong>
            {record.firstName || ''} {record.lastName || ''}
          </Text>
          {record.username && (
            <div className="text-gray-500 text-sm">@{record.username}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => email || <Text type="secondary">-</Text>,
    },
    {
      title: 'Grupa',
      key: 'group',
      render: (_, record) => {
        if (record.groupName) {
          const syncGroup = syncGroups.find(g => {
            const groupName = (g as any).name || g.groupName;
            return groupName && groupName.toLowerCase() === record.groupName?.toLowerCase();
          });

          if (syncGroup) {
            return (
              <Tag icon={<TeamOutlined />} color="blue">
                {record.groupName}
              </Tag>
            );
          }

          return (
            <Tag color="default">
              {record.groupName} (nije za sync)
            </Tag>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        isActive !== false ? (
          <Tag icon={<CheckCircleOutlined />} color="success">Aktivan</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">Neaktivan</Tag>
        )
      ),
    },
    {
      title: 'Sinhronizovan',
      key: 'synced',
      width: 120,
      render: (_, record) => {
        const isSynced = existingEmails.has(record.email?.toLowerCase() || '') ||
                        existingLegacyIds.has(record.id);
        return isSynced ? (
          <Tag color="green">Da</Tag>
        ) : (
          <Tag color="orange">Ne</Tag>
        );
      },
    },
  ];

  return (
    <>
      {contextHolder}
      <Modal
        title={
        <Space>
          <DatabaseOutlined />
          <span>Sinhronizacija korisnika sa Legacy Bazom</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={1400}
      footer={[
        <Button key="close" onClick={onClose}>
          Zatvori
        </Button>,
        <Button
          key="settings"
          icon={<SettingOutlined />}
          onClick={handleSettings}
        >
          Podešavanja
        </Button>,
        <Button
          key="reload"
          icon={<ReloadOutlined />}
          onClick={loadData}
          loading={loading}
        >
          Osveži
        </Button>,
        <Button
          key="sync"
          type="primary"
          icon={<SyncOutlined />}
          onClick={handleSync}
          loading={syncing}
          disabled={selectedUsers.size === 0}
        >
          Sinhronizuj odabrane ({selectedUsers.size})
        </Button>,
      ]}
    >
      {loading ? (
        <div className="text-center py-12">
          <Spin size="large" tip="Učitavanje legacy podataka..." />
        </div>
      ) : (
        <>
          {/* Source info */}
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

          {/* Sync settings status */}
          {syncSettings && (
            <Card className="mb-4">
              <Title level={5}>
                <SettingOutlined /> Status konfiguracije
              </Title>
              <div className="mb-3">
                <Text strong>Default rola za sinhronizovane korisnike:</Text>
              </div>
              {syncSettings.configured ? (
                <Tag
                  color="green"
                  icon={<CheckCircleOutlined />}
                  className="mb-3"
                >
                  {syncSettings.defaultRole.name} - {syncSettings.defaultRole.description}
                </Tag>
              ) : (
                <Tag
                  color="red"
                  icon={<CloseCircleOutlined />}
                  className="mb-3"
                >
                  Nije konfigurirana
                </Tag>
              )}
              {!syncSettings.configured && (
                <Alert
                  message="Konfiguracija potrebna"
                  description="Molimo defišite default rolu pre pokretanja sinhronizacije."
                  type="warning"
                  showIcon
                  className="mt-3"
                />
              )}
            </Card>
          )}

          {/* Sync groups info */}
          {syncGroups.length > 0 ? (
            <Card className="mb-4">
              <Title level={5}>
                <TeamOutlined /> Filtriranje po grupama
              </Title>
              <div className="mb-3">
                <Text strong>Grupe označene za sinhronizaciju:</Text>
              </div>
              <Space wrap className="mb-3">
                {syncGroups.map(group => (
                  <Tag
                    key={group.id || (group as any).name}
                    color="blue"
                    icon={<CheckCircleOutlined />}
                  >
                    {(group as any).name || group.groupName}
                    {(group as any).legacyId && <Text type="secondary"> (Legacy ID: {(group as any).legacyId})</Text>}
                  </Tag>
                ))}
              </Space>
              <Alert
                message="Filtriranje aktivno"
                description={`Prikazani su samo korisnici koji pripadaju gore navedenim grupama. Ukupno pronađeno: ${legacyUsers.length} korisnika.`}
                type="success"
                showIcon
                className="mt-3"
              />
            </Card>
          ) : (
            <Alert
              message="Nema grupa za sinhronizaciju"
              description="Molimo prvo označite grupe za sinhronizaciju u opciji Grupe Korisnika."
              type="warning"
              showIcon
              className="mb-4"
            />
          )}

          {/* Statistics */}
          <Row gutter={16} className="mb-4">
            <Col span={6}>
              <Card>
                <Statistic
                  title="Ukupno u legacy bazi"
                  value={stats.totalLegacy}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Već sinhronizovano"
                  value={stats.synchronized}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Nesinhronizovano"
                  value={stats.unsynchronized}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Odabrano za sync"
                  value={stats.selectedCount}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<SyncOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* Filters */}
          <div className="mb-4">
            <Space>
              <Switch
                checkedChildren="Samo nesinhronizovani"
                unCheckedChildren="Svi korisnici"
                checked={showOnlyUnsync}
                onChange={setShowOnlyUnsync}
              />
            </Space>
          </div>

          {/* Users table */}
          <Table
            columns={columns}
            dataSource={getFilteredUsers()}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={(newPagination) => setPagination(newPagination)}
            scroll={{ x: 1200, y: 400 }}
            size="small"
          />

          <Alert
            message="Informacije o sinhronizaciji"
            description={
              <ul className="mb-0">
                <li>Korisnici koji već postoje (isti email) neće biti duplirani</li>
                <li>Za sada se sinhronizuju samo osnovna polja: ime, prezime, email</li>
                <li>Lozinke će biti postavljene na podrazumevanu vrednost i korisnici će morati da ih promene</li>
                <li>Korisnici će biti povezani sa odgovarajućim grupama ako postoje</li>
              </ul>
            }
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            className="mt-4"
          />
        </>
      )}

      {/* Role Sync Settings Modal */}
      <RoleSyncSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        onSuccess={handleSettingsSuccess}
      />

      {/* Batch Sync Progress Modal */}
      <BatchSyncProgressModal
        visible={batchProgressVisible}
        onClose={() => setBatchProgressVisible(false)}
        progress={batchProgress}
        isCompleted={batchCompleted}
        isError={batchError}
      />
    </Modal>
    </>
  );
};