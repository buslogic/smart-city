import axios from 'axios';
import { TokenManager } from '../utils/token';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export interface SyncLog {
  id: number;
  syncType: 'full' | 'incremental';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  totalRecords: number;
  processedRecords: number;
  createdRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  errorDetails?: any;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface SyncStatus {
  isRunning: boolean;
  syncLog?: SyncLog;
}

export interface SyncDetail {
  id: number;
  legacyId: number;
  action: 'create' | 'update' | 'skip' | 'error';
  changes?: any;
  conflictFields?: any;
  resolution?: 'auto' | 'manual' | 'pending';
  errorMessage?: string;
  createdAt: string;
}

export interface SyncDetailsResponse {
  data: SyncDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class VehicleSyncService {
  private getAuthHeaders() {
    const token = TokenManager.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async startSync(
    syncType: 'full' | 'incremental' = 'full',
    config?: { batchSize?: number; delay?: number }
  ) {
    let url = `${API_URL}/api/vehicle-sync/start?type=${syncType}`;
    
    if (config?.batchSize) {
      url += `&batchSize=${config.batchSize}`;
    }
    if (config?.delay) {
      url += `&delay=${config.delay}`;
    }
    
    const response = await axios.post(url, {}, {
      headers: this.getAuthHeaders(),
    });
    
    return response.data;
  }

  async stopSync() {
    const response = await axios.delete(`${API_URL}/api/vehicle-sync/stop`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getStatus(): Promise<SyncStatus> {
    const response = await axios.get(`${API_URL}/api/vehicle-sync/status`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getHistory(limit: number = 10): Promise<SyncLog[]> {
    const response = await axios.get(
      `${API_URL}/api/vehicle-sync/history?limit=${limit}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async getSyncDetails(
    syncLogId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<SyncDetailsResponse> {
    const response = await axios.get(
      `${API_URL}/api/vehicle-sync/${syncLogId}/details?page=${page}&limit=${limit}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }
}

export const vehicleSyncService = new VehicleSyncService();