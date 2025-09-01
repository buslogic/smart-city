import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Statistic,
  Table,
  Tag,
  Space,
  Spin,
  Alert,
  Progress,
  Badge,
  Button,
  Tooltip,
  Typography,
} from 'antd';
import {
  CarOutlined,
  WarningOutlined,
  DashboardOutlined,
  ThunderboltOutlined,
  StopOutlined,
  SafetyOutlined,
  ReloadOutlined,
  CalendarOutlined,
  LineChartOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Dot,
  ReferenceLine,
} from 'recharts';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { vehiclesService } from '../../../services/vehicles.service';
import { VehicleMapper } from '../../../utils/vehicle-mapper';
import { 
  drivingBehaviorService, 
  type DrivingEvent, 
  type VehicleStatistics,
  type ChartData,
} from '../../../services/driving-behavior.service';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

const AggressiveDriving: React.FC = () => {
  // State
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null); // vehicle ID
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('day'),  // Početak današnjeg dana (00:00)
    dayjs().endOf('day'),    // Kraj današnjeg dana (23:59)
  ]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('severe');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch vehicles - povećan limit za sve vozila
  const { data: vehiclesData, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesService.getAll(1, 2000),
  });

  // Set default vehicle when vehicles load
  useEffect(() => {
    if (vehiclesData?.data?.length && !selectedVehicle) {
      // Find vehicle P93597 or use first vehicle
      const defaultVehicle = vehiclesData.data.find(v => v.garageNumber === 'P93597') || vehiclesData.data[0];
      setSelectedVehicle(defaultVehicle.id);
    }
  }, [vehiclesData, selectedVehicle]);

  // Fetch statistics
  const { data: statistics, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['vehicle-statistics', selectedVehicle, dateRange],
    queryFn: () => {
      if (!selectedVehicle) return null;
      return drivingBehaviorService.getVehicleStatistics(
        selectedVehicle,
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD')
      );
    },
    enabled: !!selectedVehicle,
  });

  // Fetch events
  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['vehicle-events', selectedVehicle, dateRange, selectedSeverity, currentPage, pageSize],
    queryFn: () => {
      if (!selectedVehicle) return null;
      // Don't send severity filter to backend if 'all' is selected
      const severityFilter = selectedSeverity === 'all' ? undefined : 
                             selectedSeverity === 'moderate' ? undefined : // We'll filter on frontend for moderate+severe
                             selectedSeverity as any;
      return drivingBehaviorService.getVehicleEvents(selectedVehicle, {
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        severity: severityFilter,
        page: currentPage,
        limit: pageSize,
      });
    },
    enabled: !!selectedVehicle,
  });

  // Fetch chart data
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['vehicle-chart', selectedVehicle, dateRange],
    queryFn: () => {
      if (!selectedVehicle) return null;
      return drivingBehaviorService.getVehicleChartData(
        selectedVehicle,
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD')
      );
    },
    enabled: !!selectedVehicle,
  });

  // Debug log za produkciju
  useEffect(() => {
    if (chartData?.dataPoints) {
      const severeCounts = chartData.dataPoints.filter((p: any) => p.eventType && p.severity >= 4).length;
      const moderateCounts = chartData.dataPoints.filter((p: any) => p.eventType && p.severity === 3).length;
      console.log(`[AggressiveDriving] Chart loaded: ${chartData.dataPoints.length} points, ${severeCounts} severe, ${moderateCounts} moderate`);
    }
  }, [chartData]);

  // Table columns
  const columns = [
    {
      title: 'Vreme',
      dataIndex: 'time',
      key: 'time',
      render: (time: string) => dayjs(time).format('DD.MM.YYYY HH:mm:ss'),
      width: 150,
    },
    {
      title: 'Tip',
      dataIndex: 'eventType',
      key: 'eventType',
      render: (type: string) => {
        const icon = type === 'acceleration' ? <ThunderboltOutlined /> : <StopOutlined />;
        const text = type === 'acceleration' ? 'Ubrzanje' : 'Kočenje';
        return (
          <Space>
            {icon}
            {text}
          </Space>
        );
      },
      width: 120,
    },
    {
      title: 'Ozbiljnost',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: number) => {
        const color = drivingBehaviorService.getSeverityColor(severity);
        const text = severity >= 4 ? 'Ozbiljno' : severity === 3 ? 'Umereno' : 'Normalno';
        const icon = severity >= 4 ? '⚠️' : severity === 3 ? '⚡' : '✓';
        return (
          <Tag color={color}>
            {icon} {text}
          </Tag>
        );
      },
      width: 100,
    },
    {
      title: 'Ubrzanje (m/s²)',
      dataIndex: 'accelerationValue',
      key: 'accelerationValue',
      render: (val: number) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(numVal)) return '-';
        return (
          <span style={{ fontWeight: Math.abs(numVal) > 4 ? 'bold' : 'normal' }}>
            {numVal.toFixed(2)}
          </span>
        );
      },
      width: 120,
    },
    {
      title: 'G-sila',
      dataIndex: 'gForce',
      key: 'gForce',
      render: (val: number) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(numVal)) return '-';
        return (
          <Badge 
            count={drivingBehaviorService.formatGForce(numVal)} 
            style={{ 
              backgroundColor: numVal > 0.5 ? '#ff4d4f' : numVal > 0.3 ? '#faad14' : '#52c41a' 
            }} 
          />
        );
      },
      width: 80,
    },
    {
      title: 'Brzina pre',
      dataIndex: 'speedBefore',
      key: 'speedBefore',
      render: (val: number) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(numVal)) return '-';
        return `${numVal} km/h`;
      },
      width: 100,
    },
    {
      title: 'Brzina posle',
      dataIndex: 'speedAfter',
      key: 'speedAfter',
      render: (val: number) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(numVal)) return '-';
        return `${numVal} km/h`;
      },
      width: 100,
    },
    {
      title: 'Trajanje',
      dataIndex: 'durationMs',
      key: 'durationMs',
      render: (val: number) => {
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(numVal)) return '-';
        return `${(numVal / 1000).toFixed(1)}s`;
      },
      width: 80,
    },
  ];

  // Prepare chart data
  const chartPoints = chartData?.dataPoints?.map((point, index) => ({
    time: dayjs(point.time).format('HH:mm:ss'),
    acceleration: point.acceleration,
    eventType: point.eventType,
    severity: point.severity,
    index: index, // For x-axis
  })) || [];

  // Custom dot renderer for events
  const renderCustomDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    
    if (payload.eventType) {
      let fill = '#52c41a'; // green for normal
      // severity je sada INTEGER (1=normal, 3=moderate, 5=severe)
      // Debug log za produkciju
      if (index % 100 === 0) { // Log svakih 100 tačaka da ne zagušimo konzolu
        console.log(`[AggressiveDriving] Event ${index}: severity=${payload.severity}, type=${typeof payload.severity}`);
      }
      
      if (payload.severity >= 4) {
        fill = '#ff4d4f'; // red for severe (4-5)
      } else if (payload.severity === 3) {
        fill = '#faad14'; // orange for moderate (3)
      }
      
      return (
        <circle
          key={`dot-event-${index}`}
          cx={cx}
          cy={cy}
          r={6}
          fill={fill}
          stroke="#fff"
          strokeWidth={2}
        />
      );
    }
    
    // Normal points - smaller blue dots
    return (
      <circle
        key={`dot-normal-${index}`}
        cx={cx}
        cy={cy}
        r={2}
        fill="#1890ff"
        stroke="#1890ff"
      />
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      let label = 'GPS podatak';
      let color = '#1890ff';
      
      if (data.eventType) {
        // severity je sada INTEGER (1=normal, 3=moderate, 5=severe)
        const severityText = data.severity >= 4 ? 'Ozbiljno' : 
                            data.severity === 3 ? 'Umereno' : 'Normalno';
        const eventText = data.eventType === 'acceleration' ? 'Ubrzanje' : 'Kočenje';
        label = `${eventText} (${severityText})`;
        
        if (data.severity >= 4) color = '#ff4d4f';  // red for severe
        else if (data.severity === 3) color = '#faad14';  // orange for moderate
        else color = '#52c41a';  // green for normal
      }
      
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', color }}>
            {label}
          </p>
          <p style={{ margin: 0 }}>
            Vreme: {data.time}
          </p>
          <p style={{ margin: 0 }}>
            Ubrzanje: {data.acceleration.toFixed(2)} m/s²
          </p>
        </div>
      );
    }
    return null;
  };

  const handleRefresh = () => {
    refetchStats();
    refetchEvents();
  };

  const isLoading = vehiclesLoading || statsLoading || eventsLoading || chartLoading;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          <SafetyOutlined className="mr-2" />
          Bezbednost - Agresivna vožnja
        </h1>
        <p className="text-gray-600">
          Analiza agresivnog ubrzanja i kočenja na osnovu GPS podataka
        </p>
      </div>

      {/* Legenda - Pragovi za autobuse */}
      <Card className="mb-4" size="small">
        <Row gutter={[16, 8]}>
          <Col span={24}>
            <Text strong>
              <DashboardOutlined className="mr-2" />
              Pragovi prilagođeni za autobuse sa putnicima:
            </Text>
          </Col>
          <Col span={12}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary" strong>
                <ThunderboltOutlined style={{ color: '#faad14' }} /> Ubrzanje:
              </Text>
              <Space wrap>
                <Tag color="green">Normalno: 1.0 - 1.5 m/s²</Tag>
                <Tag color="orange">Umereno: 1.5 - 2.5 m/s²</Tag>
                <Tag color="red">Ozbiljno: {'>'} 2.5 m/s²</Tag>
              </Space>
            </Space>
          </Col>
          <Col span={12}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary" strong>
                <StopOutlined style={{ color: '#ff4d4f' }} /> Kočenje:
              </Text>
              <Space wrap>
                <Tag color="green">Normalno: -1.0 do -2.0 m/s²</Tag>
                <Tag color="orange">Umereno: -2.0 do -3.5 m/s²</Tag>
                <Tag color="red">Ozbiljno: {'<'} -3.5 m/s²</Tag>
              </Space>
            </Space>
          </Col>
          <Col span={24}>
            <Alert
              message="Napomena"
              description="Ovi pragovi su blaži od standardnih automobilskih pragova zbog bezbednosti i komfora putnika u autobusima. Autobusi imaju veću masu i inerciju, a putnici često stoje tokom vožnje."
              type="info"
              showIcon
              className="mt-2"
            />
          </Col>
        </Row>
      </Card>

      {/* Filters */}
      <Card className="mb-4">
        <Row gutter={16} align="middle">
          <Col span={6}>
            <label className="block text-sm font-medium mb-2">Vozilo</label>
            <Select
              style={{ width: '100%' }}
              placeholder="Izaberite vozilo"
              value={selectedVehicle}
              onChange={setSelectedVehicle}
              loading={vehiclesLoading}
              showSearch
              optionFilterProp="children"
            >
              {vehiclesData?.data?.map(vehicle => (
                <Option key={vehicle.id} value={vehicle.id}>
                  <CarOutlined /> {vehicle.garageNumber}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <label className="block text-sm font-medium mb-2">Period</label>
            <Space.Compact style={{ width: '100%' }}>
              <RangePicker
                style={{ width: '70%' }}
                value={dateRange}
                onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
                format="DD.MM.YYYY"
                allowClear={false}
              />
              <Space.Compact>
                <Tooltip title="Danas">
                  <Button 
                    icon={<ClockCircleOutlined />}
                    onClick={() => setDateRange([dayjs().startOf('day'), dayjs().endOf('day')])}
                  />
                </Tooltip>
                <Tooltip title="Poslednih 7 dana">
                  <Button 
                    onClick={() => setDateRange([dayjs().subtract(7, 'days').startOf('day'), dayjs().endOf('day')])}
                  >
                    7D
                  </Button>
                </Tooltip>
                <Tooltip title="Ovaj mesec">
                  <Button 
                    onClick={() => setDateRange([dayjs().startOf('month'), dayjs().endOf('day')])}
                  >
                    M
                  </Button>
                </Tooltip>
              </Space.Compact>
            </Space.Compact>
          </Col>
          <Col span={4}>
            <label className="block text-sm font-medium mb-2">Filter ozbiljnosti</label>
            <Select
              style={{ width: '100%' }}
              placeholder="Samo ozbiljni"
              value={selectedSeverity || 'severe'}
              onChange={setSelectedSeverity}
            >
              <Option value="severe">
                <Badge color="red" text="Samo ozbiljni" />
              </Option>
              <Option value="moderate">
                <Badge color="orange" text="Umereni i ozbiljni" />
              </Option>
              <Option value="all">
                <Badge color="blue" text="Svi događaji" />
              </Option>
            </Select>
          </Col>
          <Col span={2}>
            <label className="block text-sm font-medium mb-2">&nbsp;</label>
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={handleRefresh}
              loading={isLoading}
            >
              Osveži
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Statistics Cards */}
      {statistics && (
        <Row gutter={16} className="mb-4">
          <Col span={4}>
            <Card>
              <Statistic
                title="Safety Score"
                value={statistics.safetyScore}
                suffix="/ 100"
                valueStyle={{ 
                  color: drivingBehaviorService.getSafetyScoreColor(statistics.safetyScore) 
                }}
                prefix={<SafetyOutlined />}
              />
              <Progress 
                percent={statistics.safetyScore} 
                strokeColor={drivingBehaviorService.getSafetyScoreColor(statistics.safetyScore)}
                showInfo={false}
              />
              <div className="text-center mt-2 text-sm">
                {drivingBehaviorService.getSafetyScoreLabel(statistics.safetyScore)}
              </div>
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="Ukupno događaja"
                value={statistics.totalEvents}
                prefix={<WarningOutlined />}
                suffix={
                  <span className="text-sm text-gray-500">
                    ({statistics.eventsPer100Km.toFixed(1)}/100km)
                  </span>
                }
              />
              <div className="mt-2">
                <Space>
                  <Tag color="red">Ozbiljno: {statistics.severeAccelerations + statistics.severeBrakings}</Tag>
                  <Tag color="orange">Umereno: {statistics.moderateAccelerations + statistics.moderateBrakings}</Tag>
                </Space>
              </div>
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="Agresivna ubrzanja"
                value={statistics.severeAccelerations + statistics.moderateAccelerations}
                prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
              <div className="mt-2 text-sm">
                <Space>
                  <span>Ozbiljno: {statistics.severeAccelerations}</span>
                  <span>Umereno: {statistics.moderateAccelerations}</span>
                </Space>
              </div>
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="Agresivna kočenja"
                value={statistics.severeBrakings + statistics.moderateBrakings}
                prefix={<StopOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
              <div className="mt-2 text-sm">
                <Space>
                  <span>Ozbiljno: {statistics.severeBrakings}</span>
                  <span>Umereno: {statistics.moderateBrakings}</span>
                </Space>
              </div>
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="Max G-sila"
                value={statistics.maxGForce}
                suffix="G"
                precision={2}
                prefix={<DashboardOutlined />}
                valueStyle={{ color: statistics.maxGForce > 0.5 ? '#ff4d4f' : '#1890ff' }}
              />
              <div className="mt-2 text-sm">
                Prosek: {statistics.avgGForce.toFixed(3)}G
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Chart */}
      <Card 
        title={
          <Space>
            <LineChartOutlined />
            <span>Grafikon ubrzanja/kočenja</span>
            {chartData && (
              <Tag>{chartData.eventCount} događaja</Tag>
            )}
          </Space>
        }
        className="mb-4"
      >
        {chartLoading ? (
          <div className="text-center py-8">
            <Spin size="large" />
          </div>
        ) : chartData && chartData.dataPoints.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartPoints} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="index"
                tick={false}
                label={{ value: 'Vreme', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                label={{ value: 'Ubrzanje (m/s²)', angle: -90, position: 'insideLeft' }}
                domain={['dataMin - 1', 'dataMax + 1']}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              
              {/* Reference lines for thresholds */}
              <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
              <ReferenceLine y={1.5} stroke="#faad14" strokeDasharray="5 5" label="Umereno ubrzanje" />
              <ReferenceLine y={2.5} stroke="#ff4d4f" strokeDasharray="5 5" label="Ozbiljno ubrzanje" />
              <ReferenceLine y={-2.0} stroke="#faad14" strokeDasharray="5 5" label="Umereno kočenje" />
              <ReferenceLine y={-3.5} stroke="#ff4d4f" strokeDasharray="5 5" label="Ozbiljno kočenje" />
              
              {/* Main line with custom dots */}
              <Line
                type="monotone"
                dataKey="acceleration"
                stroke="#1890ff"
                strokeWidth={2}
                dot={renderCustomDot}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Alert
            message="Nema podataka"
            description="Nema podataka za izabrani period"
            type="info"
          />
        )}
      </Card>

      {/* Events Table */}
      <Card 
        title={
          <Space>
            <span>
              {selectedSeverity === 'severe' 
                ? 'Lista ozbiljnih događaja agresivne vožnje'
                : selectedSeverity === 'moderate'
                ? 'Lista umerenih i ozbiljnih događaja'
                : 'Lista svih događaja agresivne vožnje'}
            </span>
            <Tag color={selectedSeverity === 'severe' ? 'red' : selectedSeverity === 'moderate' ? 'orange' : 'blue'}>
              {selectedSeverity === 'severe' 
                ? 'Samo ozbiljni'
                : selectedSeverity === 'moderate'
                ? 'Umereni i ozbiljni'
                : 'Svi događaji'}
            </Tag>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={
            eventsData?.events?.filter(event => {
              if (selectedSeverity === 'severe') return event.severity >= 4; // severe (4-5)
              if (selectedSeverity === 'moderate') return event.severity >= 3; // moderate (3) and severe (4-5)
              return true; // 'all' - prikaži sve
            })
          }
          rowKey="id"
          loading={eventsLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: eventsData?.total || 0,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
            showSizeChanger: true,
            showTotal: (total) => `Ukupno ${total} događaja`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default AggressiveDriving;