import React, { useState } from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Space,
  Alert,
  Button,
  App,
} from 'antd';
import {
  GlobalOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import {
  turnusiSyncService,
  TurnusiSyncResult,
} from '../../../../../services/turnusiSync.service';

const { Title, Text } = Typography;

const CityServerTab: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<TurnusiSyncResult | null>(null);
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  const handleSync = () => {
    modal.confirm({
      title: 'Potvrda sinhronizacije',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            Da li ste sigurni da želite da pokrenete sinhronizaciju Turnusa sa
            Gradskog servera?
          </p>
          <p>
            <Text type="warning">
              Napomena: Biće sinhronizovane SVE tabele - turnus_groups_names,
              turnus_groups_assign i turnus_days sa SVIM podacima iz legacy
              baze.
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
          const result = await turnusiSyncService.syncFromCity();
          setSyncResult(result);
          message.success(result.message);
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
          <Col>
            <Space>
              <GlobalOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Gradski Server
                </Title>
                <Text type="secondary">
                  Turnusi sinhronizacija - Gradski Server (Legacy)
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            {hasPermission(
              'transport.administration.turnusi_sync.city:sync',
            ) && (
              <Button
                type="primary"
                icon={<SyncOutlined spin={syncing} />}
                onClick={handleSync}
                loading={syncing}
              >
                Sinhronizacija
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {syncResult && syncResult.success && (
        <Card className="mt-4">
          <Alert
            message="Rezultati sinhronizacije"
            description={
              <div>
                <Text strong>Sinhronizacija uspešno završena!</Text>
                <div style={{ marginTop: 12 }}>
                  <Text strong>
                    Turnus Groups Names (turnus_groups_names):
                  </Text>
                  <ul style={{ marginTop: 4, marginBottom: 8 }}>
                    <li>
                      Kreirano:{' '}
                      <Text strong>
                        {syncResult.turnusGroupsNames.created}
                      </Text>
                    </li>
                    <li>
                      Ažurirano:{' '}
                      <Text strong>
                        {syncResult.turnusGroupsNames.updated}
                      </Text>
                    </li>
                    <li>
                      Preskočeno:{' '}
                      <Text strong>
                        {syncResult.turnusGroupsNames.skipped}
                      </Text>
                    </li>
                    <li>
                      Greške:{' '}
                      <Text strong>{syncResult.turnusGroupsNames.errors}</Text>
                    </li>
                    <li>
                      Ukupno obrađeno:{' '}
                      <Text strong>
                        {syncResult.turnusGroupsNames.totalProcessed}
                      </Text>
                    </li>
                  </ul>

                  <Text strong>
                    Turnus Groups Assign (turnus_groups_assign):
                  </Text>
                  <ul style={{ marginTop: 4, marginBottom: 8 }}>
                    <li>
                      Kreirano:{' '}
                      <Text strong>
                        {syncResult.turnusGroupsAssign.created}
                      </Text>
                    </li>
                    <li>
                      Ažurirano:{' '}
                      <Text strong>
                        {syncResult.turnusGroupsAssign.updated}
                      </Text>
                    </li>
                    <li>
                      Preskočeno:{' '}
                      <Text strong>
                        {syncResult.turnusGroupsAssign.skipped}
                      </Text>
                    </li>
                    <li>
                      Greške:{' '}
                      <Text strong>
                        {syncResult.turnusGroupsAssign.errors}
                      </Text>
                    </li>
                    <li>
                      Ukupno obrađeno:{' '}
                      <Text strong>
                        {syncResult.turnusGroupsAssign.totalProcessed}
                      </Text>
                    </li>
                  </ul>

                  <Text strong>Turnus Days (turnus_days):</Text>
                  <ul style={{ marginTop: 4, marginBottom: 8 }}>
                    <li>
                      Kreirano:{' '}
                      <Text strong>{syncResult.turnusDays.created}</Text>
                    </li>
                    <li>
                      Ažurirano:{' '}
                      <Text strong>{syncResult.turnusDays.updated}</Text>
                    </li>
                    <li>
                      Preskočeno:{' '}
                      <Text strong>{syncResult.turnusDays.skipped}</Text>
                    </li>
                    <li>
                      Greške:{' '}
                      <Text strong>{syncResult.turnusDays.errors}</Text>
                    </li>
                    <li>
                      Ukupno obrađeno:{' '}
                      <Text strong>
                        {syncResult.turnusDays.totalProcessed}
                      </Text>
                    </li>
                  </ul>

                  <Text type="secondary">
                    Ukupno obrađeno rekorda:{' '}
                    <Text strong>{syncResult.totalProcessed}</Text>
                  </Text>
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

export default CityServerTab;
