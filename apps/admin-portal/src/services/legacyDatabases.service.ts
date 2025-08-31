import axios from 'axios';
import { TokenManager } from '../utils/token';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export type LegacyDatabaseSubtype = 
  | 'main_ticketing_database'
  | 'gps_ticketing_database' 
  | 'global_ticketing_database'
  | 'city_ticketing_database'
  | 'city_gps_ticketing_database';

export interface LegacyDatabase {
  id: number;
  name: string;
  type: 'mysql' | 'postgresql' | 'mongodb' | 'oracle' | 'mssql';
  subtype?: LegacyDatabaseSubtype;
  host: string;
  port: number;
  database: string;
  username: string;
  isActive: boolean;
  testConnection: boolean;
  lastConnectionTest?: string;
  connectionError?: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export interface CreateLegacyDatabaseDto {
  name: string;
  type: 'mysql' | 'postgresql' | 'mongodb' | 'oracle' | 'mssql';
  subtype?: LegacyDatabaseSubtype;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  isActive?: boolean;
  description?: string;
}

export interface UpdateLegacyDatabaseDto {
  name?: string;
  type?: 'mysql' | 'postgresql' | 'mongodb' | 'oracle' | 'mssql';
  subtype?: LegacyDatabaseSubtype;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  isActive?: boolean;
  description?: string;
}

export interface TestConnectionDto {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  type: 'mysql' | 'postgresql' | 'mongodb' | 'oracle' | 'mssql';
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error?: string;
  responseTime?: number;
  connectionInfo?: {
    host: string;
    port: number;
    database: string;
    username: string;
    type: string;
  };
}

class LegacyDatabasesService {
  private getAuthHeaders() {
    const token = TokenManager.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getAll(): Promise<LegacyDatabase[]> {
    const response = await axios.get(`${API_URL}/api/legacy-databases`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getById(id: number): Promise<LegacyDatabase> {
    const response = await axios.get(`${API_URL}/api/legacy-databases/${id}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async create(data: CreateLegacyDatabaseDto): Promise<LegacyDatabase> {
    const response = await axios.post(`${API_URL}/api/legacy-databases`, data, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async update(id: number, data: UpdateLegacyDatabaseDto): Promise<LegacyDatabase> {
    const response = await axios.patch(`${API_URL}/api/legacy-databases/${id}`, data, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await axios.delete(`${API_URL}/api/legacy-databases/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  async testConnection(id: number): Promise<ConnectionTestResult> {
    const response = await axios.post(
      `${API_URL}/api/legacy-databases/${id}/test-connection`,
      {},
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async testCustomConnection(data: TestConnectionDto): Promise<ConnectionTestResult> {
    const response = await axios.post(
      `${API_URL}/api/legacy-databases/test-connection`,
      data,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }
}

export const LEGACY_DATABASE_SUBTYPES = {
  MAIN_TICKETING: 'main_ticketing_database' as const,
  GPS_TICKETING: 'gps_ticketing_database' as const,
  GLOBAL_TICKETING: 'global_ticketing_database' as const,
  CITY_TICKETING: 'city_ticketing_database' as const,
  CITY_GPS_TICKETING: 'city_gps_ticketing_database' as const,
};

export const SUBTYPE_LABELS = {
  [LEGACY_DATABASE_SUBTYPES.MAIN_TICKETING]: 'Glavna Ticketing Baza',
  [LEGACY_DATABASE_SUBTYPES.GPS_TICKETING]: 'GPS Ticketing Baza',
  [LEGACY_DATABASE_SUBTYPES.GLOBAL_TICKETING]: 'Globalna Ticketing Baza',
  [LEGACY_DATABASE_SUBTYPES.CITY_TICKETING]: 'Gradska Ticketing Baza',
  [LEGACY_DATABASE_SUBTYPES.CITY_GPS_TICKETING]: 'Gradska GPS Ticketing Baza',
};

export const SUBTYPE_DESCRIPTIONS = {
  [LEGACY_DATABASE_SUBTYPES.MAIN_TICKETING]: 'Osnovna baza za ticketing sistem sa glavnim podacima',
  [LEGACY_DATABASE_SUBTYPES.GPS_TICKETING]: 'Baza sa GPS podacima vozila i ruta',
  [LEGACY_DATABASE_SUBTYPES.GLOBAL_TICKETING]: 'Globalna baza sa ukupnim ticketing podacima',
  [LEGACY_DATABASE_SUBTYPES.CITY_TICKETING]: 'Gradska baza sa lokalnim ticketing informacijama',
  [LEGACY_DATABASE_SUBTYPES.CITY_GPS_TICKETING]: 'Gradska baza sa kombinovanim GPS i ticketing podacima',
};

export const legacyDatabasesService = new LegacyDatabasesService();