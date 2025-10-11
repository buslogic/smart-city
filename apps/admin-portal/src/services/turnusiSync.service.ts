import { api } from './api';

export interface SyncResultDetail {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
}

export interface TurnusiSyncResult {
  success: boolean;
  turnusGroupsNames: SyncResultDetail;
  turnusGroupsAssign: SyncResultDetail;
  turnusDays: SyncResultDetail;
  totalProcessed: number;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TurnusGroup {
  group_id: number;
  group_name: string;
}

export interface TurnusAssign {
  turnus_id: number;
  group_id: number;
  changed_by: number;
  change_date: string;
  date_from: string;
  date_to: string;
}

export interface TurnusDay {
  id: number;
  turnus_id: number;
  dayname: string;
}

class TurnusiSyncService {
  // ========== TIKETING SERVER (READ-ONLY) ==========

  async getAllGroupsTicketing(): Promise<TurnusGroup[]> {
    const response = await api.get('/api/turnusi-sync/ticketing/groups');
    return response.data;
  }

  async getAllAssignTicketing(
    groupId?: number,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<TurnusAssign>> {
    const params: any = { page, limit };
    if (groupId) {
      params.groupId = groupId;
    }
    const response = await api.get('/api/turnusi-sync/ticketing/assign', {
      params,
    });
    return response.data;
  }

  async getAllDaysTicketing(
    groupId?: number,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<TurnusDay>> {
    const params: any = { page, limit };
    if (groupId) {
      params.groupId = groupId;
    }
    const response = await api.get('/api/turnusi-sync/ticketing/days', {
      params,
    });
    return response.data;
  }

  async syncFromTicketing(): Promise<TurnusiSyncResult> {
    const response = await api.post('/api/turnusi-sync/sync-ticketing');
    return response.data;
  }
}

export const turnusiSyncService = new TurnusiSyncService();
