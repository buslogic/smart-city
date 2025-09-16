import React, { useState, useEffect } from 'react';
import { Card, Progress, Button, Space, Tag, Alert, Table, Statistic, Row, Col, Timeline, Modal, Spin, message, DatePicker, Form } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, StopOutlined, CheckCircleOutlined, ReloadOutlined, WarningOutlined, CalendarOutlined } from '@ant-design/icons';
import migrationService, { MigrationStatus, MigrationLog, VerificationResult } from '../../services/migrationService';
import { formatDistanceToNow } from 'date-fns';
import { sr } from 'date-fns/locale';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const MigrationPage: React.FC = () => {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [startingMigration, setStartingMigration] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Fetch status
  const fetchStatus = async () => {
    console.log('fetchStatus called');
    try {
      const data = await migrationService.getStatus();
      console.log('Status data received:', data);
      setStatus(data);

      // Fetch logs ako je migracija u toku
      if (data.status === 'running' || data.status === 'completed') {
        const logsData = await migrationService.getLogs(20);
        setLogs(logsData.logs || []);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  // Start migration - SIMPLE VERSION
  const handleStartSimple = async () => {
    console.log('=== SIMPLE START CLICKED ===');
    console.log('Date range exists?', !!dateRange);
    console.log('Starting migration flag?', startingMigration);
    console.log('Current status?', status?.status);

    if (!dateRange) {
      console.log('NO DATE RANGE - showing warning');
      message.warning('Molimo odaberite datumski opseg za migraciju');
      return;
    }

    if (startingMigration) {
      console.log('ALREADY STARTING - showing warning');
      message.warning('Migracija se već pokreće, molimo sačekajte...');
      return;
    }

    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1].format('YYYY-MM-DD');

    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);
    console.log('Setting startingMigration to true');

    setStartingMigration(true);
    setLoading(true);

    try {
      console.log('Calling migration service...');
      console.log('API URL:', import.meta.env.VITE_API_URL || 'http://localhost:3010');
      const result = await migrationService.startMigration(startDate, endDate);
      console.log('Migration result:', result);

      if (result.success) {
        message.success('Migracija je pokrenuta uspešno!');
        console.log('Fetching status after successful start...');
        await fetchStatus();
      } else {
        message.error(result.message || 'Migracija nije uspela');
        console.log('Migration failed:', result.message);
      }
    } catch (error: any) {
      console.error('Migration error FULL:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      const errorMsg = error.response?.data?.message || error.message || 'Greška pri pokretanju migracije';
      message.error(errorMsg);
    } finally {
      console.log('Setting startingMigration to false');
      setLoading(false);
      setStartingMigration(false);
    }
  };

  // Start migration with confirmation
  const handleStart = async () => {
    if (!dateRange) {
      message.warning('Molimo odaberite datumski opseg za migraciju');
      return;
    }

    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1].format('YYYY-MM-DD');
    const days = dateRange[1].diff(dateRange[0], 'day') + 1;

    Modal.confirm({
      title: 'Pokreni Timezone Migraciju',
      content: (
        <div>
          <p>Da li ste sigurni da želite da pokrenete migraciju?</p>
          <div className="mt-3 p-3 bg-blue-50 rounded">
            <div><strong>Od datuma:</strong> {startDate}</div>
            <div><strong>Do datuma:</strong> {endDate}</div>
            <div><strong>Broj dana:</strong> {days}</div>
            <div className="mt-2 text-sm text-gray-600">
              <strong>Procenjeno vreme:</strong> ~{Math.ceil(days * 10)} sekundi
            </div>
          </div>
        </div>
      ),
      okText: 'Pokreni',
      cancelText: 'Otkaži',
      onOk: () => handleStartSimple()
    });
  };

  // Abort migration
  const handleAbort = async () => {
    Modal.confirm({
      title: 'Prekini Migraciju',
      content: 'Da li ste sigurni da želite da prekinete migraciju? Možete je nastaviti kasnije.',
      okText: 'Prekini',
      okType: 'danger',
      cancelText: 'Otkaži',
      onOk: async () => {
        setLoading(true);
        try {
          const result = await migrationService.abortMigration();
          if (result.success) {
            message.warning('Migracija je prekinuta');
            fetchStatus();
          }
        } catch (error) {
          message.error('Greška pri prekidanju migracije');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Verify migration
  const handleVerify = async () => {
    setLoading(true);
    try {
      const result = await migrationService.verifyMigration();
      setVerificationResult(result);
    } catch (error) {
      message.error('Greška pri verifikaciji');
    } finally {
      setLoading(false);
    }
  };

  // Auto refresh
  useEffect(() => {
    fetchStatus();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchStatus();
      }, status?.status === 'running' ? 2000 : 5000); // Brži refresh dok radi
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, status?.status]);

  // Status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running': return 'processing';
      case 'completed': return 'success';
      case 'error': return 'error';
      case 'aborted': return 'warning';
      case 'initialized': return 'default';
      case 'ready_for_migration': return 'default';
      case 'not_started': return 'default';
      default: return 'default';
    }
  };

  // Progress status
  const getProgressStatus = () => {
    if (status?.status === 'error') return 'exception';
    if (status?.status === 'completed') return 'success';
    if (status?.status === 'running') return 'active';
    return 'normal';
  };

  // Format number
  const formatNumber = (num?: number) => {
    if (!num) return '0';
    return new Intl.NumberFormat('sr-RS').format(num);
  };

  // Format duration
  const formatDuration = (duration?: string) => {
    if (!duration) return '-';
    return duration;
  };

  return (
    <Spin spinning={startingMigration} tip="Pokretanje migracije..." size="large">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">GPS Timezone Migracija</h1>
          <p className="text-gray-600">Ispravka timezone problema - pomeranje vremena za -2 sata</p>
        </div>

      {/* Date Range Selection Card */}
      <Card className="mb-6" title="Odabir Datumskog Opsega">
        <Form layout="vertical">
          <Form.Item label="Odaberite period za migraciju">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <RangePicker
                style={{ width: '100%' }}
                format="DD.MM.YYYY"
                placeholder={['Od datuma', 'Do datuma']}
                onChange={(dates) => {
                  if (dates) {
                    setDateRange([dates[0]!, dates[1]!]);
                  } else {
                    setDateRange(null);
                  }
                }}
                disabled={status?.status === 'running'}
                disabledDate={(current) => {
                  // Disable budući datumi
                  return current && current.isAfter(dayjs().endOf('day'));
                }}
              />
              {dateRange && (
                <Alert
                  type="info"
                  message={`Odabrano: ${dateRange[1].diff(dateRange[0], 'day') + 1} dana`}
                  description={
                    <div>
                      <div>Od: {dateRange[0].format('DD.MM.YYYY')}</div>
                      <div>Do: {dateRange[1].format('DD.MM.YYYY')}</div>
                    </div>
                  }
                />
              )}
              <div className="text-sm text-gray-600">
                <p><strong>Preporuke za testiranje:</strong></p>
                <ul className="list-disc ml-5">
                  <li>Prvo testirajte sa 1-2 dana da vidite brzinu</li>
                  <li>Zatim probajte sa 7 dana (nedelja podataka)</li>
                  <li>Na kraju pokrenite za ceo period</li>
                </ul>
              </div>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* Status Card */}
      <Card className="mb-6">
        <div className="mb-4 flex justify-between items-center">
          <Space>
            <h2 className="text-lg font-semibold">Status Migracije</h2>
            <Tag color={getStatusColor(status?.status)}>
              {status?.status?.toUpperCase() || 'NOT STARTED'}
            </Tag>
            {status?.startDate && status?.endDate && (
              <Tag icon={<CalendarOutlined />}>
                {status.startDate} - {status.endDate}
              </Tag>
            )}
            {status?.error_message && (
              <Tag color="error" icon={<WarningOutlined />}>
                {status.error_message}
              </Tag>
            )}
          </Space>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchStatus}
              loading={loading}
            >
              Osveži
            </Button>
            <Button
              type={autoRefresh ? 'default' : 'primary'}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
            </Button>
          </Space>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <Progress
            percent={Number(status?.progressPercent?.toFixed(2) || 0)}
            status={getProgressStatus()}
            format={(percent) => `${percent}%`}
          />
          <div className="mt-2 text-sm text-gray-600">
            {formatNumber(status?.recordsMigrated)} od {formatNumber(status?.estimatedTotal)} zapisa
            {status?.currentDate && ` • Trenutni datum: ${status.currentDate}`}
          </div>
        </div>

        {/* Statistics */}
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Migrirano zapisa"
              value={formatNumber(status?.recordsMigrated)}
              suffix={`/ ${formatNumber(status?.estimatedTotal)}`}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Brzina"
              value={formatNumber(status?.recordsPerSecond)}
              suffix="zapisa/s"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Vreme rada"
              value={formatDuration(status?.runningTime)}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Procenjeno preostalo (ETA)"
              value={formatDuration(status?.eta)}
            />
          </Col>
        </Row>

        {/* Controls */}
        <div className="mt-6">
          <Space>
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={handleStart}
              loading={startingMigration}
              disabled={!dateRange || status?.status === 'running' || startingMigration}
            >
              {startingMigration ? 'Pokretanje...' : 'Pokreni Migraciju'}
            </Button>

            {/* DIREKTNO DUGME BEZ MODAL-A */}
            <Button
              type="default"
              size="large"
              style={{ backgroundColor: '#52c41a', color: 'white' }}
              icon={<PlayCircleOutlined />}
              onClick={() => {
                console.log('DIREKTNO BUTTON CLICKED!');
                handleStartSimple();
              }}
              loading={startingMigration}
              disabled={!dateRange || status?.status === 'running' || startingMigration}
            >
              DIREKTNO Pokreni (bez potvrde)
            </Button>

            <Button
              danger
              size="large"
              icon={<StopOutlined />}
              onClick={handleAbort}
              loading={loading}
              disabled={status?.status !== 'running'}
            >
              Prekini
            </Button>
            <Button
              size="large"
              icon={<CheckCircleOutlined />}
              onClick={handleVerify}
              loading={loading}
            >
              Verifikuj
            </Button>
          </Space>
        </div>
      </Card>

      {/* Verification Results */}
      {verificationResult && (
        <Card title="Rezultati Verifikacije" className="mb-6">
          <Table
            dataSource={verificationResult.checks}
            columns={[
              {
                title: 'Provera',
                dataIndex: 'checkName',
                key: 'checkName',
              },
              {
                title: 'Originalna tabela',
                dataIndex: 'originalValue',
                key: 'originalValue',
              },
              {
                title: 'Nova tabela',
                dataIndex: 'fixedValue',
                key: 'fixedValue',
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => (
                  <Tag color={status === 'OK' ? 'success' : status === 'MISMATCH' ? 'error' : 'warning'}>
                    {status}
                  </Tag>
                ),
              },
            ]}
            pagination={false}
            rowKey="checkName"
          />
        </Card>
      )}

      {/* Recent Logs */}
      {logs.length > 0 && (
        <Card title="Poslednji logovi">
          <Timeline>
            {logs.map((log) => (
              <Timeline.Item
                key={log.id}
                color={log.action.includes('ERROR') ? 'red' : log.action.includes('COMPLETED') ? 'green' : 'blue'}
              >
                <div>
                  <Tag>{log.action}</Tag>
                  <span className="ml-2">{log.message}</span>
                  {log.recordsAffected && (
                    <span className="ml-2 text-gray-500">
                      ({formatNumber(log.recordsAffected)} zapisa)
                    </span>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(log.createdAt), {
                      addSuffix: true,
                      locale: sr
                    })}
                  </div>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}

      {/* Info Alert */}
      <Alert
        message="Informacije o migraciji"
        description={
          <div>
            <p>• Migracija radi po danima, commit nakon svakog dana</p>
            <p>• Za lokalni test: ~1 milion zapisa po danu, ~10-12 sekundi</p>
            <p>• Za produkciju: ~304 miliona zapisa, procena 24-48 sati</p>
            <p>• Tabele: gps_data (originalna) → gps_data_fixed (ispravljena sa -2h)</p>
          </div>
        }
        type="info"
        showIcon
      />
      </div>
    </Spin>
  );
};

export default MigrationPage;