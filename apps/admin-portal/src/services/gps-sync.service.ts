import axios from 'axios';
import { TokenManager } from '../utils/token';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export interface GpsSyncLog {
  id: number;
  vehicleId?: number | null;
  vehicleGarageNo?: string | null;
  syncStartDate: string;
  syncEndDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  totalPoints: number;
  processedPoints: number;
  insertedPoints: number;
  updatedPoints: number;
  skippedPoints: number;
  errorPoints: number;
  totalDistance?: number;
  batchSize: number;
  delayMs: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export interface GpsSyncStatus {
  isRunning: boolean;
  syncLog?: GpsSyncLog;
}

export interface StartSyncParams {
  vehicleId?: string | null;  // za kompatibilnost sa starim kodom
  vehicleIds?: number[] | null;  // nova opcija za listu vozila - koristi number[] jer su vehicle ID-jevi brojevi
  startDate: string;
  endDate: string;
  batchSize: number;
  delay: number;
}

class GpsSyncService {
  private getAuthHeaders() {
    const token = TokenManager.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async startSync(params: StartSyncParams) {
    const response = await axios.post(`${API_URL}/api/gps-sync/start`, params, {
      headers: this.getAuthHeaders(),
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return response.data;
  }

  async stopSync() {
    const response = await axios.delete(`${API_URL}/api/gps-sync/stop`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async stopSyncById(syncId: number) {
    const response = await axios.delete(`${API_URL}/api/gps-sync/stop/${syncId}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getStatus(): Promise<GpsSyncStatus> {
    const response = await axios.get(`${API_URL}/api/gps-sync/status`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getHistory(limit: number = 20): Promise<GpsSyncLog[]> {
    const response = await axios.get(`${API_URL}/api/gps-sync/history`, {
      headers: this.getAuthHeaders(),
      params: { limit }
    });
    return response.data;
  }

  async getSyncDetails(id: number, page: number = 1, limit: number = 50) {
    const response = await axios.get(`${API_URL}/api/gps-sync/${id}/details`, {
      headers: this.getAuthHeaders(),
      params: { page, limit }
    });
    return response.data;
  }

  async cleanupStale() {
    const response = await axios.post(`${API_URL}/api/gps-sync/cleanup`, {}, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }
}

export const gpsSyncService = new GpsSyncService();