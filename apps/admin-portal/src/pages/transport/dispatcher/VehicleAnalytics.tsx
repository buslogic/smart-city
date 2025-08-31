import { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Row, Col, Statistic, Table, Space, Progress, Spin, Empty, message } from 'antd';
import { 
  CarOutlined, 
  DashboardOutlined, 
  ClockCircleOutlined, 
  EnvironmentOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  FieldTimeOutlined,
  StopOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { Line, Column, Gauge } from '@ant-design/plots';
import axios from 'axios';
import { TokenManager } from '../../../utils/token';

const { RangePicker } = DatePicker;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

interface Vehicle {
  id: number;
  garageNumber: string;
  registrationNumber: string;
  make: string;
  model: string;
}

interface GPSAnalytics {
  totalPoints: number;
  totalDistance: number;
  avgSpeed: number;
  maxSpeed: number;
  drivingHours: number;
  idleTime: number;
  totalStops: number;
  efficiency: number;
  hourlyData: {
    hour: string;
    distance: number;
    avgSpeed: number;
    points: number;
  }[];
  speedDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  dailyStats: {
    date: string;
    distance: number;
    drivingHours: number;
    avgSpeed: number;
  }[];
}

export default function VehicleAnalytics() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('day'), dayjs().endOf('day')]);
  const [analytics, setAnalytics] = useState<GPSAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    if (selectedVehicle && dateRange[0] && dateRange[1]) {
      loadAnalytics();
    }
  }, [selectedVehicle, dateRange]);

  const loadVehicles = async () => {
    try {
      const token = TokenManager.getAccessToken();
      if (!token) {
        message.error('Morate biti prijavljeni');
        return;
      }
      
      // Dohvati sve vozila sa velikim limitom
      const response = await axios.get(`${API_BASE}/api/vehicles`, {
        params: {
          limit: 2000, // Povećano da učita sva vozila
          page: 1
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Response je paginiran objekat sa data property
      const vehiclesData = response.data?.data || [];
      
      setVehicles(vehiclesData);
      
      // Pokušaj da pronađeš vozilo P93597 koje ima GPS podatke
      const p93597 = vehiclesData.find(v => v.garageNumber === 'P93597');
      if (p93597) {
        setSelectedVehicle(p93597.id);
      } else if (vehiclesData.length > 0) {
        // Ako P93597 ne postoji, selektuj prvo vozilo
        setSelectedVehicle(vehiclesData[0].id);
      }
    } catch (error: any) {
      console.error('Greška pri učitavanju vozila:', error);
      message.error('Greška pri učitavanju vozila');
    } finally {
      setLoadingVehicles(false);
    }
  };

  const loadAnalytics = async () => {
    if (!selectedVehicle || !dateRange[0] || !dateRange[1]) return;
    
    const token = TokenManager.getAccessToken();
    if (!token) {
      message.error('Morate biti prijavljeni');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/api/gps-analytics/vehicle`, {
        params: {
          vehicleId: selectedVehicle,
          startDate: dateRange[0].toISOString(),
          endDate: dateRange[1].toISOString()
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(response.data);
    } catch (error: any) {
      console.error('Greška pri učitavanju analitike:', error);
      message.error('Greška pri učitavanju analitike');
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const speedChartConfig = {
    data: analytics?.hourlyData || [],
    xField: 'hour',
    yField: 'avgSpeed',
    smooth: true,
    point: {
      size: 3,
      shape: 'circle',
    },
    label: {
      style: {
        fill: '#aaa',
      },
    },
    xAxis: {
      label: {
        formatter: (v: string) => `${v}h`,
      },
    },
    yAxis: {
      label: {
        formatter: (v: string) => `${v} km/h`,
      },
    },
    tooltip: {
      formatter: (datum: any) => ({
        name: 'Prosečna brzina',
        value: `${datum.avgSpeed.toFixed(1)} km/h`
      }),
    },
  };

  const distanceChartConfig = {
    data: analytics?.hourlyData || [],
    xField: 'hour',
    yField: 'distance',
    label: {
      position: 'top' as const,
      style: {
        fill: '#aaa',
      },
    },
    xAxis: {
      label: {
        formatter: (v: string) => `${v}h`,
      },
    },
    yAxis: {
      label: {
        formatter: (v: string) => `${v} km`,
      },
    },
    tooltip: {
      formatter: (datum: any) => ({
        name: 'Kilometraža',
        value: `${datum.distance.toFixed(2)} km`
      }),
    },
  };

  const efficiencyGaugeConfig = {
    percent: analytics ? (analytics.efficiency || 0) / 100 : 0,
    range: {
      color: 'l(0) 0:#F4664A 0.5:#FAAD14 1:#30BF78',
    },
    indicator: {
      pointer: { style: { stroke: '#D0D0D0' } },
      pin: { style: { stroke: '#D0D0D0' } },
    },
    axis: {
      label: {
        formatter: (v: string) => (Number(v) * 100).toFixed(0),
      },
    },
    statistic: {
      title: {
        formatter: () => 'Efikasnost',
        style: { fontSize: '14px' }
      },
      content: {
        formatter: () => `${analytics ? Math.round(analytics.efficiency) : 0}%`,
        style: { fontSize: '24px' }
      },
    },
  };

  // Boje za distribuciju brzine
  const getSpeedRangeColor = (range: string) => {
    if (range.includes('mirovanje')) return '#d9d9d9';
    if (range.includes('1-20')) return '#91d5ff';
    if (range.includes('21-40')) return '#69c0ff';
    if (range.includes('41-60')) return '#40a9ff';
    return '#1890ff';
  };

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Card 
        title={
          <Space>
            <LineChartOutlined />
            <span>Dispečerski Modul - Analiza</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col xs={24} sm={24} md={10} lg={8}>
            <Select
              placeholder="Izaberite vozilo"
              style={{ width: '100%' }}
              value={selectedVehicle}
              onChange={setSelectedVehicle}
              loading={loadingVehicles}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={vehicles.map(v => ({
                value: v.id,
                label: `${v.garageNumber} - ${v.registrationNumber}`
              }))}
            />
          </Col>
          <Col xs={24} sm={24} md={14} lg={10}>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
              presets={[
                { label: 'Danas', value: [dayjs().startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs] },
                { label: 'Juče', value: [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] as [Dayjs, Dayjs] },
                { label: 'Poslednja nedelja', value: [dayjs().subtract(7, 'day'), dayjs()] as [Dayjs, Dayjs] },
                { label: 'Poslednji mesec', value: [dayjs().subtract(30, 'day'), dayjs()] as [Dayjs, Dayjs] },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {loading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>Učitavanje analitike...</div>
          </div>
        </Card>
      ) : !analytics || analytics.totalPoints === 0 ? (
        <Card>
          <Empty description="Nema GPS podataka za izabrani period" />
        </Card>
      ) : (
        <>
          {/* Primarne KPI Kartice */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={12} md={6}>
              <Card hoverable>
                <Statistic
                  title="Ukupna kilometraža"
                  value={analytics.totalDistance}
                  precision={2}
                  suffix="km"
                  prefix={<EnvironmentOutlined style={{ color: '#1890ff' }} />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card hoverable>
                <Statistic
                  title="Prosečna brzina"
                  value={analytics.avgSpeed}
                  precision={1}
                  suffix="km/h"
                  prefix={<DashboardOutlined style={{ color: '#52c41a' }} />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card hoverable>
                <Statistic
                  title="Maksimalna brzina"
                  value={analytics.maxSpeed}
                  precision={0}
                  suffix="km/h"
                  prefix={<ThunderboltOutlined />}
                  valueStyle={{ color: analytics.maxSpeed > 80 ? '#ff4d4f' : '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card hoverable>
                <Statistic
                  title="Vreme vožnje"
                  value={analytics.drivingHours}
                  precision={1}
                  suffix="h"
                  prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                />
              </Card>
            </Col>
          </Row>

          {/* Sekundarne metrike i efikasnost */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={6} sm={6} md={4}>
              <Card hoverable>
                <Statistic
                  title="GPS tačaka"
                  value={analytics.totalPoints}
                  prefix={<FieldTimeOutlined />}
                />
              </Card>
            </Col>
            <Col xs={6} sm={6} md={4}>
              <Card hoverable>
                <Statistic
                  title="Zaustavljanja"
                  value={analytics.totalStops}
                  prefix={<StopOutlined />}
                />
              </Card>
            </Col>
            <Col xs={6} sm={6} md={4}>
              <Card hoverable>
                <Statistic
                  title="Mirovanje"
                  value={analytics.idleTime}
                  precision={1}
                  suffix="h"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card title="Efikasnost" hoverable>
                <div style={{ height: 120 }}>
                  {analytics && <Gauge {...efficiencyGaugeConfig} />}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card title="Distribucija brzine" hoverable>
                {analytics.speedDistribution && analytics.speedDistribution.length > 0 ? (
                  analytics.speedDistribution.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>{item.range}</div>
                      <Progress 
                        percent={item.percentage} 
                        size="small"
                        strokeColor={getSpeedRangeColor(item.range)}
                        format={(percent) => `${percent?.toFixed(0)}%`}
                      />
                    </div>
                  ))
                ) : (
                  <Empty description="Nema podataka" />
                )}
              </Card>
            </Col>
          </Row>

          {/* Grafikoni */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} md={12}>
              <Card title="Prosečna brzina po satima" hoverable>
                {analytics.hourlyData && analytics.hourlyData.length > 0 ? (
                  <Line {...speedChartConfig} height={250} />
                ) : (
                  <Empty description="Nema podataka po satima" />
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="Pređena kilometraža po satima" hoverable>
                {analytics.hourlyData && analytics.hourlyData.length > 0 ? (
                  <Column {...distanceChartConfig} height={250} />
                ) : (
                  <Empty description="Nema podataka po satima" />
                )}
              </Card>
            </Col>
          </Row>

          {/* Dnevna statistika tabela */}
          {analytics.dailyStats && analytics.dailyStats.length > 0 && (
            <Card title="Dnevna statistika" hoverable>
              <Table
                dataSource={analytics.dailyStats}
                columns={[
                  {
                    title: 'Datum',
                    dataIndex: 'date',
                    key: 'date',
                    render: (text) => dayjs(text).format('DD.MM.YYYY')
                  },
                  {
                    title: 'Kilometraža',
                    dataIndex: 'distance',
                    key: 'distance',
                    render: (val) => `${val.toFixed(2)} km`,
                    align: 'right'
                  },
                  {
                    title: 'Sati vožnje',
                    dataIndex: 'drivingHours',
                    key: 'drivingHours',
                    render: (val) => `${val.toFixed(1)} h`,
                    align: 'right'
                  },
                  {
                    title: 'Prosečna brzina',
                    dataIndex: 'avgSpeed',
                    key: 'avgSpeed',
                    render: (val) => `${val.toFixed(1)} km/h`,
                    align: 'right'
                  }
                ]}
                pagination={false}
                size="small"
                rowKey="date"
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}