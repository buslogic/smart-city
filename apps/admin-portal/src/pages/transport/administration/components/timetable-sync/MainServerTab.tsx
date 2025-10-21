import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Space,
  Select,
  Table,
  Tag,
  Button,
  Tooltip,
  Spin,
  App,
} from 'antd';
import {
  DatabaseOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { timetableDatesService, TimetableDate } from '../../../../../services/timetableDates.service';
import { timetableSchedulesService, MainScheduleLine } from '../../../../../services/timetableSchedules.service';
import TimetableModal from '../../../../../components/transport/TimetableModal';

const { Title, Text } = Typography;

const MainServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<TimetableDate[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [lines, setLines] = useState<MainScheduleLine[]>([]);
  const [timetableModalVisible, setTimetableModalVisible] = useState(false);
  const [selectedPriceTableIdent, setSelectedPriceTableIdent] = useState<string | null>(null);
  const [selectedLineNumber, setSelectedLineNumber] = useState<string | undefined>();
  const { message } = App.useApp();

  // Helper funkcija za formatiranje datuma u YYYY-MM-DD bez UTC konverzije
  const formatDateLocal = (date: string | Date): string => {
    const dateObj = date instanceof Date ? date : new Date(date);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadGroups = async () => {
    setLoading(true);
    try {
      const result = await timetableDatesService.getAllMain();
      setGroups(result);

      // Automatski selektuj prvu aktivnu grupu
      const activeGroup = result.find((g) => g.status === 'A');
      if (activeGroup) {
        setSelectedGroup(formatDateLocal(activeGroup.dateValidFrom));
      }
    } catch (error: any) {
      console.error('Greška pri učitavanju grupa:', error);
      message.error('Greška pri učitavanju grupa datuma');
    } finally {
      setLoading(false);
    }
  };

  const loadLines = async () => {
    if (!selectedGroup) return;

    setLoading(true);
    try {
      const result = await timetableSchedulesService.getAllMain(selectedGroup);
      setLines(result.data);
    } catch (error: any) {
      console.error('Greška pri učitavanju linija:', error);
      message.error('Greška pri učitavanju linija');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadLines();
    }
  }, [selectedGroup]);

  const handleOpenTimetable = (record: MainScheduleLine) => {
    setSelectedPriceTableIdent(record.priceTableIdent);
    setSelectedLineNumber(record.lineNumberForDisplay);
    setTimetableModalVisible(true);
  };

  const handleCloseTimetable = () => {
    setTimetableModalVisible(false);
    setSelectedPriceTableIdent(null);
    setSelectedLineNumber(undefined);
  };

  const renderSyncStatus = (record: MainScheduleLine) => {
    const tags = [];

    if (record.hasTicketingData) {
      tags.push(
        <Tooltip key="ticketing" title={`Sinhronizovano ${record.legacyTicketingCount} rekorda sa Ticketing servera`}>
          <Tag color="purple">T: {record.legacyTicketingCount}</Tag>
        </Tooltip>
      );
    }

    if (record.hasCityData) {
      tags.push(
        <Tooltip key="city" title={`Sinhronizovano ${record.legacyCityCount} rekorda sa City servera`}>
          <Tag color="green">C: {record.legacyCityCount}</Tag>
        </Tooltip>
      );
    }

    if (tags.length === 0) {
      return <Text type="secondary">-</Text>;
    }

    return <Space>{tags}</Space>;
  };

  const columns: ColumnsType<MainScheduleLine> = [
    {
      title: 'Sistemski broj',
      dataIndex: 'lineNumber',
      key: 'lineNumber',
      width: 120,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Broj za prikaz',
      dataIndex: 'lineNumberForDisplay',
      key: 'lineNumberForDisplay',
      width: 120,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Naziv linije',
      dataIndex: 'lineTitle',
      key: 'lineTitle',
      ellipsis: true,
    },
    {
      title: 'Smer',
      dataIndex: 'direction',
      key: 'direction',
      width: 80,
      align: 'center',
    },
    {
      title: 'Tip',
      dataIndex: 'lineType',
      key: 'lineType',
      width: 100,
    },
    {
      title: 'Ukupno rekorda',
      dataIndex: 'totalSchedules',
      key: 'totalSchedules',
      width: 140,
      align: 'center',
      render: (count: number) => (
        <Tag color="blue" icon={<CheckCircleOutlined />}>
          {count}
        </Tag>
      ),
    },
    {
      title: 'Status sinhronizacije',
      key: 'syncStatus',
      width: 200,
      align: 'center',
      render: (_: any, record: MainScheduleLine) => renderSyncStatus(record),
    },
    {
      title: 'Akcije',
      key: 'actions',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_: any, record: MainScheduleLine) => (
        <Tooltip title="Red vožnje">
          <Button
            type="primary"
            size="small"
            icon={<ClockCircleOutlined />}
            onClick={() => handleOpenTimetable(record)}
          >
            RV
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <Card className="mb-4">
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Glavni server</Title>
                <Text type="secondary">RedVoznje sinhronizacija - Glavni server (READ-ONLY)</Text>
              </div>
            </Space>
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
                options={groups.map((group) => {
                  const formattedDate = formatDateLocal(group.dateValidFrom);
                  return {
                    value: formattedDate,
                    label: `${group.name} | ${formattedDate} | Status: ${group.status}`,
                  };
                })}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {selectedGroup && (
        <Card>
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
            <Space>
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
              <Text strong>Sinhronizovane linije za datum: {selectedGroup}</Text>
            </Space>
            <Text type="secondary">
              Prikazane su samo linije koje imaju sinhronizovane podatke u vremena_polaska tabeli.
              Kolona "Status sinhronizacije" pokazuje odakle su podaci sinhronizovani (T = Ticketing, C = City).
            </Text>
          </Space>

          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={lines}
              rowKey="priceTableIdent"
              pagination={{
                pageSize: 50,
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} od ${total} linija`,
                pageSizeOptions: ['25', '50', '100'],
              }}
              scroll={{ x: 1200 }}
              locale={{
                emptyText: 'Nema sinhronizovanih podataka za ovu grupu datuma',
              }}
            />
          </Spin>
        </Card>
      )}

      {/* Timetable Modal */}
      <TimetableModal
        visible={timetableModalVisible}
        onClose={handleCloseTimetable}
        priceTableIdent={selectedPriceTableIdent}
        lineNumberForDisplay={selectedLineNumber}
      />
    </div>
  );
};

export default MainServerTab;
