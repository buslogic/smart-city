import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Car, Users, Battery, AlertCircle } from 'lucide-react';

// Fix za Leaflet ikone u React aplikaciji
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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

interface VehicleMapProps {
  vehicles: VehiclePosition[];
  selectedVehicle: VehiclePosition | null;
  onVehicleSelect: (vehicle: VehiclePosition) => void;
}

// Custom ikona za vozila
const createVehicleIcon = (vehicle: VehiclePosition) => {
  const isMoving = vehicle.speed > 0;
  const color = isMoving ? '#10b981' : '#6b7280'; // zelena ako se kreće, siva ako stoji
  const rotation = vehicle.course || 0;
  
  return L.divIcon({
    html: `
      <div style="
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: ${color};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transform: rotate(${rotation}deg);
        transition: all 0.3s ease;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="transform: rotate(-${rotation}deg);">
          <path d="M12 2L5 9V20C5 20.55 5.45 21 6 21H9V14H15V21H18C18.55 21 19 20.55 19 20V9L12 2Z"/>
        </svg>
      </div>
      ${vehicle.lineNumber ? `
        <div style="
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: #1e40af;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: bold;
          white-space: nowrap;
        ">${vehicle.lineNumber}</div>
      ` : ''}
    `,
    className: 'vehicle-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Komponenta za centriranje mape na selektovano vozilo
function MapController({ selectedVehicle }: { selectedVehicle: VehiclePosition | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedVehicle) {
      map.flyTo([selectedVehicle.lat, selectedVehicle.lng], 16, {
        duration: 1.5
      });
    }
  }, [selectedVehicle, map]);
  
  return null;
}

const VehicleMap: React.FC<VehicleMapProps> = ({ vehicles, selectedVehicle, onVehicleSelect }) => {
  // Centar Beograda kao početna pozicija
  const defaultCenter: [number, number] = [44.7866, 20.4489];
  const defaultZoom = 12;
  
  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        {/* OpenStreetMap tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Map controller za centriranje */}
        <MapController selectedVehicle={selectedVehicle} />
        
        {/* Markeri za vozila */}
        {vehicles.map((vehicle) => (
          <Marker
            key={vehicle.garageNo}
            position={[vehicle.lat, vehicle.lng]}
            icon={createVehicleIcon(vehicle)}
            eventHandlers={{
              click: () => onVehicleSelect(vehicle),
            }}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                  Vozilo: {vehicle.garageNo}
                </h4>
                
                {vehicle.vehicleInfo?.registrationNumber && (
                  <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                    <strong>Registracija:</strong> {vehicle.vehicleInfo.registrationNumber}
                  </div>
                )}
                
                {vehicle.lineNumber && (
                  <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                    <strong>Linija:</strong> {vehicle.lineNumber} - Smer {vehicle.direction}
                  </div>
                )}
                
                <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                  <strong>Brzina:</strong> {vehicle.speed} km/h
                </div>
                
                <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                  <strong>Status:</strong> {vehicle.speed > 0 ? '🟢 U pokretu' : '🔴 Parkiran'}
                </div>
                
                {vehicle.peopleIn !== undefined && (
                  <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                    <strong>Putnici:</strong> Ušli: {vehicle.peopleIn}, Izašli: {vehicle.peopleOut}
                  </div>
                )}
                
                {vehicle.batteryStatus !== undefined && vehicle.batteryStatus !== null && (
                  <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                    <strong>Baterija:</strong> {vehicle.batteryStatus}%
                  </div>
                )}
                
                <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                  Poslednje ažuriranje: {new Date(vehicle.captured).toLocaleTimeString('sr-RS')}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default VehicleMap;