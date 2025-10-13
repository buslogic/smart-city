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
} from 'antd';
import {
  ShoppingOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import {
  turnusiService,
  SyncResultDetail,
  TurnusGroup,
} from '../../../../../services/turnusi.service';

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
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  useEffect(() => {
    loadGroups();
  }, []);

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
              Napomena: Postojeći podaci za ovu grupu će biti obrisani i
              zamenjeni novim podacima iz legacy baze (tabela
              changes_codes_tours).
            </Text>
          </p>
        </div>
      ),
      okText: 'Da, pokreni sinhronizaciju',
      okType: 'primary',
      cancelText: 'Otkaži',
      onOk: async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
          const result = await turnusiService.syncFromTicketing(selectedGroupId);
          setSyncResult(result);
          message.success(
            `Sinhronizacija uspešna! Obrisano: ${result.deleted}, Kreirano: ${result.created}`,
          );
        } catch (error: any) {
          console.error('Greška pri sinhronizaciji:', error);
          message.error(
            error.response?.data?.message ||
              'Greška pri sinhronizaciji podataka',
          );
        } finally {
          setSyncing(false);
        }
      },
    });
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

      {syncResult && (
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
                      Obrisano starih rekorda:{' '}
                      <Text strong>{syncResult.deleted}</Text>
                    </li>
                    <li>
                      Kreirano novih rekorda:{' '}
                      <Text strong>{syncResult.created}</Text>
                    </li>
                    <li>
                      Preskočeno: <Text strong>{syncResult.skipped}</Text>
                    </li>
                    <li>
                      Greške: <Text strong>{syncResult.errors}</Text>
                    </li>
                    <li>
                      Ukupno obrađeno:{' '}
                      <Text strong>{syncResult.totalProcessed}</Text>
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
