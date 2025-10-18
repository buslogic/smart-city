import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Space,
  Alert,
  Button,
  App,
  Select,
  Spin,
  Tag,
} from 'antd';
import {
  ShoppingOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import {
  turnusiService,
  SyncResultDetail,
  TurnusGroup,
  TurnusSyncLog,
} from '../../../../../services/turnusi.service';
import SyncProgressTracker from './SyncProgressTracker';

const { Title, Text } = Typography;
const { Option } = Select;

const TicketingServerTab: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResultDetail | null>(null);
  const [groups, setGroups] = useState<TurnusGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(
    undefined,
  );
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null);
  const [incompleteSync, setIncompleteSync] = useState<TurnusSyncLog | null>(null);
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      checkForIncompleteSync(selectedGroupId);
    } else {
      setIncompleteSync(null);
    }
  }, [selectedGroupId]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await turnusiService.getAllGroupsTicketing();
      setGroups(data);
    } catch (error: any) {
      console.error('Greška pri učitavanju grupa:', error);
      message.error('Greška pri učitavanju grupa turnusa');
    } finally {
      setLoading(false);
    }
  };

  const checkForIncompleteSync = async (groupId: number) => {
    try {
      const incomplete = await turnusiService.getIncompleteSyncForGroup(groupId);
      setIncompleteSync(incomplete);
    } catch (error: any) {
      console.error('Greška pri proveri nedovršenih sync-ova:', error);
    }
  };

  const handleSync = () => {
    if (!selectedGroupId) {
      message.warning('Molimo odaberite grupu turnusa');
      return;
    }

    const selectedGroup = groups.find(g => g.id === selectedGroupId);

    modal.confirm({
      title: 'Potvrda sinhronizacije',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            Da li ste sigurni da želite da pokrenete sinhronizaciju Changes
            Codes Tours sa Tiketing servera?
          </p>
          <p>
            <Text strong>
              Odabrana grupa: {selectedGroup?.name} (ID: {selectedGroupId})
            </Text>
          </p>
          <p>
            <Text type="warning">
              Napomena: UPSERT pristup - postojeći podaci će biti ažurirani sa
              novim podacima iz legacy baze (tabela changes_codes_tours).
            </Text>
          </p>
          {incompleteSync && (
            <Alert
              message="Nedovršena sinhronizacija pronađena!"
              description={`Poslednja sinhronizacija je prekinuta na ${Math.round((incompleteSync.processedRecords / incompleteSync.totalRecords) * 100)}% progresa. Nova sinhronizacija će nastaviti sa UPSERT pristupom.`}
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      ),
      okText: 'Da, pokreni sinhronizaciju',
      okType: 'primary',
      cancelText: 'Otkaži',
      onOk: async () => {
        setSyncing(true);
        setSyncResult(null);
        setActiveSyncId(null);
        try {
          const response = await turnusiService.syncFromTicketingAsync(selectedGroupId);
          setActiveSyncId(response.syncId);
          message.success('Sinhronizacija pokrenuta! Pratite progres u realnom vremenu...');
        } catch (error: any) {
          console.error('Greška pri pokretanju sinhronizacije:', error);
          message.error(
            error.response?.data?.message ||
              'Greška pri pokretanju sinhronizacije',
          );
          setSyncing(false);
        }
      },
    });
  };

  const handleSyncComplete = (syncLog: TurnusSyncLog) => {
    setSyncing(false);
    setActiveSyncId(null);
    setSyncResult({
      upserted: syncLog.upsertedRecords,
      skipped: 0,
      errors: syncLog.errorRecords,
      totalProcessed: syncLog.totalRecords,
    });
    message.success(
      `Sinhronizacija uspešno završena! Upsertovano: ${syncLog.upsertedRecords.toLocaleString()} rekorda`,
    );
    checkForIncompleteSync(selectedGroupId!);
  };

  const handleSyncError = (error: string) => {
    setSyncing(false);
    setActiveSyncId(null);
    message.error(`Greška tokom sinhronizacije: ${error}`);
    checkForIncompleteSync(selectedGroupId!);
  };

  return (
    <div>
      <Card className="mb-4">
        <Row justify="space-between" align="middle">
          <Col flex="auto">
            <Space>
              <ShoppingOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Tiketing Server - Changes Codes Tours
                </Title>
                <Text type="secondary">
                  Sinhronizacija Changes Codes Tours tabele po grupi
                </Text>
              </div>
            </Space>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Text strong>Odaberite grupu turnusa:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Odaberite grupu"
              value={selectedGroupId}
              onChange={setSelectedGroupId}
              loading={loading}
              disabled={loading || syncing}
            >
              {loading ? (
                <Option value="" disabled>
                  <Spin size="small" /> Učitavanje...
                </Option>
              ) : (
                groups.map(group => (
                  <Option key={group.id} value={group.id}>
                    {group.name} (ID: {group.id})
                  </Option>
                ))
              )}
            </Select>
          </Col>
          <Col span={12} style={{ display: 'flex', alignItems: 'flex-end' }}>
            {hasPermission('transport.administration.turnusi.ticketing:sync') && (
              <Button
                type="primary"
                icon={<SyncOutlined spin={syncing} />}
                onClick={handleSync}
                loading={syncing}
                disabled={!selectedGroupId}
                block
              >
                Sinhronizacija
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {incompleteSync && !activeSyncId && (
        <Card className="mt-4">
          <Alert
            message="Nedovršena sinhronizacija pronađena!"
            description={
              <div>
                <p>
                  Poslednja sinhronizacija za grupu <Text strong>{selectedGroupId}</Text> je prekinuta:
                </p>
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                  <li>Progres: <Text strong>{Math.round((incompleteSync.processedRecords / incompleteSync.totalRecords) * 100)}%</Text> ({incompleteSync.processedRecords.toLocaleString()} / {incompleteSync.totalRecords.toLocaleString()} rekorda)</li>
                  <li>Pokrenuto: <Text strong>{new Date(incompleteSync.startedAt).toLocaleString('sr-RS')}</Text></li>
                </ul>
                <p style={{ marginTop: 12, marginBottom: 0 }}>
                  <Text type="warning">
                    Nova sinhronizacija će koristiti UPSERT pristup i neće izgubiti postojeće podatke.
                  </Text>
                </p>
              </div>
            }
            type="warning"
            icon={<WarningOutlined />}
            showIcon
            closable
            onClose={() => setIncompleteSync(null)}
          />
        </Card>
      )}

      {activeSyncId && (
        <div className="mt-4">
          <SyncProgressTracker
            syncId={activeSyncId}
            onComplete={handleSyncComplete}
            onError={handleSyncError}
          />
        </div>
      )}

      {syncResult && !activeSyncId && (
        <Card className="mt-4">
          <Alert
            message="Rezultati sinhronizacije"
            description={
              <div>
                <Text strong>Sinhronizacija uspešno završena!</Text>
                <div style={{ marginTop: 12 }}>
                  <Text strong>Changes Codes Tours (changes_codes_tours):</Text>
                  <ul style={{ marginTop: 4, marginBottom: 8 }}>
                    <li>
                      Upsertovano rekorda (Created + Updated):{' '}
                      <Text strong>{syncResult.upserted.toLocaleString()}</Text>
                    </li>
                    <li>
                      Preskočeno: <Text strong>{syncResult.skipped}</Text>
                    </li>
                    <li>
                      Greške: <Text strong>{syncResult.errors}</Text>
                    </li>
                    <li>
                      Ukupno obrađeno:{' '}
                      <Text strong>{syncResult.totalProcessed.toLocaleString()}</Text>
                    </li>
                  </ul>
                </div>
              </div>
            }
            type="success"
            showIcon
            closable
            onClose={() => setSyncResult(null)}
          />
        </Card>
      )}
    </div>
  );
};

export default TicketingServerTab;
