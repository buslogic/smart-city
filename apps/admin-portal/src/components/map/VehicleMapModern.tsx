import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'leaflet/dist/leaflet.css';

// Omogući UTC i timezone plugin za dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

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

interface VehicleMapModernProps {
  vehicles: VehiclePosition[];
  selectedVehicles: Set<string>;
  focusedVehicle: VehiclePosition | null;
  onVehicleClick: (vehicle: VehiclePosition) => void;
  onVehicleSelect: (garageNo: string) => void;
}

// SVG za autobus ikonu
const BusIcon = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 16C4 16.88 4.39 17.67 5 18.22V20C5 20.55 5.45 21 6 21H7C7.55 21 8 20.55 8 20V19H16V20C16 20.55 16.45 21 17 21H18C18.55 21 19 20.55 19 20V18.22C19.61 17.67 20 16.88 20 16V6C20 2.5 16.42 2 12 2C7.58 2 4 2.5 4 6V16ZM7.5 17C6.67 17 6 16.33 6 15.5C6 14.67 6.67 14 7.5 14C8.33 14 9 14.67 9 15.5C9 16.33 8.33 17 7.5 17ZM16.5 17C15.67 17 15 16.33 15 15.5C15 14.67 15.67 14 16.5 14C17.33 14 18 14.67 18 15.5C18 16.33 17.33 17 16.5 17ZM18 11H6V6H18V11Z"/>
</svg>
`;

// Custom ikona za vozila - AUTOBUS IKONICA
const createBusIcon = (vehicle: VehiclePosition, isSelected: boolean) => {
  const isMoving = vehicle.speed > 0;

  // Boje
  const bgColor = isSelected
    ? '#8b5cf6' // Purple za selektovana
    : isMoving
      ? '#10b981' // Zelena za vozila u pokretu
      : '#6b7280'; // Siva za parkirana

  const rotation = vehicle.course || 0;

  return L.divIcon({
    html: `
      <div style="position: relative;">
        <!-- Glavni bus marker -->
        <div style="
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: ${bgColor};
          border-radius: 8px;
          border: ${isSelected ? '4px' : '3px'} solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transform: rotate(${rotation}deg);
          transition: all 0.3s ease;
        ">
          <div style="color: white; transform: rotate(-${rotation}deg);">
            ${BusIcon}
          </div>
        </div>

        <!-- Broj linije badge -->
        ${vehicle.lineNumber ? `
          <div style="
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%);
            background: #1e40af;
            color: white;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            border: 2px solid white;
          ">${vehicle.lineNumber}</div>
        ` : ''}

        <!-- Garažni broj badge -->
        <div style="
          position: absolute;
          bottom: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          color: #1f2937;
          padding: 2px 6px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          border: 1px solid #e5e7eb;
        ">${vehicle.garageNo}</div>

        <!-- Indicator za selekciju -->
        ${isSelected ? `
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            width: 16px;
            height: 16px;
            background: #8b5cf6;
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          ">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
        ` : ''}
      </div>
    `,
    className: 'vehicle-bus-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

// Komponenta za centriranje mape na fokusirano vozilo
function MapController({
  focusedVehicle,
  vehicles
}: {
  focusedVehicle: VehiclePosition | null;
  vehicles: VehiclePosition[];
}) {
  const map = useMap();

  useEffect(() => {
    if (focusedVehicle) {
      map.flyTo([focusedVehicle.lat, focusedVehicle.lng], 16, {
        duration: 1.5
      });
    } else if (vehicles.length > 0) {
      // Fit bounds za sva vozila
      const bounds = L.latLngBounds(
        vehicles.map(v => [v.lat, v.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [focusedVehicle, vehicles, map]);

  return null;
}

const VehicleMapModern: React.FC<VehicleMapModernProps> = ({
  vehicles,
  selectedVehicles,
  focusedVehicle,
  onVehicleClick,
  onVehicleSelect
}) => {
  // Centar Beograda kao početna pozicija
  const defaultCenter: [number, number] = [44.7866, 20.4489];
  const defaultZoom = 12;

  return (
    <div className="h-full w-full">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        {/* OpenStreetMap tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map controller za centriranje */}
        <MapController focusedVehicle={focusedVehicle} vehicles={vehicles} />

        {/* Markeri za vozila */}
        {vehicles.map((vehicle) => {
          const isSelected = selectedVehicles.has(vehicle.garageNo);

          return (
            <Marker
              key={vehicle.garageNo}
              position={[vehicle.lat, vehicle.lng]}
              icon={createBusIcon(vehicle, isSelected)}
              eventHandlers={{
                click: () => {
                  onVehicleClick(vehicle);
                },
                dblclick: () => {
                  onVehicleSelect(vehicle.garageNo);
                }
              }}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              <Popup>
                <div style={{ minWidth: '250px' }}>
                  {/* Header */}
                  <div style={{
                    borderBottom: '2px solid #e5e7eb',
                    paddingBottom: '8px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#1f2937'
                      }}>
                        🚌 {vehicle.garageNo}
                      </h4>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        background: vehicle.speed > 0 ? '#dcfce7' : '#f3f4f6',
                        color: vehicle.speed > 0 ? '#166534' : '#6b7280'
                      }}>
                        {vehicle.speed > 0 ? '🟢 U pokretu' : '🔴 Parkiran'}
                      </span>
                    </div>

                    {vehicle.vehicleInfo?.registrationNumber && (
                      <div style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        marginTop: '4px'
                      }}>
                        Tablice: <strong>{vehicle.vehicleInfo.registrationNumber}</strong>
                      </div>
                    )}
                  </div>

                  {/* Linija info */}
                  {vehicle.lineNumber && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '8px',
                      background: '#eff6ff',
                      borderRadius: '6px'
                    }}>
                      <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 'bold' }}>
                        📍 Linija {vehicle.lineNumber} - Smer {vehicle.direction}
                      </div>
                    </div>
                  )}

                  {/* Podaci */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>Brzina</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937' }}>
                        {vehicle.speed} km/h
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>Smer</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937' }}>
                        {vehicle.course}°
                      </div>
                    </div>
                  </div>

                  {/* Footer sa vremenom */}
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '11px',
                    color: '#9ca3af'
                  }}>
                    ⏱ {dayjs.utc(vehicle.captured).tz('Europe/Belgrade').format('DD.MM.YYYY HH:mm:ss')}
                  </div>

                  {/* Akcije */}
                  <div style={{
                    marginTop: '8px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px'
                  }}>
                    <button
                      onClick={() => onVehicleSelect(vehicle.garageNo)}
                      style={{
                        padding: '6px 12px',
                        background: isSelected ? '#dc2626' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {isSelected ? '✓ Deselektuj' : '+ Selektuj'}
                    </button>
                    <button
                      onClick={() => {
                        // Ovde ćemo otvoriti modal za istoriju
                        if (window.openVehicleHistory) {
                          window.openVehicleHistory(vehicle);
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        background: '#8b5cf6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      📜 Istorija
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default VehicleMapModern;