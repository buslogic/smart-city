import { api } from './api';

export interface VehicleWithSyncStatus {
  id: number;
  garage_number: string;
  vehicle_model: string;
  registration_number: string;
  last_sync_date: Date | null;
  total_gps_points: number;
  sync_status: 'never' | 'syncing' | 'completed' | 'error';
  last_sync_error: string | null;
}

export interface SyncProgress {
  vehicleId: number;
  garageNumber: string;
  status: string;
  progress: number;
  currentStep?: string;
  totalRecords?: number;
  processedRecords?: number;
  startTime?: Date;
}

export interface WorkerStatus {
  workerId: number;
  vehicleId?: number;
  garageNumber?: string;
  status: string;
  progress: number;
  currentStep?: string;
  totalRecords?: number;
  processedRecords?: number;
  startTime?: Date;
}

export interface CopyConfig {
  insertMethod: 'batch' | 'copy' | 'auto';
  copyBatchSize?: number;
  fallbackToBatch?: boolean;
  estimatedSpeed?: number;
  recommendedMethod?: string;
}

class LegacySyncService {
  async getVehiclesWithSyncStatus(): Promise<VehicleWithSyncStatus[]> {
    const response = await api.get('/api/legacy-sync/vehicles');
    return response.data;
  }

  async startSync(vehicleIds: number[]): Promise<{ message: string; job_id: string }> {
    const response = await api.post('/api/legacy-sync/start', { vehicleIds });
    return response.data;
  }

  async getSyncProgress(jobId?: string): Promise<SyncProgress[]> {
    const params = jobId ? { job_id: jobId } : {};
    const response = await api.get('/api/legacy-sync/progress', { params });
    return response.data;
  }

  async stopSync(jobId: string): Promise<{ message: string }> {
    const response = await api.post('/api/legacy-sync/stop', { job_id: jobId });
    return response.data;
  }

  async getWorkerConfig(): Promise<any> {
    const response = await api.get('/api/legacy-sync/config');
    return response.data;
  }

  async toggleAggressiveDetection(enabled: boolean): Promise<{ message: string; enabled: boolean }> {
    const response = await api.post('/api/legacy-sync/config/aggressive-detection', { enabled });
    return response.data;
  }

  async testLegacyConnection(): Promise<{ connected: boolean; server: string; database: string; message?: string }> {
    const response = await api.get('/api/legacy-sync/test-connection');
    return response.data;
  }

  async getWorkerStatuses(): Promise<{ workers: WorkerStatus[]; activeCount: number; totalCount: number }> {
    const response = await api.get('/api/legacy-sync/worker-status');
    return response.data;
  }

  // COPY Configuration methods
  async getCopyConfig(): Promise<CopyConfig> {
    const response = await api.get('/api/legacy-sync/config/copy');
    return response.data;
  }

  async updateCopyConfig(config: Partial<CopyConfig>): Promise<CopyConfig> {
    const response = await api.patch('/api/legacy-sync/config/copy', config);
    return response.data;
  }
}

export default new LegacySyncService();