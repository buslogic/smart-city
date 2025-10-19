import React, { useEffect, useState, useMemo } from 'react';
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
  Progress,
  Input,
  Checkbox,
  Button,
  Card,
  Row,
  Col,
} from 'antd';
import {
  ClockCircleOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RightOutlined,
  CarOutlined,
  FieldTimeOutlined,
  SearchOutlined,
  FilterOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  linesAdministrationService,
  GroupedTurnusiResponse,
  GroupedTurnus,
  TurnusRecord,
  ShiftDetail,
} from '../../services/linesAdministration.service';

const { Title, Text } = Typography;

interface TurnusiModalProps {
  visible: boolean;
  onClose: () => void;
  lineNumber: string | null;
  lineNumberForDisplay?: string;
}

const TurnusiModal: React.FC<TurnusiModalProps> = ({
  visible,
  onClose,
  lineNumber,
  lineNumberForDisplay,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GroupedTurnusiResponse | null>(null);

  // Filter state
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [searchTurnusId, setSearchTurnusId] = useState('');
  const [searchTurnusName, setSearchTurnusName] = useState('');

  useEffect(() => {
    if (visible && lineNumber) {
      loadTurnusi();
    }
  }, [visible, lineNumber]);

  const loadTurnusi = async () => {
    if (!lineNumber) return;

    setLoading(true);
    try {
      const response = await linesAdministrationService.getTurnusiGroupedByLine(lineNumber);
      setData(response);
    } catch (error: any) {
      console.error('Greška pri učitavanju turnusa:', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju turnusa');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: Date | string) => {
    if (!time) return '-';
    return dayjs(time).format('HH:mm:ss');
  };

  const getDayName = (day: number): string => {
    const dayNames = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];
    return dayNames[day] || `Dan ${day}`;
  };

  // All available days from data
  const availableDays = useMemo(() => {
    if (!data) return [];
    const days = Array.from(new Set(data.grouped.map(t => t.dayname))).filter(Boolean);
    // Sort days by order: Ponedeljak -> Nedelja
    const dayOrder = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
    return days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  }, [data]);

  // Filtered data based on selected filters
  const filteredData = useMemo(() => {
    if (!data) return null;

    let filtered = data.grouped;

    // Filter by selected days
    if (selectedDays.length > 0) {
      filtered = filtered.filter(t => selectedDays.includes(t.dayname));
    }

    // Filter by turnus ID
    if (searchTurnusId.trim()) {
      filtered = filtered.filter(t =>
        t.turnusId.toString().includes(searchTurnusId.trim())
      );
    }

    // Filter by turnus name
    if (searchTurnusName.trim()) {
      const searchLower = searchTurnusName.trim().toLowerCase();
      filtered = filtered.filter(t =>
        t.turnusName.toLowerCase().includes(searchLower)
      );
    }

    return {
      ...data,
      grouped: filtered,
      total: filtered.length,
    };
  }, [data, selectedDays, searchTurnusId, searchTurnusName]);

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedDays([]);
    setSearchTurnusId('');
    setSearchTurnusName('');
  };

  // Colors for shift visualization (used in both nested table and 24h timeline)
  const shiftColors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'];

  // Expandable nested table for detailed departures
  const expandedRowRender = (record: GroupedTurnus) => {
    const nestedColumns: ColumnsType<TurnusRecord> = [
      {
        title: 'Polazak #',
        dataIndex: 'departureNoInTurage',
        key: 'departureNoInTurage',
        width: 80,
        align: 'center',
        fixed: 'left',
        render: (num: number) => (
          <Tag color="blue" style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', margin: 0 }}>
            #{num}
          </Tag>
        ),
      },
      {
        title: 'Smena',
        dataIndex: 'shiftNumber',
        key: 'shiftNumber',
        width: 75,
        align: 'center',
        fixed: 'left',
        render: (shift: number) => (
          <Tag
            color={shiftColors[(shift - 1) % shiftColors.length]}
            style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', margin: 0 }}
          >
            S{shift}
          </Tag>
        ),
      },
      {
        title: 'Polazak',
        dataIndex: 'startTime',
        key: 'startTime',
        width: 90,
        align: 'center',
        render: (time: Date) => (
          <Text strong style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            {formatTime(time)}
          </Text>
        ),
      },
      {
        title: 'Linija',
        key: 'lineInfo',
        width: 300,
        align: 'left',
        render: (_: any, record: TurnusRecord) => {
          const lineNum = record.lineNumberForDisplay || record.lineNo;
          const lineTitle = record.lineTitle;

          return (
            <Tooltip title={lineTitle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag color="purple" style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>
                  {lineNum}
                </Tag>
                {lineTitle && (
                  <Text
                    type="secondary"
                    style={{
                      fontSize: '11px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1
                    }}
                  >
                    {lineTitle}
                  </Text>
                )}
              </div>
            </Tooltip>
          );
        },
      },
      {
        title: 'Smer',
        dataIndex: 'lineNo',
        key: 'smer',
        width: 70,
        align: 'center',
        render: (lineNo: string) => {
          // Determine direction from line_no: "5135" = A, "5135B" = B
          const hasDirectionSuffix = /[A-Z]$/.test(lineNo);
          const smer = hasDirectionSuffix ? lineNo.slice(-1) : 'A';
          const color = hasDirectionSuffix ? 'green' : 'blue';

          return (
            <Tag color={color} style={{ fontSize: '11px', padding: '2px 8px', margin: 0 }}>
              {smer}
            </Tag>
          );
        },
      },
      {
        title: 'Trajanje',
        dataIndex: 'duration',
        key: 'duration',
        width: 75,
        align: 'center',
        render: (duration: Date | string) => {
          // Backend returns duration as ISO string like "1970-01-01T00:55:00.000Z"
          // We only need the time part (HH:mm:ss)
          let durationStr = '-';

          if (duration) {
            if (typeof duration === 'string') {
              // Parse ISO string and extract time (only hours and minutes)
              const date = new Date(duration);
              const hours = String(date.getUTCHours()).padStart(2, '0');
              const minutes = String(date.getUTCMinutes()).padStart(2, '0');
              durationStr = `${hours}:${minutes}`;
            } else {
              const d = new Date(duration);
              const hours = String(d.getUTCHours()).padStart(2, '0');
              const minutes = String(d.getUTCMinutes()).padStart(2, '0');
              durationStr = `${hours}:${minutes}`;
            }
          }

          return (
            <Text style={{ fontFamily: 'monospace', fontSize: '11px' }}>
              {durationStr}
            </Text>
          );
        },
      },
      {
        title: 'Tur',
        dataIndex: 'turageNo',
        key: 'turageNo',
        width: 50,
        align: 'center',
        render: (num: number) => (
          <Text strong style={{ fontSize: '11px' }}>{num}</Text>
        ),
      },
    ];

    return (
      <div style={{ padding: '0 16px', background: '#fafafa' }}>
        <div style={{ marginBottom: 6, padding: '4px 0' }}>
          <Space size="middle" wrap>
            <Text strong style={{ fontSize: '14px' }}>
              📊 Detalji turaže: {record.turnusName}
            </Text>
            {record.transportId && (
              <Tag color="cyan" style={{ fontSize: '12px', padding: '2px 8px' }}>
                {record.transportId}
              </Tag>
            )}
            <Tag color="orange" style={{ fontSize: '13px', padding: '4px 10px' }}>
              Smene: {record.shiftNumbers.join(', ')}
            </Tag>
            <Space size={4}>
              {(() => {
                // Extract unique line info from departures
                const uniqueLineInfo = new Map<string, { lineNo: string; display: string }>();
                record.departures.forEach((dep) => {
                  if (!uniqueLineInfo.has(dep.lineNo)) {
                    uniqueLineInfo.set(dep.lineNo, {
                      lineNo: dep.lineNo,
                      display: dep.lineNumberForDisplay || dep.lineNo,
                    });
                  }
                });

                // Sort by lineNo
                const sortedLines = Array.from(uniqueLineInfo.values()).sort((a, b) => {
                  const aNum = parseInt(a.lineNo);
                  const bNum = parseInt(b.lineNo);
                  if (aNum !== bNum) return aNum - bNum;
                  return a.lineNo.localeCompare(b.lineNo);
                });

                return sortedLines.map((lineInfo) => {
                  const hasDirectionSuffix = /[A-Z]$/.test(lineInfo.lineNo);
                  const dirColor = hasDirectionSuffix ? 'green' : 'blue';
                  return (
                    <Tag key={lineInfo.lineNo} color={dirColor} style={{ fontSize: '13px', padding: '4px 10px' }}>
                      {lineInfo.display}
                    </Tag>
                  );
                });
              })()}
            </Space>
          </Space>
        </div>
        <Table
          columns={nestedColumns}
          dataSource={record.departures}
          pagination={false}
          size="small"
          rowKey="id"
          bordered
          scroll={{ x: 900 }}
        />
      </div>
    );
  };

  // Main table columns for grouped data
  const masterColumns: ColumnsType<GroupedTurnus> = [
    {
      title: 'Turnus ID',
      dataIndex: 'turnusId',
      key: 'turnusId',
      width: 90,
      align: 'center',
      fixed: 'left',
      render: (id: number) => (
        <Space size={4}>
          <CarOutlined style={{ color: '#1890ff', fontSize: '12px' }} />
          <Text strong style={{ fontSize: '11px' }}>{id}</Text>
        </Space>
      ),
    },
    {
      title: 'Naziv turaže',
      dataIndex: 'turnusName',
      key: 'turnusName',
      width: 180,
      fixed: 'left',
      render: (name: string, record: GroupedTurnus) => (
        <div style={{ lineHeight: '1.2' }}>
          <Text strong style={{ color: '#1890ff', fontSize: '11px', display: 'block' }}>
            {name}
          </Text>
          {record.transportId && (
            <Text type="secondary" style={{ fontSize: '9px' }}>
              {record.transportId}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Dan',
      dataIndex: 'dayname',
      key: 'dayname',
      width: 100,
      align: 'center',
      render: (dayname: string) => (
        <Tag color="blue" style={{ fontSize: '10px', padding: '1px 6px', margin: 0 }}>
          {dayname || 'N/A'}
        </Tag>
      ),
    },
    {
      title: (
        <Tooltip title="Broj vozača potrebnih za ovu turažu">
          <Space size={2}>
            <TeamOutlined style={{ fontSize: '11px' }} />
            <span style={{ fontSize: '11px' }}>Vozači</span>
          </Space>
        </Tooltip>
      ),
      dataIndex: 'driversNeeded',
      key: 'driversNeeded',
      width: 80,
      align: 'center',
      render: (drivers: number, record: GroupedTurnus) => (
        <Tooltip title={`Smene: ${record.shiftNumbers.join(', ')}`}>
          <div style={{
            background: drivers > 1 ? '#fff7e6' : '#f6ffed',
            padding: '3px 6px',
            borderRadius: '3px',
            border: drivers > 1 ? '1px solid #ffa940' : '1px solid #52c41a',
            lineHeight: '1.2'
          }}>
            <TeamOutlined style={{
              fontSize: '12px',
              color: drivers > 1 ? '#fa8c16' : '#52c41a',
              display: 'block'
            }} />
            <Text strong style={{
              fontSize: '11px',
              color: drivers > 1 ? '#fa8c16' : '#52c41a',
              display: 'block'
            }}>
              {drivers}
            </Text>
            <Text type="secondary" style={{ fontSize: '9px', display: 'block' }}>
              {record.shiftsCount}sm
            </Text>
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Broj polazaka',
      dataIndex: 'departureCount',
      key: 'departureCount',
      width: 85,
      align: 'center',
      render: (count: number) => (
        <Space size={3}>
          <RightOutlined style={{ color: '#52c41a', fontSize: '10px' }} />
          <Text strong style={{ fontSize: '12px', color: '#52c41a' }}>
            {count}
          </Text>
        </Space>
      ),
    },
    {
      title: 'I смена',
      key: 'firstShiftGroup',
      align: 'center',
      onHeaderCell: () => ({
        style: {
          background: '#e6f7ff',
          borderLeft: '3px solid #1890ff',
          borderRight: '3px solid #1890ff',
          fontWeight: 'bold',
        },
      }),
      children: [
        {
          title: 'Од',
          key: 'firstShift_od',
          width: 65,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#e6f7ff',
              borderLeft: '3px solid #1890ff',
            },
          }),
          onCell: () => ({
            style: {
              background: '#f0f9ff',
              borderLeft: '3px solid #1890ff',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[0];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;
            return <Text strong style={{ fontFamily: 'monospace', fontSize: '10px' }}>{formatTime(shift.firstDepartureTime)}</Text>;
          },
        },
        {
          title: 'До',
          key: 'firstShift_do',
          width: 65,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#e6f7ff',
            },
          }),
          onCell: () => ({
            style: {
              background: '#f0f9ff',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[0];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;
            return <Text style={{ fontFamily: 'monospace', fontSize: '10px' }}>{formatTime(shift.lastDepartureTime)}</Text>;
          },
        },
        {
          title: 'Радно време',
          key: 'firstShift_radnoVreme',
          width: 70,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#e6f7ff',
            },
          }),
          onCell: () => ({
            style: {
              background: '#f0f9ff',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[0];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;

            const startMinutes = dayjs(shift.firstDepartureTime).hour() * 60 + dayjs(shift.firstDepartureTime).minute();
            const endMinutes = dayjs(shift.lastDepartureTime).hour() * 60 + dayjs(shift.lastDepartureTime).minute();
            const duration = endMinutes >= startMinutes ? endMinutes - startMinutes : (24 * 60) - startMinutes + endMinutes;
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;

            return (
              <Tag color="blue" style={{ fontSize: '9px', fontFamily: 'monospace', padding: '0 4px', margin: 0 }}>
                {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
              </Tag>
            );
          },
        },
        {
          title: 'Број обрта',
          key: 'firstShift_brojObrata',
          width: 60,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#e6f7ff',
            },
          }),
          onCell: () => ({
            style: {
              background: '#f0f9ff',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[0];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;
            return <Text strong style={{ color: '#52c41a', fontSize: '11px' }}>{shift.departureCount}</Text>;
          },
        },
        {
          title: 'Терминус',
          key: 'firstShift_terminus',
          width: 120,
          align: 'left',
          onHeaderCell: () => ({
            style: {
              background: '#e6f7ff',
              borderRight: '3px solid #1890ff',
            },
          }),
          onCell: () => ({
            style: {
              background: '#f0f9ff',
              borderRight: '3px solid #1890ff',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[0];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;

            // Pronađi poslednji polazak u smeni
            const shiftDepartures = record.departures.filter(d => d.shiftNumber === shift.shiftNumber);
            const lastDeparture = shiftDepartures[shiftDepartures.length - 1];

            return (
              <Text type="secondary" style={{ fontSize: '9px', lineHeight: '1.2' }} ellipsis={{ tooltip: lastDeparture?.lineTitle }}>
                {lastDeparture?.lineTitle || '-'}
              </Text>
            );
          },
        },
      ],
    },
    {
      title: 'II смена',
      key: 'secondShiftGroup',
      align: 'center',
      onHeaderCell: () => ({
        style: {
          background: '#f6ffed',
          borderLeft: '3px solid #52c41a',
          borderRight: '3px solid #52c41a',
          fontWeight: 'bold',
        },
      }),
      children: [
        {
          title: 'Од',
          key: 'secondShift_od',
          width: 65,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#f6ffed',
              borderLeft: '3px solid #52c41a',
            },
          }),
          onCell: () => ({
            style: {
              background: '#f9fff6',
              borderLeft: '3px solid #52c41a',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[1];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;
            return <Text strong style={{ fontFamily: 'monospace', fontSize: '10px' }}>{formatTime(shift.firstDepartureTime)}</Text>;
          },
        },
        {
          title: 'До',
          key: 'secondShift_do',
          width: 65,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#f6ffed',
            },
          }),
          onCell: () => ({
            style: {
              background: '#f9fff6',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[1];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;
            return <Text style={{ fontFamily: 'monospace', fontSize: '10px' }}>{formatTime(shift.lastDepartureTime)}</Text>;
          },
        },
        {
          title: 'Радно време',
          key: 'secondShift_radnoVreme',
          width: 70,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#f6ffed',
            },
          }),
          onCell: () => ({
            style: {
              background: '#f9fff6',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[1];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;

            const startMinutes = dayjs(shift.firstDepartureTime).hour() * 60 + dayjs(shift.firstDepartureTime).minute();
            const endMinutes = dayjs(shift.lastDepartureTime).hour() * 60 + dayjs(shift.lastDepartureTime).minute();
            const duration = endMinutes >= startMinutes ? endMinutes - startMinutes : (24 * 60) - startMinutes + endMinutes;
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;

            return (
              <Tag color="green" style={{ fontSize: '9px', fontFamily: 'monospace', padding: '0 4px', margin: 0 }}>
                {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
              </Tag>
            );
          },
        },
        {
          title: 'Број обрта',
          key: 'secondShift_brojObrata',
          width: 60,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#f6ffed',
            },
          }),
          onCell: () => ({
            style: {
              background: '#f9fff6',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[1];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;
            return <Text strong style={{ color: '#52c41a', fontSize: '11px' }}>{shift.departureCount}</Text>;
          },
        },
        {
          title: 'Терминус',
          key: 'secondShift_terminus',
          width: 120,
          align: 'left',
          onHeaderCell: () => ({
            style: {
              background: '#f6ffed',
              borderRight: '3px solid #52c41a',
            },
          }),
          onCell: () => ({
            style: {
              background: '#f9fff6',
              borderRight: '3px solid #52c41a',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[1];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;

            // Pronađi poslednji polazak u smeni
            const shiftDepartures = record.departures.filter(d => d.shiftNumber === shift.shiftNumber);
            const lastDeparture = shiftDepartures[shiftDepartures.length - 1];

            return (
              <Text type="secondary" style={{ fontSize: '9px', lineHeight: '1.2' }} ellipsis={{ tooltip: lastDeparture?.lineTitle }}>
                {lastDeparture?.lineTitle || '-'}
              </Text>
            );
          },
        },
      ],
    },
    {
      title: 'III смена',
      key: 'thirdShiftGroup',
      align: 'center',
      onHeaderCell: () => ({
        style: {
          background: '#fff7e6',
          borderLeft: '3px solid #fa8c16',
          borderRight: '3px solid #fa8c16',
          fontWeight: 'bold',
        },
      }),
      children: [
        {
          title: 'Од',
          key: 'thirdShift_od',
          width: 65,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#fff7e6',
              borderLeft: '3px solid #fa8c16',
            },
          }),
          onCell: () => ({
            style: {
              background: '#fffbf0',
              borderLeft: '3px solid #fa8c16',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[2];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;
            return <Text strong style={{ fontFamily: 'monospace', fontSize: '10px' }}>{formatTime(shift.firstDepartureTime)}</Text>;
          },
        },
        {
          title: 'До',
          key: 'thirdShift_do',
          width: 65,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#fff7e6',
            },
          }),
          onCell: () => ({
            style: {
              background: '#fffbf0',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[2];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;
            return <Text style={{ fontFamily: 'monospace', fontSize: '10px' }}>{formatTime(shift.lastDepartureTime)}</Text>;
          },
        },
        {
          title: 'Радно време',
          key: 'thirdShift_radnoVreme',
          width: 70,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#fff7e6',
            },
          }),
          onCell: () => ({
            style: {
              background: '#fffbf0',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[2];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;

            const startMinutes = dayjs(shift.firstDepartureTime).hour() * 60 + dayjs(shift.firstDepartureTime).minute();
            const endMinutes = dayjs(shift.lastDepartureTime).hour() * 60 + dayjs(shift.lastDepartureTime).minute();
            const duration = endMinutes >= startMinutes ? endMinutes - startMinutes : (24 * 60) - startMinutes + endMinutes;
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;

            return (
              <Tag color="orange" style={{ fontSize: '9px', fontFamily: 'monospace', padding: '0 4px', margin: 0 }}>
                {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
              </Tag>
            );
          },
        },
        {
          title: 'Број обрта',
          key: 'thirdShift_brojObrata',
          width: 60,
          align: 'center',
          onHeaderCell: () => ({
            style: {
              background: '#fff7e6',
            },
          }),
          onCell: () => ({
            style: {
              background: '#fffbf0',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[2];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;
            return <Text strong style={{ color: '#52c41a', fontSize: '11px' }}>{shift.departureCount}</Text>;
          },
        },
        {
          title: 'Терминус',
          key: 'thirdShift_terminus',
          width: 120,
          align: 'left',
          onHeaderCell: () => ({
            style: {
              background: '#fff7e6',
              borderRight: '3px solid #fa8c16',
            },
          }),
          onCell: () => ({
            style: {
              background: '#fffbf0',
              borderRight: '3px solid #fa8c16',
            },
          }),
          render: (_: any, record: GroupedTurnus) => {
            const shift = record.shiftDetails[2];
            if (!shift) return <Text type="secondary" style={{ fontSize: '9px' }}>-</Text>;

            // Pronađi poslednji polazak u smeni
            const shiftDepartures = record.departures.filter(d => d.shiftNumber === shift.shiftNumber);
            const lastDeparture = shiftDepartures[shiftDepartures.length - 1];

            return (
              <Text type="secondary" style={{ fontSize: '9px', lineHeight: '1.2' }} ellipsis={{ tooltip: lastDeparture?.lineTitle }}>
                {lastDeparture?.lineTitle || '-'}
              </Text>
            );
          },
        },
      ],
    },
    {
      title: 'Linije i smerovi',
      key: 'linesServed',
      width: 180,
      align: 'center',
      render: (_: any, record: GroupedTurnus) => {
        // Extract unique line info from departures
        const uniqueLineInfo = new Map<string, { lineNo: string; display: string; title?: string }>();

        record.departures.forEach((dep) => {
          if (!uniqueLineInfo.has(dep.lineNo)) {
            uniqueLineInfo.set(dep.lineNo, {
              lineNo: dep.lineNo,
              display: dep.lineNumberForDisplay || dep.lineNo,
              title: dep.lineTitleForDisplay,
            });
          }
        });

        // Sort by lineNo
        const sortedLines = Array.from(uniqueLineInfo.values()).sort((a, b) => {
          const aNum = parseInt(a.lineNo);
          const bNum = parseInt(b.lineNo);
          if (aNum !== bNum) return aNum - bNum;
          return a.lineNo.localeCompare(b.lineNo);
        });

        return (
          <div>
            <Space wrap size={[2, 2]}>
              {sortedLines.map((lineInfo) => {
                // Check if line has direction suffix (A, B, etc.)
                const hasDirectionSuffix = /[A-Z]$/.test(lineInfo.lineNo);
                const dirColor = hasDirectionSuffix ? 'green' : 'blue';

                return (
                  <Tooltip key={lineInfo.lineNo} title={lineInfo.title || lineInfo.lineNo}>
                    <Tag color={dirColor} style={{ fontSize: '9px', fontWeight: 'bold', padding: '0 4px', margin: 0 }}>
                      {lineInfo.display}
                    </Tag>
                  </Tooltip>
                );
              })}
            </Space>
          </div>
        );
      },
    },
    {
      title: 'Vremenski opseg - 24h prikaz',
      key: 'timeRange',
      width: 320,
      render: (_: any, record: GroupedTurnus) => {
        const DAY_MINUTES = 24 * 60; // Total minutes in a day

        // Calculate total turnus duration
        const startMinutes = dayjs(record.firstDepartureTime).hour() * 60 + dayjs(record.firstDepartureTime).minute();
        const endMinutes = dayjs(record.lastDepartureTime).hour() * 60 + dayjs(record.lastDepartureTime).minute();
        const totalMinutes = endMinutes >= startMinutes ? endMinutes - startMinutes : DAY_MINUTES - startMinutes + endMinutes;
        const totalHours = Math.floor(totalMinutes / 60);
        const totalMins = totalMinutes % 60;

        return (
          <div style={{ width: '100%', paddingBottom: '6px' }}>
            {/* Header with times and legend combined */}
            <div style={{ marginBottom: 3, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FieldTimeOutlined style={{ color: '#1890ff', fontSize: '9px' }} />
                <Text strong style={{ fontFamily: 'monospace', fontSize: '8px' }}>
                  {formatTime(record.firstDepartureTime)} - {formatTime(record.lastDepartureTime)}
                </Text>
                <Text type="secondary" style={{ fontSize: '7px' }}>
                  ({totalHours}h {totalMins}min)
                </Text>
                {/* Legend inline */}
                <Space size={1}>
                  {record.shiftDetails.map((shift: ShiftDetail, index: number) => (
                    <Tag
                      key={shift.shiftNumber}
                      color={shiftColors[index % shiftColors.length]}
                      style={{ fontSize: '7px', padding: '0px 3px', margin: 0, lineHeight: '12px' }}
                    >
                      S{shift.shiftNumber}:{shift.departureCount}
                    </Tag>
                  ))}
                </Space>
              </div>
              <Text type="secondary" style={{ fontSize: '7px' }}>
                {Math.round((totalMinutes / DAY_MINUTES) * 100)}%
              </Text>
            </div>

            {/* 24-hour visualization bar */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: '20px',
              background: '#f0f0f0',
              borderRadius: '3px',
              border: '1px solid #d9d9d9',
              overflow: 'hidden'
            }}>
              {/* Time markers (00:00, 06:00, 12:00, 18:00, 24:00) */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                pointerEvents: 'none',
                zIndex: 1
              }}>
                {[0, 6, 12, 18, 24].map((hour) => (
                  <div
                    key={hour}
                    style={{
                      borderLeft: hour === 0 ? 'none' : '1px dashed #bfbfbf',
                      height: '100%',
                      position: 'relative'
                    }}
                  >
                    <Text
                      style={{
                        position: 'absolute',
                        bottom: '-12px',
                        left: '-5px',
                        fontSize: '6px',
                        color: '#8c8c8c'
                      }}
                    >
                      {hour}h
                    </Text>
                  </div>
                ))}
              </div>

              {/* Shift segments */}
              {record.shiftDetails.map((shift: ShiftDetail, index: number) => {
                const shiftStart = dayjs(shift.firstDepartureTime).hour() * 60 + dayjs(shift.firstDepartureTime).minute();
                const shiftEnd = dayjs(shift.lastDepartureTime).hour() * 60 + dayjs(shift.lastDepartureTime).minute();
                const shiftDuration = shiftEnd >= shiftStart ? shiftEnd - shiftStart : DAY_MINUTES - shiftStart + shiftEnd;

                // Calculate position and width as percentage of 24h
                const leftPercent = (shiftStart / DAY_MINUTES) * 100;
                const widthPercent = (shiftDuration / DAY_MINUTES) * 100;

                // Format shift duration as HH:mm
                const durationHours = Math.floor(shiftDuration / 60);
                const durationMinutes = shiftDuration % 60;
                const durationText = `${String(durationHours).padStart(2, '0')}:${String(durationMinutes).padStart(2, '0')}`;

                return (
                  <Tooltip
                    key={shift.shiftNumber}
                    title={`Smena ${shift.shiftNumber}: ${formatTime(shift.firstDepartureTime)} - ${formatTime(shift.lastDepartureTime)} (${shift.departureCount} polazaka)`}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        height: '100%',
                        background: shiftColors[index % shiftColors.length],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        zIndex: 2,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      {widthPercent > 8 && `S${shift.shiftNumber} ${durationText}`}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 85,
      align: 'center',
      fixed: 'right',
      render: (active: number) => (
        <Tooltip title={active === 1 ? 'Turaža je aktivna' : 'Turaža je neaktivna'}>
          {active === 1 ? (
            <Tag color="success" icon={<CheckCircleOutlined style={{ fontSize: '9px' }} />} style={{ fontSize: '9px', padding: '1px 6px', margin: 0 }}>
              Aktivan
            </Tag>
          ) : (
            <Tag color="error" icon={<CloseCircleOutlined style={{ fontSize: '9px' }} />} style={{ fontSize: '9px', padding: '1px 6px', margin: 0 }}>
              Neaktivan
            </Tag>
          )}
        </Tooltip>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <TeamOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
          <span style={{ fontSize: '16px' }}>
            Turaže - Linija {lineNumberForDisplay || lineNumber || ''}
          </span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width="98%"
      style={{ top: 10, maxWidth: 'none', paddingBottom: 10 }}
    >
      <Spin spinning={loading}>
        {data ? (
          <div>
            {/* Info header */}
            <div className="mb-3">
              <Descriptions bordered size="small" column={3}>
                <Descriptions.Item label={<Text style={{ fontSize: '11px' }}>Linija broj</Text>}>
                  <Text strong style={{ fontSize: '12px' }}>{data.lineNumber}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text style={{ fontSize: '11px' }}>Ukupno turaža</Text>}>
                  <Tag color="blue" style={{ fontSize: '11px', padding: '2px 8px' }}>
                    {data.total}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={<Text style={{ fontSize: '11px' }}>Napomena</Text>}>
                  <Text type="secondary" style={{ fontSize: '10px' }}>
                    Kliknite na red za detalje polazaka
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Filters Card */}
            <Card
              size="small"
              title={
                <Space size="small">
                  <FilterOutlined style={{ color: '#1890ff', fontSize: '12px' }} />
                  <Text strong style={{ fontSize: '12px' }}>Filteri</Text>
                  {(selectedDays.length > 0 || searchTurnusId || searchTurnusName) && (
                    <Tag color="blue" style={{ fontSize: '10px', padding: '1px 6px' }}>
                      {selectedDays.length + (searchTurnusId ? 1 : 0) + (searchTurnusName ? 1 : 0)} aktivan
                    </Tag>
                  )}
                </Space>
              }
              extra={
                <Button
                  size="small"
                  icon={<ClearOutlined style={{ fontSize: '11px' }} />}
                  onClick={handleResetFilters}
                  disabled={selectedDays.length === 0 && !searchTurnusId && !searchTurnusName}
                  style={{ fontSize: '11px', padding: '2px 8px', height: '26px' }}
                >
                  Resetuj filtere
                </Button>
              }
              style={{ marginBottom: 12 }}
            >
              <Row gutter={[12, 8]}>
                {/* Day selection */}
                <Col span={24}>
                  <div>
                    <Text strong style={{ marginBottom: 6, display: 'block', fontSize: '11px' }}>
                      Dani u opticaju:
                    </Text>
                    <Checkbox.Group
                      value={selectedDays}
                      onChange={(checkedValues) => setSelectedDays(checkedValues as string[])}
                      style={{ width: '100%' }}
                    >
                      <Space wrap size={[6, 4]}>
                        {availableDays.map((day) => (
                          <Checkbox key={day} value={day} style={{ fontSize: '11px' }}>
                            {day}
                          </Checkbox>
                        ))}
                      </Space>
                    </Checkbox.Group>
                  </div>
                </Col>

                {/* Search by Turnus ID */}
                <Col xs={24} sm={12} md={8}>
                  <div>
                    <Text strong style={{ marginBottom: 6, display: 'block', fontSize: '11px' }}>
                      Turnus ID:
                    </Text>
                    <Input
                      size="small"
                      placeholder="Pretraži po ID-u"
                      prefix={<SearchOutlined style={{ fontSize: '11px' }} />}
                      value={searchTurnusId}
                      onChange={(e) => setSearchTurnusId(e.target.value)}
                      allowClear
                      style={{ fontSize: '11px' }}
                    />
                  </div>
                </Col>

                {/* Search by Turnus Name */}
                <Col xs={24} sm={12} md={8}>
                  <div>
                    <Text strong style={{ marginBottom: 6, display: 'block', fontSize: '11px' }}>
                      Naziv turaže:
                    </Text>
                    <Input
                      size="small"
                      placeholder="Pretraži po nazivu"
                      prefix={<SearchOutlined style={{ fontSize: '11px' }} />}
                      value={searchTurnusName}
                      onChange={(e) => setSearchTurnusName(e.target.value)}
                      allowClear
                      style={{ fontSize: '11px' }}
                    />
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Dual Horizontal Scroll Wrapper */}
            <div style={{ position: 'relative' }}>
              {/* Top scroll bar */}
              <div
                style={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  marginBottom: '8px',
                }}
                onScroll={(e) => {
                  const bottomScroll = document.querySelector('.table-scroll-wrapper') as HTMLElement;
                  if (bottomScroll) {
                    bottomScroll.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
              >
                <div style={{ width: '2200px', height: '1px' }}></div>
              </div>

              {/* Table wrapper with bottom scroll */}
              <div
                className="table-scroll-wrapper"
                style={{ overflowX: 'auto' }}
                onScroll={(e) => {
                  const topScroll = e.currentTarget.previousElementSibling as HTMLElement;
                  if (topScroll) {
                    topScroll.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
              >
                <Table
              columns={masterColumns}
              dataSource={filteredData?.grouped || []}
              rowKey={(record) => `${record.turnusId}-${record.dayname}`}
              expandable={{
                expandedRowRender,
                expandRowByClick: true,
                expandIcon: ({ expanded, onExpand, record }) => (
                  <Tooltip title={expanded ? 'Sakrij detalje' : 'Prikaži detalje'}>
                    <RightOutlined
                      rotate={expanded ? 90 : 0}
                      onClick={(e) => onExpand(record, e)}
                      style={{
                        color: '#1890ff',
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'transform 0.3s',
                      }}
                    />
                  </Tooltip>
                ),
              }}
              pagination={{
                pageSize: 15,
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} od ${total} turaža`,
                pageSizeOptions: ['10', '15', '20', '30', '50'],
                size: 'small',
                style: { fontSize: '11px' }
              }}
              size="small"
              bordered
              locale={{
                emptyText: 'Nema turaža za ovu liniju',
              }}
              scroll={{ x: 2200 }}
            />
              </div>
            </div>
          </div>
        ) : (
          !loading && <Empty description="Nema podataka o turažama" />
        )}
      </Spin>
    </Modal>
  );
};

export default TurnusiModal;
