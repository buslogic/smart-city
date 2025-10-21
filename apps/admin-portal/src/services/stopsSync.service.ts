import { api } from './api';

export interface Stop {
  uniqueId: string;
  stationName: string;
  gpsx: number;
  gpsy: number;
  description: string;
  range: number;
  rangeForDriverConsole: number;
  rangeForValidators: number;
  changed: boolean;
  mainOperator: boolean;
  groupId: number;
  readyForBooking: number;
  usedInBooking: number;
  dateValidFrom?: Date | null;
}

export interface SyncResponse {
  message: string;
  inserted: number;
  updated: number;
  deleted: number;
  total: number;
  duration: number;
}

class StopsSyncService {
  // ========== GLAVNI SERVER ==========
  async getAllMain(): Promise<Stop[]> {
    const response = await api.get('/api/stops-sync/main');
    return response.data;
  }

  // ========== TIKETING SERVER ==========
  async getAllTicketing(): Promise<Stop[]> {
    const response = await api.get('/api/stops-sync/ticketing');
    return response.data;
  }

  async syncFromTicketing(): Promise<SyncResponse> {
    const response = await api.post('/api/stops-sync/ticketing/sync');
    return response.data;
  }

  // ========== GRADSKI SERVER ==========
  async getAllCity(): Promise<Stop[]> {
    const response = await api.get('/api/stops-sync/city');
    return response.data;
  }

  async syncFromCity(): Promise<SyncResponse> {
    const response = await api.post('/api/stops-sync/city/sync');
    return response.data;
  }
}

export const stopsSyncService = new StopsSyncService();
