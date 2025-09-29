import React, { useState, useEffect } from 'react';
import { Card, Select, Spin, Empty, Button, Space, Badge, Statistic, message, Alert, Input, Checkbox, Tag, Tooltip } from 'antd';
import { Search, RefreshCw, Car, Navigation, WifiOff, X, Eye, EyeOff } from 'lucide-react';
import { api } from '../../../services/api';
import VehicleMapModern from '../../../components/map/VehicleMapModern';
import VehicleHistoryModal from '../../../components/dispatcher/VehicleHistoryModal';

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

const MapVehiclesModern: React.FC = () => {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [focusedVehicle, setFocusedVehicle] = useState<VehiclePosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState<VehiclePosition | null>(null);

  // Učitavanje podataka sa Legacy servera
  const fetchVehiclePositions = async () => {
    setLoading(true);
    setConnectionError(null);
    try {
      const response = await api.get(
        `/api/dispatcher/current-positions?source=legacy&limit=2000`
      );

      if (response.data.success) {
        setVehicles(response.data.data);
      }
    } catch (error: any) {
      console.error('Greška pri učitavanju pozicija:', error);

      if (error.response?.data?.details === 'CONNECTION_TIMEOUT') {
        const errorMsg = error.response?.data?.message || 'Konekcija sa Gradskim serverom nije moguća. Server je trenutno nedostupan ili je VPN veza prekinuta.';
        setConnectionError(errorMsg);
      } else if (error.response?.data?.message) {
        setConnectionError(error.response.data.message);
      } else {
        setConnectionError('Greška pri učitavanju podataka sa servera');
      }

      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehiclePositions();
  }, []);

  // Auto-refresh svakih 30 sekundi
  useEffect(() => {
    const interval = setInterval(() => {
      fetchVehiclePositions();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filtriranje vozila
  const getFilteredVehicles = () => {
    let filtered = vehicles;

    // Filter po aktivnosti
    if (showOnlyActive) {
      filtered = filtered.filter(v => v.speed > 0);
    }

    // Filter po pretragI
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.garageNo.toLowerCase().includes(query) ||
        v.vehicleInfo?.registrationNumber?.toLowerCase().includes(query) ||
        v.lineNumber?.includes(query)
      );
    }

    // Filter po selekciji
    if (showOnlySelected && selectedVehicles.size > 0) {
      filtered = filtered.filter(v => selectedVehicles.has(v.garageNo));
    }

    return filtered;
  };

  const filteredVehicles = getFilteredVehicles();
  const activeVehicles = vehicles.filter(v => v.speed > 0).length;

  // Toggle selekcije vozila
  const toggleVehicleSelection = (garageNo: string) => {
    const newSelected = new Set(selectedVehicles);
    if (newSelected.has(garageNo)) {
      newSelected.delete(garageNo);
    } else {
      newSelected.add(garageNo);
    }
    setSelectedVehicles(newSelected);
  };

  // Centriranje na vozilo
  const handleVehicleClick = (vehicle: VehiclePosition) => {
    setFocusedVehicle(vehicle);
  };

  // Clear selekcije
  const clearSelection = () => {
    setSelectedVehicles(new Set());
    setShowOnlySelected(false);
  };

  // Otvori modal za istoriju
  const openVehicleHistory = (vehicle: VehiclePosition) => {
    setHistoryVehicle(vehicle);
    setHistoryModalVisible(true);
  };

  // Expose funkciju na window objektu za pristup iz mape
  useEffect(() => {
    (window as any).openVehicleHistory = openVehicleHistory;
    return () => {
      delete (window as any).openVehicleHistory;
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header sa kontrolama */}
      <div className="bg-white border-b shadow-sm z-10">
        <div className="px-6 py-3">
          {/* Naslov i osnovne info */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-600" />
                Dispečerski Modul - Praćenje vozila
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Real-time praćenje vozila sa Gradskog servera
              </p>
            </div>

            <Button
              type="primary"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={fetchVehiclePositions}
              loading={loading}
            >
              Osveži
            </Button>
          </div>

          {/* Alert za grešku konekcije */}
          {connectionError && (
            <Alert
              message="Problem sa konekcijom"
              description={connectionError}
              type="error"
              showIcon
              icon={<WifiOff />}
              closable
              onClose={() => setConnectionError(null)}
              className="mb-3"
            />
          )}

          {/* Kontrole i statistike */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Statistike */}
            <Space size="large">
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                <Car className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Ukupno vozila</div>
                  <div className="text-xl font-bold text-blue-600">{vehicles.length}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
                <Navigation className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-600">Aktivna vozila</div>
                  <div className="text-xl font-bold text-green-600">{activeVehicles}</div>
                </div>
              </div>

              {selectedVehicles.size > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-lg">
                  <Eye className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="text-xs text-gray-600">Selektovano</div>
                    <div className="text-xl font-bold text-purple-600">{selectedVehicles.size}</div>
                  </div>
                </div>
              )}
            </Space>

            {/* Kontrole */}
            <Space size="middle" wrap>
              {/* Pretraga */}
              <Input
                prefix={<Search className="w-4 h-4 text-gray-400" />}
                placeholder="Pretraži po garažnom broju, registraciji ili liniji..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: 350 }}
                allowClear
                suffix={
                  searchQuery && (
                    <span className="text-xs text-gray-500">
                      {filteredVehicles.length} rezultata
                    </span>
                  )
                }
              />

              {/* Toggle prikaza */}
              <Space>
                <Checkbox
                  checked={showOnlyActive}
                  onChange={(e) => setShowOnlyActive(e.target.checked)}
                >
                  <span className="text-sm">Samo aktivna</span>
                </Checkbox>

                <Checkbox
                  checked={showOnlySelected}
                  onChange={(e) => setShowOnlySelected(e.target.checked)}
                  disabled={selectedVehicles.size === 0}
                >
                  <span className="text-sm">Samo selektovana</span>
                </Checkbox>

                {selectedVehicles.size > 0 && (
                  <Button
                    size="small"
                    icon={<X className="w-3 h-3" />}
                    onClick={clearSelection}
                  >
                    Očisti selekciju
                  </Button>
                )}
              </Space>
            </Space>
          </div>

          {/* Status bar */}
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <Space>
              <Tag color="green">Real-time GPS - Gradski Server</Tag>
              <span className="text-xs text-gray-500">
                Poslednje ažuriranje: {new Date().toLocaleTimeString('sr-RS')}
              </span>
              <span className="text-xs text-gray-500">
                Prikazano: {filteredVehicles.length} od {vehicles.length} vozila
              </span>
            </Space>
          </div>
        </div>
      </div>

      {/* Mapa - preko celog ekrana */}
      <div className="flex-1 relative">
        {loading && vehicles.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
            <Spin size="large" />
            <p className="mt-4 text-gray-600">Učitavanje vozila...</p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <Empty
              description={
                searchQuery
                  ? `Nema vozila koja odgovaraju pretrazi "${searchQuery}"`
                  : showOnlyActive
                    ? "Nema aktivnih vozila"
                    : "Nema vozila"
              }
            />
          </div>
        ) : (
          <VehicleMapModern
            vehicles={filteredVehicles}
            selectedVehicles={selectedVehicles}
            focusedVehicle={focusedVehicle}
            onVehicleClick={handleVehicleClick}
            onVehicleSelect={toggleVehicleSelection}
          />
        )}
      </div>

      {/* Modal za istoriju kretanja */}
      <VehicleHistoryModal
        visible={historyModalVisible}
        vehicle={historyVehicle}
        onClose={() => {
          setHistoryModalVisible(false);
          setHistoryVehicle(null);
        }}
      />
    </div>
  );
};

export default MapVehiclesModern;