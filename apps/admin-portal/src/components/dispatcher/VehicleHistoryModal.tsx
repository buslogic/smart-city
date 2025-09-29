import React, { useState, useEffect, useRef } from 'react';
import { Modal, DatePicker, Button, Space, Spin, Empty, Statistic, Row, Col, Slider, message } from 'antd';
import { Play, Pause, SkipBack, SkipForward, Clock, TrendingUp, Navigation, AlertCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '../../services/api';
import 'leaflet/dist/leaflet.css';

const { RangePicker } = DatePicker;

interface VehiclePosition {
  garageNo: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  lineNumber: string | null;
  direction: string;
  captured: string;
  vehicleInfo?: {
    registrationNumber?: string | null;
    totalCapacity?: number | null;
  };
}

interface GPSPoint {
  time: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  lineNumber: string | null;
}

interface Statistics {
  totalDistance: number;
  drivingTime: number;
  idleTime: number;
  averageSpeed: number;
  maxSpeed: number;
  totalPoints: number;
}

interface VehicleHistoryModalProps {
  visible: boolean;
  vehicle: VehiclePosition | null;
  onClose: () => void;
}

// Bus ikonica za trenutnu poziciju
const createBusIconSmall = (speed: number, course: number) => {
  const BusIcon = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 16C4 16.88 4.39 17.67 5 18.22V20C5 20.55 5.45 21 6 21H7C7.55 21 8 20.55 8 20V19H16V20C16 20.55 16.45 21 17 21H18C18.55 21 19 20.55 19 20V18.22C19.61 17.67 20 16.88 20 16V6C20 2.5 16.42 2 12 2C7.58 2 4 2.5 4 6V16ZM7.5 17C6.67 17 6 16.33 6 15.5C6 14.67 6.67 14 7.5 14C8.33 14 9 14.67 9 15.5C9 16.33 8.33 17 7.5 17ZM16.5 17C15.67 17 15 16.33 15 15.5C15 14.67 15.67 14 16.5 14C17.33 14 18 14.67 18 15.5C18 16.33 17.33 17 16.5 17ZM18 11H6V6H18V11Z"/>
    </svg>
  `;

  return L.divIcon({
    html: `
      <div style="
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: ${speed > 0 ? '#10b981' : '#6b7280'};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transform: rotate(${course}deg);
      ">
        <div style="transform: rotate(-${course}deg);">
          ${BusIcon}
        </div>
      </div>
    `,
    className: 'history-bus-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const VehicleHistoryModal: React.FC<VehicleHistoryModalProps> = ({ visible, vehicle, onClose }) => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);
  const [gpsPoints, setGpsPoints] = useState<GPSPoint[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dohvati vehicle ID iz garažnog broja
  const getVehicleId = async (garageNo: string): Promise<number | null> => {
    try {
      const response = await api.get(`/api/vehicles`);
      const vehicleData = response.data.data.find((v: any) => v.garageNumber === garageNo);
      return vehicleData?.id || null;
    } catch (error) {
      console.error('Greška pri dohvatanju vehicle ID:', error);
      return null;
    }
  };

  // Učitaj GPS istoriju
  const loadHistory = async () => {
    if (!vehicle || !dateRange) {
      return;
    }

    setLoading(true);
    try {
      const vehicleId = await getVehicleId(vehicle.garageNo);
      if (!vehicleId) {
        return;
      }

      const [start, end] = dateRange;
      const response = await api.get(`/api/dispatcher/vehicle-history/${vehicleId}`, {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
      });

      if (response.data.success) {
        setGpsPoints(response.data.points);
        setStatistics(response.data.statistics);
        setCurrentIndex(0);
      }
    } catch (error: any) {
      console.error('Greška pri učitavanju istorije:', error);
    } finally {
      setLoading(false);
    }
  };

  // Play/Pause kontrole
  useEffect(() => {
    if (isPlaying && gpsPoints.length > 0) {
      const interval = 1000 / playbackSpeed; // Brzina (ms)
      playbackIntervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= gpsPoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, gpsPoints.length]);

  // Default range: Poslednji sat
  useEffect(() => {
    if (visible && !dateRange) {
      const now = dayjs();
      const oneHourAgo = now.subtract(1, 'hour');
      setDateRange([oneHourAgo, now]);
    }
  }, [visible]);

  // Reset na zatvaranju
  const handleClose = () => {
    setIsPlaying(false);
    setGpsPoints([]);
    setStatistics(null);
    setCurrentIndex(0);
    onClose();
  };

  const currentPoint = gpsPoints[currentIndex];
  const routeLine = gpsPoints.slice(0, currentIndex + 1).map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-purple-600" />
          <span>Istorija kretanja - {vehicle?.garageNo}</span>
          {vehicle?.vehicleInfo?.registrationNumber && (
            <span className="text-sm text-gray-500">({vehicle.vehicleInfo.registrationNumber})</span>
          )}
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width="95vw"
      style={{ top: 20 }}
      footer={null}
    >
      {/* Kontrole */}
      <div className="mb-4 space-y-4">
        {/* Date picker i Load button */}
        <div className="flex items-center gap-4">
          <RangePicker
            showTime
            format="DD.MM.YYYY HH:mm"
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs])}
            placeholder={['Početak', 'Kraj']}
            style={{ flex: 1 }}
          />
          <Button type="primary" onClick={loadHistory} loading={loading}>
            Prikaži istoriju
          </Button>
        </div>

        {/* Statistike */}
        {statistics && (
          <Row gutter={16}>
            <Col span={4}>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Statistic
                  title="Pređeni put"
                  value={statistics.totalDistance}
                  suffix="km"
                  valueStyle={{ fontSize: '18px', color: '#2563eb' }}
                />
              </div>
            </Col>
            <Col span={4}>
              <div className="p-3 bg-green-50 rounded-lg">
                <Statistic
                  title="Vreme vožnje"
                  value={statistics.drivingTime}
                  suffix="min"
                  valueStyle={{ fontSize: '18px', color: '#16a34a' }}
                />
              </div>
            </Col>
            <Col span={4}>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Statistic
                  title="Vreme stajanja"
                  value={statistics.idleTime}
                  suffix="min"
                  valueStyle={{ fontSize: '18px', color: '#ca8a04' }}
                />
              </div>
            </Col>
            <Col span={4}>
              <div className="p-3 bg-purple-50 rounded-lg">
                <Statistic
                  title="Prosečna brzina"
                  value={statistics.averageSpeed}
                  suffix="km/h"
                  valueStyle={{ fontSize: '18px', color: '#9333ea' }}
                />
              </div>
            </Col>
            <Col span={4}>
              <div className="p-3 bg-red-50 rounded-lg">
                <Statistic
                  title="Maks. brzina"
                  value={statistics.maxSpeed}
                  suffix="km/h"
                  valueStyle={{ fontSize: '18px', color: '#dc2626' }}
                />
              </div>
            </Col>
            <Col span={4}>
              <div className="p-3 bg-gray-50 rounded-lg">
                <Statistic
                  title="GPS tačke"
                  value={statistics.totalPoints}
                  valueStyle={{ fontSize: '18px', color: '#4b5563' }}
                />
              </div>
            </Col>
          </Row>
        )}

        {/* Playback kontrole */}
        {gpsPoints.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* Player kontrole */}
              <div className="flex items-center justify-between">
                <Space>
                  <Button
                    icon={<SkipBack className="w-4 h-4" />}
                    onClick={() => setCurrentIndex(0)}
                    disabled={currentIndex === 0}
                  >
                    Početak
                  </Button>
                  <Button
                    type="primary"
                    icon={isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? 'Pauziraj' : 'Reprodukuj'}
                  </Button>
                  <Button
                    icon={<SkipForward className="w-4 h-4" />}
                    onClick={() => setCurrentIndex(gpsPoints.length - 1)}
                    disabled={currentIndex === gpsPoints.length - 1}
                  >
                    Kraj
                  </Button>
                </Space>

                <Space>
                  <span className="text-sm text-gray-600">Brzina:</span>
                  {[0.5, 1, 2, 5, 10].map((speed) => (
                    <Button
                      key={speed}
                      size="small"
                      type={playbackSpeed === speed ? 'primary' : 'default'}
                      onClick={() => setPlaybackSpeed(speed)}
                    >
                      {speed}x
                    </Button>
                  ))}
                </Space>

                {currentPoint && (
                  <Space>
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium">
                      {new Date(currentPoint.time).toLocaleString('sr-RS')}
                    </span>
                    <span className="text-sm text-gray-500">
                      {currentIndex + 1} / {gpsPoints.length}
                    </span>
                  </Space>
                )}
              </div>

              {/* Slider */}
              <Slider
                min={0}
                max={gpsPoints.length - 1}
                value={currentIndex}
                onChange={(value) => {
                  setCurrentIndex(value);
                  setIsPlaying(false);
                }}
                tooltip={{
                  formatter: (value) =>
                    value !== undefined ? new Date(gpsPoints[value].time).toLocaleTimeString('sr-RS') : '',
                }}
              />

              {/* Trenutni podaci */}
              {currentPoint && (
                <div className="flex items-center justify-around p-3 bg-white rounded-lg border">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Brzina</div>
                    <div className="text-lg font-bold text-blue-600">{currentPoint.speed} km/h</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Smer</div>
                    <div className="text-lg font-bold text-purple-600">{currentPoint.course}°</div>
                  </div>
                  {currentPoint.lineNumber && (
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Linija</div>
                      <div className="text-lg font-bold text-green-600">{currentPoint.lineNumber}</div>
                    </div>
                  )}
                </div>
              )}
            </Space>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div style={{ height: '60vh', width: '100%' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full bg-gray-100">
            <Spin size="large" />
            <p className="mt-4 text-gray-600">Učitavanje GPS podataka...</p>
          </div>
        ) : gpsPoints.length === 0 ? (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <Empty description="Nema GPS podataka za izabrani period" />
          </div>
        ) : (
          <MapContainer
            center={[gpsPoints[0].lat, gpsPoints[0].lng]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Polyline - pređena ruta (plava) */}
            <Polyline positions={routeLine} color="#3b82f6" weight={4} opacity={0.7} />

            {/* Preostala ruta (siva) */}
            {currentIndex < gpsPoints.length - 1 && (
              <Polyline
                positions={gpsPoints.slice(currentIndex).map((p) => [p.lat, p.lng])}
                color="#9ca3af"
                weight={2}
                opacity={0.4}
                dashArray="5, 10"
              />
            )}

            {/* Marker za trenutnu poziciju */}
            {currentPoint && (
              <Marker
                position={[currentPoint.lat, currentPoint.lng]}
                icon={createBusIconSmall(currentPoint.speed, currentPoint.course)}
              >
                <Popup>
                  <div style={{ minWidth: '150px' }}>
                    <strong>🚌 {vehicle?.garageNo}</strong>
                    <div style={{ marginTop: '8px', fontSize: '12px' }}>
                      <div>Brzina: {currentPoint.speed} km/h</div>
                      <div>Smer: {currentPoint.course}°</div>
                      {currentPoint.lineNumber && <div>Linija: {currentPoint.lineNumber}</div>}
                      <div style={{ marginTop: '4px', color: '#666' }}>
                        {new Date(currentPoint.time).toLocaleString('sr-RS')}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Start marker */}
            <Marker position={[gpsPoints[0].lat, gpsPoints[0].lng]}>
              <Popup>
                <strong>🏁 Start</strong>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {new Date(gpsPoints[0].time).toLocaleString('sr-RS')}
                </div>
              </Popup>
            </Marker>

            {/* End marker */}
            {gpsPoints.length > 1 && (
              <Marker position={[gpsPoints[gpsPoints.length - 1].lat, gpsPoints[gpsPoints.length - 1].lng]}>
                <Popup>
                  <strong>🏁 Kraj</strong>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {new Date(gpsPoints[gpsPoints.length - 1].time).toLocaleString('sr-RS')}
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        )}
      </div>
    </Modal>
  );
};

export default VehicleHistoryModal;