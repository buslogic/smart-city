import React, { useEffect, useState } from 'react';
import {
  Modal,
  Table,
  Tag,
  Spin,
  Empty,
  message,
  Typography,
  Descriptions,
  Space,
  Tooltip,
  Alert,
} from 'antd';
import {
  EnvironmentOutlined,
  EyeInvisibleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { linesAdministrationService, StationsOnLineResponse } from '../../services/linesAdministration.service';

const { Title, Text } = Typography;

interface StationsModalProps {
  visible: boolean;
  onClose: () => void;
  priceTableIdent: string | null;
  lineNumberForDisplay?: string;
}

const StationsModal: React.FC<StationsModalProps> = ({
  visible,
  onClose,
  priceTableIdent,
  lineNumberForDisplay,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StationsOnLineResponse | null>(null);

  useEffect(() => {
    if (visible && priceTableIdent) {
      loadStations();
    }
  }, [visible, priceTableIdent]);

  const loadStations = async () => {
    if (!priceTableIdent) return;

    setLoading(true);
    try {
      const response = await linesAdministrationService.getStationsOnLine(priceTableIdent);
      setData(response);
    } catch (error: any) {
      console.error('Greška pri učitavanju stajališta:', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju stajališta');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Br.',
      dataIndex: 'stationNumber',
      key: 'stationNumber',
      width: 70,
      align: 'center' as const,
      render: (num: number) => <Text strong>{num}</Text>,
    },
    {
      title: 'Naziv stajališta',
      dataIndex: 'stationName',
      key: 'stationName',
      render: (name: string | null) => (
        <Text strong style={{ color: name ? '#1890ff' : '#999' }}>
          {name || 'Nepoznato'}
        </Text>
      ),
    },
    {
      title: 'Station UID',
      dataIndex: 'stationUid',
      key: 'stationUid',
      width: 120,
      align: 'center' as const,
    },
    {
      title: 'GPS Koordinate',
      key: 'gps',
      width: 200,
      render: (_: any, record: any) => {
        if (!record.gpsx || !record.gpsy) {
          return <Text type="secondary">-</Text>;
        }
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: '11px' }}>
              Lat: {parseFloat(record.gpsy).toFixed(6)}
            </Text>
            <Text style={{ fontSize: '11px' }}>
              Lng: {parseFloat(record.gpsx).toFixed(6)}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space>
          {record.transientStation ? (
            <Tooltip title="Prolazna stanica">
              <Tag color="orange" icon={<ClockCircleOutlined />}>
                Prolazna
              </Tag>
            </Tooltip>
          ) : (
            <Tag color="green">Regularna</Tag>
          )}
          {record.disableShowOnPublic && (
            <Tooltip title="Sakrivena od javnosti">
              <Tag color="red" icon={<EyeInvisibleOutlined />}>
                Sakrivena
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <EnvironmentOutlined className="text-blue-500" />
          <span>
            Stajališta - Linija {lineNumberForDisplay || data?.lineInfo?.lineNumberForDisplay || ''}
          </span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width="90%"
      style={{ top: 20, maxWidth: '1400px' }}
    >
      <Spin spinning={loading}>
        {data ? (
          <div>
            {/* Info header */}
            <div className="mb-4">
              <Descriptions bordered size="small" column={3}>
                <Descriptions.Item label="Sistemski broj">
                  {data.lineInfo.lineNumber}
                </Descriptions.Item>
                <Descriptions.Item label="Broj za prikaz">
                  {data.lineInfo.lineNumberForDisplay}
                </Descriptions.Item>
                <Descriptions.Item label="Ukupno stajališta">
                  <Tag color="blue">{data.totalStations}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Naziv linije" span={2}>
                  {data.lineInfo.lineTitle}
                </Descriptions.Item>
                <Descriptions.Item label="Grupa cenovnika">
                  {data.lineInfo.dateValidFrom}
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Info o tabeli */}
            <div className="mb-3">
              <Space>
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Izvor: {data.tableName}
                </Text>
              </Space>
            </div>

            {/* Upozorenje ako nema stanica */}
            {data.totalStations === 0 && (
              <Alert
                message="Nema definisanih stajališta"
                description={
                  <div>
                    <p>
                      Za ovu liniju nisu pronađena stajališta u bazi podataka.
                      Moguće razlozi:
                    </p>
                    <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
                      <li>Linija još nije sinhronizovana sa legacy sistema</li>
                      <li>Legacy sistem ne sadrži podatke o stajalištima za ovu liniju</li>
                      <li>Linija je u pripremi i stanice će biti dodane naknadno</li>
                    </ul>
                    <p style={{ marginTop: '8px', marginBottom: 0 }}>
                      <Text type="secondary">
                        Izvorna tabela: <Text code>{data.tableName}</Text>
                      </Text>
                    </p>
                  </div>
                }
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: '16px' }}
              />
            )}

            {/* Tabela */}
            <Table
              columns={columns}
              dataSource={data.stations}
              rowKey={(record) => `${record.stationNumber}-${record.stationUid}`}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} od ${total} stajališta`,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
              size="small"
              bordered
              locale={{
                emptyText: 'Nema stajališta',
              }}
            />
          </div>
        ) : (
          !loading && <Empty description="Nema podataka o stajalištima" />
        )}
      </Spin>
    </Modal>
  );
};

export default StationsModal;
