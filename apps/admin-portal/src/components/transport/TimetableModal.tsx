import React, { useEffect, useState } from 'react';
import {
  Modal,
  Tabs,
  Collapse,
  Table,
  Tag,
  Spin,
  Empty,
  message,
  Space,
  Typography,
  Descriptions,
  Tooltip,
} from 'antd';
import {
  ClockCircleOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { linesAdministrationService } from '../../services/linesAdministration.service';
import StationTimesDrawer from './StationTimesDrawer';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface TimetableSchedule {
  id: number;
  datum: string;
  idlinije: string;
  smer: number;
  pon: string;
  uto: string;
  sre: string;
  cet: string;
  pet: string;
  sub: string;
  ned: string;
  dk1: string;
  dk1naziv: string;
  dk2: string;
  dk2naziv: string;
  dk3: string;
  dk3naziv: string;
  dk4: string;
  dk4naziv: string;
  variation: number;
  datetimeFrom: Date;
  datetimeTo: Date;
  variationDescription: string;
  legacyTicketingId: number | null;
  legacyCityId: number | null;
}

interface TimetableResponse {
  schedules: TimetableSchedule[];
  lineInfo: {
    lineNumber: string;
    lineNumberForDisplay: string;
    lineTitle: string;
  };
}

interface TimetableModalProps {
  visible: boolean;
  onClose: () => void;
  priceTableIdent: string | null;
  lineNumberForDisplay?: string;
}

const TimetableModal: React.FC<TimetableModalProps> = ({
  visible,
  onClose,
  priceTableIdent,
  lineNumberForDisplay,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TimetableResponse | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedDeparture, setSelectedDeparture] = useState<{
    idlinije: string;
    smer: number;
    dan: string;
    vreme: string;
  } | null>(null);

  useEffect(() => {
    if (visible && priceTableIdent) {
      loadTimetables();
    }
  }, [visible, priceTableIdent]);

  const loadTimetables = async () => {
    if (!priceTableIdent) return;

    setLoading(true);
    try {
      const response = await linesAdministrationService.getTimetables(priceTableIdent);
      setData(response);
    } catch (error) {
      console.error('Greška pri učitavanju reda vožnje:', error);
      message.error('Greška pri učitavanju reda vožnje');
    } finally {
      setLoading(false);
    }
  };

  const parseTimes = (timesStr: string): string[] => {
    if (!timesStr || timesStr.trim() === '') return [];
    return timesStr.split(',').map((t) => t.trim());
  };

  const renderTimeTags = (times: string[], compact = false) => {
    if (times.length === 0) {
      return <Text type="secondary" style={{ fontSize: '11px' }}>-</Text>;
    }

    if (compact) {
      // Prikaz u jednoj liniji sa malim fontom
      return (
        <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
          {times.map((time, idx) => (
            <span key={idx} style={{ marginRight: '6px', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#1890ff', fontWeight: 500 }}>{time}</span>
              {idx < times.length - 1 && <span style={{ color: '#d9d9d9' }}>,</span>}
            </span>
          ))}
        </div>
      );
    }

    return (
      <Space wrap size={[4, 4]}>
        {times.map((time, idx) => (
          <Tag key={idx} color="blue">
            {time}
          </Tag>
        ))}
      </Space>
    );
  };

  // Grupiši vremena po satima
  const groupTimesByHour = (times: string[]): Record<number, string[]> => {
    const grouped: Record<number, string[]> = {};
    times.forEach((time) => {
      const [hourStr] = time.split(':');
      const hour = parseInt(hourStr, 10);
      if (!grouped[hour]) grouped[hour] = [];
      grouped[hour].push(time);
    });
    return grouped;
  };

  const handleTimeClick = (dan: string, vreme: string, smer: number) => {
    if (!priceTableIdent) return;
    setSelectedDeparture({
      idlinije: priceTableIdent,
      smer,
      dan,
      vreme,
    });
    setDrawerVisible(true);
  };

  const renderDaySchedule = (schedule: TimetableSchedule) => {
    const days = [
      { key: 'pon', label: 'Ponedeljak', value: schedule.pon },
      { key: 'uto', label: 'Utorak', value: schedule.uto },
      { key: 'sre', label: 'Sreda', value: schedule.sre },
      { key: 'cet', label: 'Četvrtak', value: schedule.cet },
      { key: 'pet', label: 'Petak', value: schedule.pet },
      { key: 'sub', label: 'Subota', value: schedule.sub },
      { key: 'ned', label: 'Nedelja', value: schedule.ned },
    ];
    const currentSmer = schedule.smer;

    // Grupiši vremena po satima za svaki dan
    const daysByHour: Record<string, Record<number, string[]>> = {};
    days.forEach((day) => {
      const times = parseTimes(day.value);
      daysByHour[day.key] = groupTimesByHour(times);
    });

    // Nađi sve sate koji imaju bar jedan polazak
    const allHours = new Set<number>();
    Object.values(daysByHour).forEach((hourMap) => {
      Object.keys(hourMap).forEach((hour) => allHours.add(parseInt(hour)));
    });
    const sortedHours = Array.from(allHours).sort((a, b) => a - b);

    // Kreiraj kolone - svaki dan ima 2 podkolone (Čas | Minut)
    const columns: any[] = [];

    days.forEach((day) => {
      // Boje za vikend
      let headerStyle = {};
      if (day.key === 'sub') {
        headerStyle = { backgroundColor: '#e6f7ff' }; // Svetlo plava za subotu
      } else if (day.key === 'ned') {
        headerStyle = { backgroundColor: '#fff1f0' }; // Svetlo crvena za nedelju
      }

      columns.push({
        title: <strong>{day.label}</strong>,
        onHeaderCell: () => ({ style: headerStyle }),
        children: [
          {
            title: 'Čas',
            dataIndex: `${day.key}_hour`,
            key: `${day.key}_hour`,
            width: 45,
            align: 'center' as const,
            onCell: () => ({ style: headerStyle }),
            render: (_: any, record: any) => {
              const times = daysByHour[day.key][record.hour] || [];
              if (times.length === 0) return <Text type="secondary">-</Text>;
              return <Text style={{ fontSize: '11px' }}>{record.hour.toString().padStart(2, '0')}</Text>;
            },
          },
          {
            title: 'Minut',
            dataIndex: `${day.key}_minutes`,
            key: `${day.key}_minutes`,
            width: 200,
            align: 'left' as const,
            onCell: () => ({ style: headerStyle }),
            render: (_: any, record: any) => {
              const times = daysByHour[day.key][record.hour] || [];
              if (times.length === 0) return <Text type="secondary">-</Text>;

              // Izvuci samo minute i dodaj onClick
              return (
                <div style={{ fontSize: '11px', fontFamily: 'monospace', lineHeight: '1.5' }}>
                  {times.map((time, idx) => (
                    <span
                      key={idx}
                      onClick={() => handleTimeClick(day.key, time, currentSmer)}
                      style={{
                        marginRight: '6px',
                        cursor: 'pointer',
                        color: '#1890ff',
                        textDecoration: 'underline',
                      }}
                    >
                      {time.split(':')[1]}
                    </span>
                  ))}
                </div>
              );
            },
          },
        ],
      });
    });

    // Kreiraj data source - svaki red je jedan sat
    const dataSource = sortedHours.map((hour) => ({
      hour,
      key: hour,
    }));

    return (
      <div>
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="hour"
          pagination={false}
          size="small"
          scroll={{ x: 1800 }}
          className="mb-4"
          bordered
        />

        {/* Special Days */}
        {(schedule.dk1naziv || schedule.dk2naziv || schedule.dk3naziv || schedule.dk4naziv) && (
          <div className="mt-4">
            <Title level={5}>
              <InfoCircleOutlined className="mr-2" />
              Specijalni dani
            </Title>
            <Descriptions bordered size="small" column={1}>
              {schedule.dk1naziv && (
                <Descriptions.Item label={schedule.dk1naziv}>
                  {renderTimeTags(parseTimes(schedule.dk1))}
                </Descriptions.Item>
              )}
              {schedule.dk2naziv && (
                <Descriptions.Item label={schedule.dk2naziv}>
                  {renderTimeTags(parseTimes(schedule.dk2))}
                </Descriptions.Item>
              )}
              {schedule.dk3naziv && (
                <Descriptions.Item label={schedule.dk3naziv}>
                  {renderTimeTags(parseTimes(schedule.dk3))}
                </Descriptions.Item>
              )}
              {schedule.dk4naziv && (
                <Descriptions.Item label={schedule.dk4naziv}>
                  {renderTimeTags(parseTimes(schedule.dk4))}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </div>
    );
  };

  const renderVariationPanel = (schedules: TimetableSchedule[]) => {
    // Group by variation
    const grouped = schedules.reduce((acc, schedule) => {
      const key = schedule.variation;
      if (!acc[key]) acc[key] = [];
      acc[key].push(schedule);
      return acc;
    }, {} as Record<number, TimetableSchedule[]>);

    return (
      <Collapse defaultActiveKey={['0']} className="mt-2">
        {Object.entries(grouped).map(([variation, varSchedules]) => {
          const schedule = varSchedules[0]; // Uzmemo prvi za metadata
          const variationLabel =
            variation === '0'
              ? 'Osnovna varijacija'
              : schedule.variationDescription || `Varijacija ${variation}`;

          return (
            <Panel
              header={
                <Space>
                  <CalendarOutlined />
                  <strong>{variationLabel}</strong>
                  <Text type="secondary">
                    ({dayjs(schedule.datetimeFrom).format('DD.MM.YYYY')} -{' '}
                    {dayjs(schedule.datetimeTo).format('DD.MM.YYYY')})
                  </Text>
                </Space>
              }
              key={variation}
            >
              {varSchedules.map((sch) => (
                <div key={sch.id}>
                  <div className="mb-2">
                    <Text strong>Datum važenja: </Text>
                    <Text>{dayjs(sch.datum).format('DD.MM.YYYY')}</Text>
                  </div>
                  {renderDaySchedule(sch)}
                </div>
              ))}
            </Panel>
          );
        })}
      </Collapse>
    );
  };

  const renderSmerTabs = () => {
    if (!data || !data.schedules || data.schedules.length === 0) {
      return <Empty description="Nema podataka o redu vožnje" />;
    }

    // Group by smer
    const smerGroups = data.schedules.reduce((acc, schedule) => {
      const key = schedule.smer === 0 ? 'A' : 'B';
      if (!acc[key]) acc[key] = [];
      acc[key].push(schedule);
      return acc;
    }, {} as Record<string, TimetableSchedule[]>);

    const tabItems = Object.entries(smerGroups).map(([smer, schedules]) => ({
      key: smer,
      label: `Smer ${smer}`,
      children: renderVariationPanel(schedules),
    }));

    return <Tabs items={tabItems} />;
  };

  return (
    <Modal
      title={
        <Space>
          <ClockCircleOutlined className="text-blue-500" />
          <span>
            Red vožnje - Linija {lineNumberForDisplay || data?.lineInfo?.lineNumberForDisplay || ''}
          </span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width="95%"
      style={{ top: 10, maxWidth: '2000px' }}
    >
      <Spin spinning={loading}>
        {data && (
          <div className="mb-4">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Sistemski broj">
                {data.lineInfo.lineNumber}
              </Descriptions.Item>
              <Descriptions.Item label="Broj za prikaz">
                {data.lineInfo.lineNumberForDisplay}
              </Descriptions.Item>
              <Descriptions.Item label="Naziv linije" span={2}>
                {data.lineInfo.lineTitle}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}

        {renderSmerTabs()}
      </Spin>

      {/* Station Times Drawer */}
      <StationTimesDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        idlinije={selectedDeparture?.idlinije || null}
        smer={selectedDeparture?.smer ?? null}
        dan={selectedDeparture?.dan || null}
        vreme={selectedDeparture?.vreme || null}
      />
    </Modal>
  );
};

export default TimetableModal;
