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
  Progress,
} from 'antd';
import {
  ClockCircleOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RightOutlined,
  CarOutlined,
  FieldTimeOutlined,
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

  // Expandable nested table for detailed departures
  const expandedRowRender = (record: GroupedTurnus) => {
    const nestedColumns: ColumnsType<TurnusRecord> = [
      {
        title: 'Polazak #',
        dataIndex: 'departureNoInTurage',
        key: 'departureNoInTurage',
        width: 90,
        align: 'center',
        fixed: 'left',
        render: (num: number) => (
          <Tag color="blue" style={{ fontSize: '13px', fontWeight: 'bold' }}>
            #{num}
          </Tag>
        ),
      },
      {
        title: 'Smena',
        dataIndex: 'shiftNumber',
        key: 'shiftNumber',
        width: 80,
        align: 'center',
        fixed: 'left',
        render: (shift: number) => (
          <Tag color="orange" style={{ fontSize: '13px', fontWeight: 'bold' }}>
            Smena {shift}
          </Tag>
        ),
      },
      {
        title: 'Vreme polaska',
        dataIndex: 'startTime',
        key: 'startTime',
        width: 120,
        align: 'center',
        render: (time: Date) => (
          <Space>
            <ClockCircleOutlined style={{ color: '#1890ff' }} />
            <Text strong style={{ fontFamily: 'monospace', fontSize: '14px' }}>
              {formatTime(time)}
            </Text>
          </Space>
        ),
      },
      {
        title: 'Linija',
        key: 'lineInfo',
        width: 200,
        align: 'left',
        render: (_: any, record: TurnusRecord) => (
          <div>
            <Tag color="purple" style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: 4 }}>
              {record.lineNumberForDisplay || record.lineNo}
            </Tag>
            {record.lineTitle && (
              <div>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {record.lineTitle}
                </Text>
              </div>
            )}
          </div>
        ),
      },
      {
        title: 'Smer',
        dataIndex: 'lineNo',
        key: 'smer',
        width: 100,
        align: 'center',
        render: (lineNo: string) => {
          // Determine direction from line_no: "5135" = A, "5135B" = B
          const hasDirectionSuffix = /[A-Z]$/.test(lineNo);
          const smer = hasDirectionSuffix ? lineNo.slice(-1) : 'A';
          const color = hasDirectionSuffix ? 'green' : 'blue';

          return (
            <Tag color={color} style={{ fontSize: '13px' }}>
              Smer {smer}
            </Tag>
          );
        },
      },
      {
        title: 'Trajanje',
        dataIndex: 'duration',
        key: 'duration',
        width: 100,
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
            <Text style={{ fontFamily: 'monospace', fontSize: '13px' }}>
              {durationStr}
            </Text>
          );
        },
      },
      {
        title: 'Turaža',
        dataIndex: 'turageNo',
        key: 'turageNo',
        width: 80,
        align: 'center',
        render: (num: number) => (
          <Text strong>{num}</Text>
        ),
      },
    ];

    return (
      <div style={{ padding: '0 24px', background: '#fafafa' }}>
        <div style={{ marginBottom: 12, padding: '8px 0' }}>
          <Space size="large" wrap>
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
          scroll={{ x: 1000 }}
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
      width: 120,
      align: 'center',
      fixed: 'left',
      render: (id: number) => (
        <Space>
          <CarOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
          <Text strong style={{ fontSize: '15px' }}>{id}</Text>
        </Space>
      ),
    },
    {
      title: 'Naziv turaže',
      dataIndex: 'turnusName',
      key: 'turnusName',
      width: 250,
      fixed: 'left',
      render: (name: string, record: GroupedTurnus) => (
        <div>
          <Text strong style={{ color: '#1890ff', fontSize: '14px', display: 'block' }}>
            {name}
          </Text>
          {record.transportId && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {record.transportId}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Dan',
      dataIndex: 'dayNumber',
      key: 'dayNumber',
      width: 130,
      align: 'center',
      render: (day: number) => (
        <Tag color="blue" style={{ fontSize: '13px', padding: '4px 12px' }}>
          {getDayName(day)}
        </Tag>
      ),
    },
    {
      title: (
        <Tooltip title="Broj vozača potrebnih za ovu turažu">
          <Space>
            <TeamOutlined />
            Vozači
          </Space>
        </Tooltip>
      ),
      dataIndex: 'driversNeeded',
      key: 'driversNeeded',
      width: 120,
      align: 'center',
      render: (drivers: number, record: GroupedTurnus) => (
        <Tooltip title={`Smene: ${record.shiftNumbers.join(', ')}`}>
          <div style={{
            background: drivers > 1 ? '#fff7e6' : '#f6ffed',
            padding: '6px 12px',
            borderRadius: '4px',
            border: drivers > 1 ? '2px solid #ffa940' : '2px solid #52c41a'
          }}>
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <TeamOutlined style={{
                fontSize: '20px',
                color: drivers > 1 ? '#fa8c16' : '#52c41a'
              }} />
              <Text strong style={{
                fontSize: '16px',
                color: drivers > 1 ? '#fa8c16' : '#52c41a'
              }}>
                {drivers} vozač{drivers > 1 ? 'a' : ''}
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {record.shiftsCount} smena
              </Text>
            </Space>
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Broj polazaka',
      dataIndex: 'departureCount',
      key: 'departureCount',
      width: 130,
      align: 'center',
      render: (count: number) => (
        <Space>
          <RightOutlined style={{ color: '#52c41a' }} />
          <Text strong style={{ fontSize: '15px', color: '#52c41a' }}>
            {count}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Linije i smerovi',
      key: 'linesServed',
      width: 250,
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
            <Space wrap size={[4, 4]}>
              {sortedLines.map((lineInfo) => {
                // Check if line has direction suffix (A, B, etc.)
                const hasDirectionSuffix = /[A-Z]$/.test(lineInfo.lineNo);
                const dirColor = hasDirectionSuffix ? 'green' : 'blue';

                return (
                  <Tooltip key={lineInfo.lineNo} title={lineInfo.title || lineInfo.lineNo}>
                    <Tag color={dirColor} style={{ fontSize: '12px', fontWeight: 'bold' }}>
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
      width: 400,
      render: (_: any, record: GroupedTurnus) => {
        const DAY_MINUTES = 24 * 60; // Total minutes in a day

        // Calculate total turnus duration
        const startMinutes = dayjs(record.firstDepartureTime).hour() * 60 + dayjs(record.firstDepartureTime).minute();
        const endMinutes = dayjs(record.lastDepartureTime).hour() * 60 + dayjs(record.lastDepartureTime).minute();
        const totalMinutes = endMinutes >= startMinutes ? endMinutes - startMinutes : DAY_MINUTES - startMinutes + endMinutes;
        const totalHours = Math.floor(totalMinutes / 60);
        const totalMins = totalMinutes % 60;

        // Colors for shifts
        const shiftColors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'];

        return (
          <div style={{ width: '100%', paddingBottom: '20px' }}>
            {/* Header with times */}
            <Space style={{ marginBottom: 6, width: '100%', justifyContent: 'space-between' }}>
              <div>
                <FieldTimeOutlined style={{ color: '#1890ff', marginRight: 4 }} />
                <Text strong style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {formatTime(record.firstDepartureTime)} - {formatTime(record.lastDepartureTime)}
                </Text>
              </div>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {totalHours}h {totalMins}min
              </Text>
            </Space>

            {/* 24-hour visualization bar */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: '32px',
              background: '#f0f0f0',
              borderRadius: '4px',
              border: '1px solid #d9d9d9',
              marginBottom: 6,
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
                        bottom: '-18px',
                        left: '-8px',
                        fontSize: '9px',
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
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        zIndex: 2,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      {widthPercent > 8 && `S${shift.shiftNumber}`}
                    </div>
                  </Tooltip>
                );
              })}
            </div>

            {/* Legend with coverage percentage */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size={4} wrap>
                {record.shiftDetails.map((shift: ShiftDetail, index: number) => (
                  <Tag
                    key={shift.shiftNumber}
                    color={shiftColors[index % shiftColors.length]}
                    style={{ fontSize: '10px', padding: '0px 6px', margin: 0 }}
                  >
                    S{shift.shiftNumber}: {shift.departureCount}
                  </Tag>
                ))}
              </Space>
              <Text type="secondary" style={{ fontSize: '10px' }}>
                Pokrivenost: {Math.round((totalMinutes / DAY_MINUTES) * 100)}%
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 110,
      align: 'center',
      fixed: 'right',
      render: (active: number) => (
        <Tooltip title={active === 1 ? 'Turaža je aktivna' : 'Turaža je neaktivna'}>
          {active === 1 ? (
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: '13px', padding: '4px 12px' }}>
              Aktivan
            </Tag>
          ) : (
            <Tag color="error" icon={<CloseCircleOutlined />} style={{ fontSize: '13px', padding: '4px 12px' }}>
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
          <TeamOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          <span style={{ fontSize: '18px' }}>
            Turaže - Linija {lineNumberForDisplay || lineNumber || ''}
          </span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width="95%"
      style={{ top: 20, maxWidth: '1800px' }}
    >
      <Spin spinning={loading}>
        {data ? (
          <div>
            {/* Info header */}
            <div className="mb-4">
              <Descriptions bordered size="small" column={3}>
                <Descriptions.Item label="Linija broj">
                  <Text strong>{data.lineNumber}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Ukupno turaža">
                  <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>
                    {data.total}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Napomena">
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Kliknite na red za detalje polazaka
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Expandable Table */}
            <Table
              columns={masterColumns}
              dataSource={data.grouped}
              rowKey="turnusId"
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
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'transform 0.3s',
                      }}
                    />
                  </Tooltip>
                ),
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} od ${total} turaža`,
                pageSizeOptions: ['10', '20', '50'],
              }}
              size="middle"
              bordered
              locale={{
                emptyText: 'Nema turaža za ovu liniju',
              }}
              scroll={{ x: 1750 }}
            />
          </div>
        ) : (
          !loading && <Empty description="Nema podataka o turažama" />
        )}
      </Spin>
    </Modal>
  );
};

export default TurnusiModal;
