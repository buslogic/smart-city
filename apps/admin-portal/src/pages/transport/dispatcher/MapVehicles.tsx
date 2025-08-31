import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, Tag, Spin, Empty, Button, Space, Badge, Statistic, Radio, message, Alert } from 'antd';
import { Map as MapIcon, Navigation, RefreshCw, Car, Users, AlertCircle, Server, Database, WifiOff } from 'lucide-react';
import axios from 'axios';
import VehicleMap from '../../../components/map/VehicleMap';

const { Option } = Select;

interface VehiclePosition {
  garageNo: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  lineNumber: string | null;
  direction: string;
  captured: string;
  peopleIn?: number;
  peopleOut?: number;
  batteryStatus?: number | null;
  vehicleInfo?: {
    registrationNumber?: string | null;
    totalCapacity?: number | null;
    vehicleType?: number | null;
  };
}

const MapVehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehiclePosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dataSource, setDataSource] = useState<'local' | 'legacy'>('local');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Učitavanje podataka sa API-ja
  const fetchVehiclePositions = async () => {
    setLoading(true);
    setConnectionError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:3010/api/dispatcher/current-positions?source=${dataSource}&limit=2000`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.data.success) {
        setVehicles(response.data.data);
        message.success(`Učitano ${response.data.count} vozila sa ${dataSource === 'local' ? 'lokalnog' : 'Gradskog'} servera`);
      }
    } catch (error: any) {
      console.error('Greška pri učitavanju pozicija:', error);
      
      // Prikaži specifičnu poruku na osnovu greške
      if (error.response?.data?.details === 'CONNECTION_TIMEOUT') {
        const errorMsg = error.response?.data?.message || 'Konekcija sa Gradskim serverom nije moguća. Server je trenutno nedostupan ili je VPN veza prekinuta.';
        setConnectionError(errorMsg);
        message.error({
          content: errorMsg,
          duration: 8,
          style: {
            marginTop: '20vh',
          },
        });
        message.warning('Prebacujte se na Bazni Server za prikaz lokalnih podataka', 5);
      } else if (error.response?.data?.message) {
        setConnectionError(error.response.data.message);
        message.error(error.response.data.message);
      } else {
        setConnectionError('Greška pri učitavanju podataka sa servera');
        message.error('Greška pri učitavanju podataka sa servera');
      }
      
      // Ako je legacy server nedostupan, automatski prebaci na lokalni
      if (dataSource === 'legacy' && error.response?.data?.details === 'CONNECTION_TIMEOUT') {
        message.info('Automatsko prebacivanje na Bazni Server...', 3);
        setTimeout(() => {
          setDataSource('local');
        }, 2000);
      }
      
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehiclePositions();
  }, [dataSource]);

  // Auto-refresh svakih 30 sekundi
  useEffect(() => {
    const interval = setInterval(() => {
      fetchVehiclePositions();
    }, 30000);
    return () => clearInterval(interval);
  }, [dataSource]);


  const filteredVehicles = vehicles.filter(vehicle => {
    if (filter === 'all') return true;
    // Za GPS podatke, sva vozila sa brzinom > 0 su "aktivna"
    const isActive = vehicle.speed > 0;
    return (filter === 'active' && isActive) || (filter === 'inactive' && !isActive);
  });

  const activeVehicles = vehicles.filter(v => v.speed > 0).length;
  const totalPassengers = vehicles.reduce((sum, v) => sum + (v.peopleIn || 0) - (v.peopleOut || 0), 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Dispečerski Modul - Mapa i vozila</h1>
        <p className="text-gray-600">Praćenje vozila u realnom vremenu</p>
      </div>

      {/* Alert za grešku konekcije */}
      {connectionError && dataSource === 'legacy' && (
        <Alert
          message="Problem sa konekcijom"
          description={connectionError}
          type="error"
          showIcon
          icon={<WifiOff />}
          closable
          onClose={() => setConnectionError(null)}
          action={
            <Button size="small" type="primary" onClick={() => setDataSource('local')}>
              Prebaci na Bazni Server
            </Button>
          }
          className="mb-4"
        />
      )}

      {/* Statistike */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Ukupno vozila"
              value={vehicles.length}
              prefix={<Car className="w-4 h-4" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Aktivna vozila"
              value={activeVehicles}
              valueStyle={{ color: '#52c41a' }}
              prefix={<Navigation className="w-4 h-4" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Trenutno putnika"
              value={totalPassengers}
              prefix={<Users className="w-4 h-4" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Kontrole */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <Space size="middle" wrap>
            {/* Izbor izvora podataka */}
            <div>
              <span className="mr-2 text-gray-600">Izvor podataka:</span>
              <Radio.Group 
                value={dataSource} 
                onChange={(e) => setDataSource(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="local">
                  <Space>
                    <Database className="w-4 h-4" />
                    Bazni Server
                  </Space>
                </Radio.Button>
                <Radio.Button value="legacy">
                  <Space>
                    <Server className="w-4 h-4" />
                    Gradski Server (Realtime)
                  </Space>
                </Radio.Button>
              </Radio.Group>
            </div>

            {/* Filter vozila */}
            <Select
              value={filter}
              onChange={setFilter}
              style={{ width: 150 }}
              placeholder="Filter vozila"
            >
              <Option value="all">Sva vozila</Option>
              <Option value="active">U pokretu</Option>
              <Option value="inactive">Parkirana</Option>
            </Select>
          </Space>
          
          <Button 
            type="primary" 
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={fetchVehiclePositions}
            loading={loading}
          >
            Osveži
          </Button>
        </div>
        
        {/* Status bar */}
        <div className="mt-3 pt-3 border-t">
          <Space>
            <Tag color={dataSource === 'local' ? 'blue' : 'green'}>
              {dataSource === 'local' ? 'Lokalni podaci' : 'Real-time GPS'}
            </Tag>
            <span className="text-sm text-gray-500">
              Poslednje ažuriranje: {new Date().toLocaleTimeString('sr-RS')}
            </span>
          </Space>
        </div>
      </Card>

      <Row gutter={16}>
        {/* Mapa */}
        <Col xs={24} lg={16}>
          <Card 
            title={
              <Space>
                <MapIcon className="w-5 h-5" />
                <span>Mapa vozila</span>
              </Space>
            }
            className="mb-6"
          >
            <VehicleMap 
              vehicles={filteredVehicles}
              selectedVehicle={selectedVehicle}
              onVehicleSelect={setSelectedVehicle}
            />
          </Card>
        </Col>

        {/* Lista vozila */}
        <Col xs={24} lg={8}>
          <Card 
            title="Aktivna vozila"
            className="mb-6"
            bodyStyle={{ maxHeight: '500px', overflowY: 'auto' }}
          >
            {loading ? (
              <div className="text-center py-8">
                <Spin size="large" />
              </div>
            ) : filteredVehicles.length === 0 ? (
              <Empty description="Nema vozila" />
            ) : (
              <div className="space-y-3">
                {filteredVehicles.map(vehicle => (
                  <Card
                    key={vehicle.garageNo}
                    size="small"
                    hoverable
                    onClick={() => setSelectedVehicle(vehicle)}
                    className={selectedVehicle?.garageNo === vehicle.garageNo ? 'border-blue-500' : ''}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{vehicle.garageNo}</div>
                        <div className="text-sm text-gray-500">
                          {vehicle.vehicleInfo?.registrationNumber || 'Bez registracije'}
                        </div>
                        {vehicle.lineNumber && (
                          <div className="text-sm mt-1">
                            <Badge status="processing" text={`Linija ${vehicle.lineNumber} - Smer ${vehicle.direction}`} />
                          </div>
                        )}
                      </div>
                      <Tag color={vehicle.speed > 0 ? 'success' : 'default'}>
                        {vehicle.speed > 0 ? 'U pokretu' : 'Parkiran'}
                      </Tag>
                    </div>
                    
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Brzina:</span>
                        <span>{vehicle.speed} km/h</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Pozicija:</span>
                        <span>{vehicle.lat.toFixed(4)}, {vehicle.lng.toFixed(4)}</span>
                      </div>
                      {vehicle.peopleIn !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Putnici:</span>
                          <span>↑{vehicle.peopleIn} ↓{vehicle.peopleOut}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Vreme:</span>
                        <span>{new Date(vehicle.captured).toLocaleTimeString('sr-RS')}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Detalji selektovanog vozila */}
      {selectedVehicle && (
        <Card title={`Detalji vozila: ${selectedVehicle.garageNo}`}>
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <div className="text-gray-500">Registracija</div>
              <div className="font-medium">{selectedVehicle.vehicleInfo?.registrationNumber || 'N/A'}</div>
            </Col>
            <Col xs={12} sm={6}>
              <div className="text-gray-500">Status</div>
              <Tag color={selectedVehicle.speed > 0 ? 'success' : 'default'}>
                {selectedVehicle.speed > 0 ? 'U pokretu' : 'Parkiran'}
              </Tag>
            </Col>
            <Col xs={12} sm={6}>
              <div className="text-gray-500">Brzina</div>
              <div className="font-medium">{selectedVehicle.speed || 0} km/h</div>
            </Col>
            <Col xs={12} sm={6}>
              <div className="text-gray-500">Poslednje ažuriranje</div>
              <div className="font-medium">
                {new Date(selectedVehicle.captured).toLocaleTimeString('sr-RS')}
              </div>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default MapVehicles;