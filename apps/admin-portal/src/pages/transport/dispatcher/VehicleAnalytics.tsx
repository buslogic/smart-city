import { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Row, Col, Statistic, Table, Space, Progress, Spin, Empty, message, Button, Divider, Tabs } from 'antd';
import { 
  CarOutlined, 
  DashboardOutlined, 
  ClockCircleOutlined, 
  EnvironmentOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  FieldTimeOutlined,
  StopOutlined,
  CalendarOutlined,
  SearchOutlined,
  ReloadOutlined,
  BarChartOutlined,
  AreaChartOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { Line, Column, Area } from '@ant-design/plots';
import { api } from '../../../services/api';
import { VehicleMapper } from '../../../utils/vehicle-mapper';
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
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null); // vehicle ID
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().startOf('day'));
  const [endDate, setEndDate] = useState<Dayjs>(dayjs().endOf('day'));
  const [analytics, setAnalytics] = useState<GPSAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      // Dohvati sve vozila sa velikim limitom
      const response = await api.get('/api/vehicles', {
        params: {
          limit: 2000, // Povećano da učita sva vozila
          page: 1
        }
      });
      
      // Response je paginiran objekat sa data property
      const vehiclesData = response.data?.data || [];
      
      setVehicles(vehiclesData);
      
      // Pokušaj da pronađeš vozilo P93597 koje ima GPS podatke
      const p93597 = vehiclesData.find((v: Vehicle) => v.garageNumber === 'P93597');
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
    if (!selectedVehicle) {
      message.warning('Molimo izaberite vozilo');
      return;
    }
    
    if (!startDate || !endDate) {
      message.warning('Molimo izaberite period');
      return;
    }
    
    setLoading(true);
    try {
      // Koristi format sa eksplicitnom timezone oznakom +02:00 za CEST
      // Ovo osigurava da backend interpretira vreme tačno
      const timezoneOffset = '+02:00'; // CEST (Central European Summer Time)
      
      const formattedStartDate = startDate.format('YYYY-MM-DD HH:mm:ss') + timezoneOffset;
      const formattedEndDate = endDate.format('YYYY-MM-DD HH:mm:ss') + timezoneOffset;
      
      console.log('Šaljem datume sa timezone:', {
        start: formattedStartDate,
        end: formattedEndDate,
        start_display: startDate.format('DD.MM.YYYY HH:mm'),
        end_display: endDate.format('DD.MM.YYYY HH:mm')
      });
      
      const response = await api.get('/api/gps-analytics/vehicle', {
        params: {
          vehicleId: selectedVehicle,
          startDate: formattedStartDate,
          endDate: formattedEndDate
        }
      });
      setAnalytics(response.data);
      
      if (response.data.totalPoints === 0) {
        message.info('Nema GPS podataka za izabrani period');
      }
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

  // Konfiguracija za dnevni grafikon kilometraže
  const dailyDistanceConfig = {
    data: analytics?.dailyStats || [],
    xField: 'date',
    yField: 'distance',
    smooth: true,
    area: {
      style: {
        fill: 'l(270) 0:#ffffff 0.5:#7ec2f3 1:#1890ff',
      },
    },
    xAxis: {
      label: {
        formatter: (v: string) => dayjs(v).format('DD.MM'),
        autoRotate: true,
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

  // Priprema podataka za mesečni prikaz
  const prepareMonthlyData = () => {
    if (!analytics?.dailyStats || analytics.dailyStats.length === 0) return [];
    
    const monthlyData: { [key: string]: number } = {};
    
    analytics.dailyStats.forEach(stat => {
      const monthKey = dayjs(stat.date).format('YYYY-MM');
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += stat.distance;
    });
    
    return Object.entries(monthlyData).map(([month, distance]) => ({
      month,
      distance: parseFloat(distance.toFixed(2))
    }));
  };

  // Konfiguracija za mesečni grafikon
  const monthlyDistanceConfig = {
    data: prepareMonthlyData(),
    xField: 'month',
    yField: 'distance',
    color: '#52c41a',
    label: {
      position: 'top' as const,
      style: {
        fill: '#52c41a',
      },
    },
    xAxis: {
      label: {
        formatter: (v: string) => dayjs(v).format('MMM YYYY'),
      },
    },
    yAxis: {
      label: {
        formatter: (v: string) => `${v} km`,
      },
    },
    tooltip: {
      formatter: (datum: any) => ({
        name: 'Ukupna kilometraža',
        value: `${datum.distance.toFixed(2)} km`
      }),
    },
  };

  const getEfficiencyColor = (percent: number) => {
    if (percent < 30) return '#ff4d4f';
    if (percent < 60) return '#faad14';
    return '#52c41a';
  };

  // Funkcija za brzo postavljanje datuma
  const setQuickDateRange = (type: string) => {
    const now = dayjs();
    let start: Dayjs;
    let end: Dayjs;

    switch(type) {
      case 'today':
        start = now.startOf('day').hour(0).minute(0).second(0);
        end = now.endOf('day').hour(23).minute(59).second(59);
        break;
      case 'yesterday':
        start = now.subtract(1, 'day').startOf('day').hour(0).minute(0).second(0);
        end = now.subtract(1, 'day').endOf('day').hour(23).minute(59).second(59);
        break;
      case 'last7days':
        start = now.subtract(7, 'day').startOf('day').hour(0).minute(0).second(0);
        end = now.endOf('day').hour(23).minute(59).second(59);
        break;
      case 'thisMonth':
        start = now.startOf('month').hour(0).minute(0).second(0);
        end = now.endOf('day').hour(23).minute(59).second(59);
        break;
      case 'lastMonth':
        start = now.subtract(1, 'month').startOf('month').hour(0).minute(0).second(0);
        end = now.subtract(1, 'month').endOf('month').hour(23).minute(59).second(59);
        break;
      default:
        return;
    }

    setStartDate(start);
    setEndDate(end);
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
            <span>Dispečerski Modul - Analitika vozila</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <div>
          {/* Prvi red - Vozilo */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Vozilo:
              </label>
              <Select
                placeholder="Izaberite vozilo iz liste"
                style={{ width: '100%' }}
                size="large"
                value={selectedVehicle}
                onChange={setSelectedVehicle}
                loading={loadingVehicles}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={vehicles.map(v => ({
                  value: v.id,
                  label: `${v.garageNumber} - ${v.registrationNumber} (${v.make} ${v.model})`
                }))}
              />
            </Col>
          </Row>

          {/* Drugi red - Datumi sa vremenom */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Početni datum i vreme:
              </label>
              <DatePicker
                value={startDate}
                onChange={(date) => date && setStartDate(date)}
                style={{ width: '100%' }}
                size="large"
                showTime={{ 
                  defaultValue: dayjs('00:00:00', 'HH:mm:ss'),
                  format: 'HH:mm'
                }}
                format="DD.MM.YYYY HH:mm"
                placeholder="Izaberite početni datum i vreme"
              />
            </Col>
            <Col xs={24} sm={12}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Krajnji datum i vreme:
              </label>
              <DatePicker
                value={endDate}
                onChange={(date) => date && setEndDate(date)}
                style={{ width: '100%' }}
                size="large"
                showTime={{ 
                  defaultValue: dayjs('23:59:59', 'HH:mm:ss'),
                  format: 'HH:mm'
                }}
                format="DD.MM.YYYY HH:mm"
                placeholder="Izaberite krajnji datum i vreme"
              />
            </Col>
          </Row>

          {/* Treći red - Brze prečice */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Brzi izbor perioda:
              </label>
              <Space wrap>
                <Button 
                  onClick={() => setQuickDateRange('today')}
                  icon={<CalendarOutlined />}
                >
                  Danas
                </Button>
                <Button 
                  onClick={() => setQuickDateRange('yesterday')}
                >
                  Juče
                </Button>
                <Button 
                  onClick={() => setQuickDateRange('last7days')}
                >
                  Poslednjih 7 dana
                </Button>
                <Button 
                  onClick={() => setQuickDateRange('thisMonth')}
                >
                  Ovaj mesec
                </Button>
                <Button 
                  onClick={() => setQuickDateRange('lastMonth')}
                >
                  Prošli mesec
                </Button>
              </Space>
            </Col>
          </Row>

          <Divider />

          {/* Četvrti red - Dugme za pokretanje */}
          <Row>
            <Col span={24}>
              <Button 
                type="primary"
                size="large"
                icon={<SearchOutlined />}
                onClick={loadAnalytics}
                loading={loading}
                style={{ marginRight: 16 }}
              >
                Prikaži analitiku
              </Button>
              <Button 
                size="large"
                icon={<ReloadOutlined />}
                onClick={() => {
                  setAnalytics(null);
                  setStartDate(dayjs().startOf('day'));
                  setEndDate(dayjs().endOf('day'));
                }}
              >
                Resetuj
              </Button>
            </Col>
          </Row>
        </div>
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
                  title="Vreme mirovanja"
                  value={analytics.idleTime}
                  precision={1}
                  suffix="sati"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card hoverable>
                <Statistic
                  title="Efikasnost"
                  value={analytics?.efficiency || 0}
                  precision={0}
                  suffix="%"
                  prefix={<DashboardOutlined style={{ color: getEfficiencyColor(analytics?.efficiency || 0) }} />}
                />
                <Progress 
                  type="dashboard"
                  percent={analytics?.efficiency || 0}
                  strokeColor={getEfficiencyColor(analytics?.efficiency || 0)}
                  size={80}
                  format={percent => `${percent}%`}
                />
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

          {/* Grafikoni sa Tabs */}
          <Card 
            title="Analiza kilometraže" 
            style={{ marginBottom: 16 }}
            hoverable
          >
            <Tabs defaultActiveKey="hourly">
              <Tabs.TabPane 
                tab={
                  <span>
                    <ClockCircleOutlined />
                    Po satima
                  </span>
                } 
                key="hourly"
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Card title="Prosečna brzina po satima" size="small">
                      {analytics.hourlyData && analytics.hourlyData.length > 0 ? (
                        <Line {...speedChartConfig} height={250} />
                      ) : (
                        <Empty description="Nema podataka po satima" />
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card title="Kilometraža po satima" size="small">
                      {analytics.hourlyData && analytics.hourlyData.length > 0 ? (
                        <Column {...distanceChartConfig} height={250} />
                      ) : (
                        <Empty description="Nema podataka po satima" />
                      )}
                    </Card>
                  </Col>
                </Row>
              </Tabs.TabPane>
              
              <Tabs.TabPane 
                tab={
                  <span>
                    <CalendarOutlined />
                    Po danima
                  </span>
                } 
                key="daily"
              >
                <Card title="Kilometraža po danima" size="small">
                  {analytics.dailyStats && analytics.dailyStats.length > 0 ? (
                    <Area {...dailyDistanceConfig} height={300} />
                  ) : (
                    <Empty description="Nema dovoljno podataka za dnevni prikaz" />
                  )}
                </Card>
              </Tabs.TabPane>
              
              <Tabs.TabPane 
                tab={
                  <span>
                    <BarChartOutlined />
                    Mesečno
                  </span>
                } 
                key="monthly"
              >
                <Card title="Mesečna kilometraža" size="small">
                  {prepareMonthlyData().length > 0 ? (
                    <Column {...monthlyDistanceConfig} height={300} />
                  ) : (
                    <Empty description="Nema dovoljno podataka za mesečni prikaz" />
                  )}
                </Card>
              </Tabs.TabPane>
              
              <Tabs.TabPane 
                tab={
                  <span>
                    <AreaChartOutlined />
                    Statistika
                  </span>
                } 
                key="stats"
              >
                {analytics.dailyStats && analytics.dailyStats.length > 0 ? (
                  <Card title="Sumarna statistika" size="small">
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic 
                          title="Ukupno dana sa vožnjom"
                          value={new Set(analytics.dailyStats.map(d => d.date)).size}
                          suffix="dana"
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic 
                          title="Prosečna dnevna kilometraža"
                          value={
                            analytics.dailyStats.length > 0 
                              ? (analytics.totalDistance / new Set(analytics.dailyStats.map(d => d.date)).size).toFixed(2)
                              : 0
                          }
                          suffix="km"
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic 
                          title="Maksimalna dnevna kilometraža"
                          value={
                            Math.max(...(analytics.dailyStats?.map(d => d.distance) || [0]))
                          }
                          precision={2}
                          suffix="km"
                        />
                      </Col>
                    </Row>
                  </Card>
                ) : (
                  <Empty description="Nema dovoljno podataka za statistiku" />
                )}
              </Tabs.TabPane>
            </Tabs>
          </Card>

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