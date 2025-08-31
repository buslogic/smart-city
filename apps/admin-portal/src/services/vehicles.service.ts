import axios from 'axios';
import { TokenManager } from '../utils/token';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export interface Vehicle {
  id: number;
  legacyId?: number;
  garageNumber: string;
  registrationNumber?: string;
  vehicleNumber?: string;
  vehicleType?: number;
  vehicleBrand?: number;
  vehicleModel?: number;
  chassisNumber?: string;
  motorNumber?: string;
  yearOfManufacture?: string;
  seatCapacity: number;
  standingCapacity: number;
  totalCapacity: number;
  fuelType?: number;
  active: boolean;
  visible: boolean;
  wifi: boolean;
  airCondition: boolean;
  rampForDisabled: boolean;
  videoSystem: boolean;
  lowFloor: boolean;
  imei?: string;
  imeiNet?: string;
  gpsModel?: string;
  technicalControlFrom?: string;
  technicalControlTo?: string;
  registrationValidTo?: string;
  firstRegistrationDate?: string;
  centralPointId?: number;
  centralPointName?: string;
  note?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
}

export interface CreateVehicleDto {
  legacyId?: number;
  garageNumber: string;
  registrationNumber?: string;
  vehicleNumber?: string;
  vehicleType?: number;
  vehicleBrand?: number;
  vehicleModel?: number;
  chassisNumber?: string;
  motorNumber?: string;
  yearOfManufacture?: string;
  seatCapacity: number;
  standingCapacity: number;
  totalCapacity: number;
  fuelType?: number;
  active: boolean;
  visible: boolean;
  wifi: boolean;
  airCondition: boolean;
  rampForDisabled: boolean;
  videoSystem: boolean;
  lowFloor: boolean;
  imei?: string;
  imeiNet?: string;
  gpsModel?: string;
  technicalControlFrom?: string;
  technicalControlTo?: string;
  registrationValidTo?: string;
  firstRegistrationDate?: string;
  centralPointId?: number;
  centralPointName?: string;
  note?: string;
  imageUrl?: string;
}

export type UpdateVehicleDto = Partial<CreateVehicleDto>;

export interface VehiclesResponse {
  data: Vehicle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VehicleStatistics {
  total: number;
  active: number;
  inactive: number;
  byType: Array<{ type: number; count: number }>;
  byFuelType: Array<{ fuelType: number; count: number }>;
  withWifi: number;
  withAirCondition: number;
}

export interface ExpiringDocuments {
  expiringTechnicalControl: Array<{
    id: number;
    garageNumber: string;
    registrationNumber?: string;
    technicalControlTo: string;
  }>;
  expiringRegistration: Array<{
    id: number;
    garageNumber: string;
    registrationNumber?: string;
    registrationValidTo: string;
  }>;
}

// Mapiranje tipova vozila
export const VEHICLE_TYPES = {
  109: 'Standardni gradski',
  110: 'Zglobni',
  111: 'Minibus',
  112: 'Midi bus',
  114: 'Niskopodni',
  115: 'Turistički',
  116: 'Međugradski',
  125: 'Školski',
  126: 'Prilagođen',
};

// Mapiranje tipova goriva
export const FUEL_TYPES = {
  1: 'Benzin',
  2: 'Dizel',
  3: 'CNG (Prirodni gas)',
  4: 'Električni',
  5: 'Hibrid',
  6: 'Vodonik',
};

// Mapiranje brendova vozila
export const VEHICLE_BRANDS = {
  1: 'Mercedes-Benz',
  2: 'MAN',
  3: 'Solaris',
  4: 'Volvo',
  5: 'Iveco',
  6: 'Scania',
  7: 'Ikarbus',
  8: 'Higer',
  9: 'BYD',
  10: 'Yutong',
};

// Mapiranje modela vozila
export const VEHICLE_MODELS = {
  1: 'Citaro',
  2: "Lion's City",
  3: 'Urbino 12',
  4: '7900',
  5: 'Crossway',
  6: 'Citywide',
  7: 'IK-218',
  8: 'KLQ6129G',
  9: 'K9',
  10: 'E12',
};

class VehiclesService {
  private getAuthHeaders() {
    const token = TokenManager.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    active?: boolean,
    vehicleType?: number
  ): Promise<VehiclesResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    if (search) params.append('search', search);
    if (active !== undefined) params.append('active', active.toString());
    if (vehicleType) params.append('vehicleType', vehicleType.toString());

    const response = await axios.get(`${API_URL}/api/vehicles?${params}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getById(id: number): Promise<Vehicle> {
    const response = await axios.get(`${API_URL}/api/vehicles/${id}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getByGarageNumber(garageNumber: string): Promise<Vehicle> {
    const response = await axios.get(
      `${API_URL}/api/vehicles/garage-number/${garageNumber}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async getByLegacyId(legacyId: number): Promise<Vehicle> {
    const response = await axios.get(
      `${API_URL}/api/vehicles/legacy/${legacyId}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async create(data: CreateVehicleDto): Promise<Vehicle> {
    const response = await axios.post(`${API_URL}/api/vehicles`, data, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async update(id: number, data: UpdateVehicleDto): Promise<Vehicle> {
    const response = await axios.patch(
      `${API_URL}/api/vehicles/${id}`,
      data,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async delete(id: number): Promise<{ message: string }> {
    const response = await axios.delete(`${API_URL}/api/vehicles/${id}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getStatistics(): Promise<VehicleStatistics> {
    const response = await axios.get(`${API_URL}/api/vehicles/statistics`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getExpiringDocuments(days: number = 30): Promise<ExpiringDocuments> {
    const response = await axios.get(
      `${API_URL}/api/vehicles/expiring-documents?days=${days}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }
}

export const vehiclesService = new VehiclesService();