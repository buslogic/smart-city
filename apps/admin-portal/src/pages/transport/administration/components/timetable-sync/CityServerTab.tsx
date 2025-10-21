import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Space,
  Select,
  Alert,
  Button,
  App,
} from 'antd';
import {
  GlobalOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { timetableDatesService, TimetableDate } from '../../../../../services/timetableDates.service';
import { timetableSchedulesService, TimetableSchedulesSyncResult } from '../../../../../services/timetableSchedules.service';

const { Title, Text } = Typography;

const CityServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [groups, setGroups] = useState<TimetableDate[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [syncResult, setSyncResult] = useState<TimetableSchedulesSyncResult | null>(null);
  const { hasPermission } = usePermissions();
  const { modal, message } = App.useApp();

  const loadGroups = async () => {
    setLoading(true);
    try {
      const result = await timetableDatesService.getAllCity();
      setGroups(result);
    } catch (error: any) {
      console.error('Greška pri učitavanju grupa:', error);
      message.error('Greška pri učitavanju grupa datuma');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = () => {
    if (!selectedGroup) {
      message.warning('Molimo odaberite grupu datuma pre pokretanja sinhronizacije');
      return;
    }

    modal.confirm({
      title: 'Potvrda sinhronizacije',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Da li ste sigurni da želite da pokrenete sinhronizaciju RedVoznje sa Gradskog servera?</p>
          <p>
            <Text type="warning">
              Napomena: Biće sinhronizovane tabele vremena_polaska i vremena_polaska_st za datum: <Text strong>{selectedGroup}</Text>
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
          const result = await timetableSchedulesService.syncFromCity(selectedGroup);
          setSyncResult(result);
          message.success(result.message);
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

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <div>
      <Card className="mb-4">
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <GlobalOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Gradski server</Title>
                <Text type="secondary">RedVoznje sinhronizacija - Gradski server (READ-ONLY)</Text>
              </div>
            </Space>
          </Col>
          <Col>
            {hasPermission('transport.administration.timetable_sync.city:sync') && (
              <Button
                type="primary"
                icon={<SyncOutlined spin={syncing} />}
                onClick={handleSync}
                loading={syncing}
                disabled={!selectedGroup || loading}
              >
                Sinhronizacija
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      <Card className="mb-4">
        <Row gutter={16}>
          <Col span={24}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Izaberite grupu datuma (RedVoznje):</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Odaberite grupu datuma"
                value={selectedGroup}
                onChange={setSelectedGroup}
                loading={loading}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={groups.map((group: any) => ({
                  value: group.date_valid_from || group.dateValidFrom,
                  label: `${group.name} | ${group.date_valid_from || group.dateValidFrom} | Status: ${group.status}`,
                }))}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {selectedGroup && (
        <Card>
          <Alert
            message="Grupa datuma odabrana"
            description={`Odabrana grupa: ${selectedGroup}. Kliknite na dugme "Sinhronizacija" da pokrenete sinhronizaciju RedVoznje.`}
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />
        </Card>
      )}

      {syncResult && syncResult.success && (
        <Card className="mt-4">
          <Alert
            message="Rezultati sinhronizacije"
            description={
              <div>
                <Text strong>Sinhronizacija uspešno završena!</Text>
                <div style={{ marginTop: 12 }}>
                  <Text strong>Vremena polaska (vremena_polaska):</Text>
                  <ul style={{ marginTop: 4, marginBottom: 8 }}>
                    <li>Kreirano: <Text strong>{syncResult.vremenaPolaska.created}</Text></li>
                    <li>Ažurirano: <Text strong>{syncResult.vremenaPolaska.updated}</Text></li>
                    <li>Preskočeno: <Text strong>{syncResult.vremenaPolaska.skipped}</Text></li>
                    <li>Greške: <Text strong>{syncResult.vremenaPolaska.errors}</Text></li>
                    <li>Ukupno obrađeno: <Text strong>{syncResult.vremenaPolaska.totalProcessed}</Text></li>
                  </ul>

                  <Text strong>Vremena polaska stanice (vremena_polaska_st):</Text>
                  <ul style={{ marginTop: 4, marginBottom: 8 }}>
                    <li>Kreirano: <Text strong>{syncResult.vremenaPolaskaSt.created}</Text></li>
                    <li>Ažurirano: <Text strong>{syncResult.vremenaPolaskaSt.updated}</Text></li>
                    <li>Preskočeno: <Text strong>{syncResult.vremenaPolaskaSt.skipped}</Text></li>
                    <li>Greške: <Text strong>{syncResult.vremenaPolaskaSt.errors}</Text></li>
                    <li>Ukupno obrađeno: <Text strong>{syncResult.vremenaPolaskaSt.totalProcessed}</Text></li>
                  </ul>

                  <Text type="secondary">
                    Ukupno obrađeno rekorda: <Text strong>{syncResult.totalProcessed}</Text>
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
