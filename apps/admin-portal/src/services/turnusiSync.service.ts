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

// Legacy baza (snake_case)
export interface TurnusGroupLegacy {
  group_id: number;
  group_name: string;
}

export interface TurnusAssignLegacy {
  turnus_id: number;
  group_id: number;
  changed_by: number;
  change_date: string;
  date_from: string;
  date_to: string;
}

export interface TurnusDayLegacy {
  id: number;
  turnus_id: number;
  dayname: string;
}

// Naša baza (camelCase - Prisma)
export interface TurnusGroup {
  id: number;
  name: string;
  active: boolean;
  changedBy: number;
  changeDate: string;
  dateValidFrom: string;
}

export interface TurnusAssign {
  turnusId: number;
  groupId: number;
  changedBy: number;
  changeDate: string;
  dateFrom: string;
  dateTo: string;
}

export interface TurnusDay {
  id: number;
  turnusId: number;
  dayname: string;
}

class TurnusiSyncService {
  // ========== TIKETING SERVER (READ-ONLY) ==========

  async getAllGroupsTicketing(): Promise<TurnusGroupLegacy[]> {
    const response = await api.get('/api/turnusi-sync/ticketing/groups');
    return response.data;
  }

  async getAllAssignTicketing(
    groupId?: number,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<TurnusAssignLegacy>> {
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
  ): Promise<PaginatedResponse<TurnusDayLegacy>> {
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

  // ========== GLAVNI SERVER (NAŠA BAZA) ==========

  async getAllGroupsMain(
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<TurnusGroup>> {
    const response = await api.get('/api/turnusi-sync/main/groups', {
      params: { page, limit },
    });
    return response.data;
  }

  async getAllAssignMain(
    groupId?: number,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<TurnusAssign>> {
    const params: any = { page, limit };
    if (groupId) {
      params.groupId = groupId;
    }
    const response = await api.get('/api/turnusi-sync/main/assign', {
      params,
    });
    return response.data;
  }

  async getAllDaysMain(
    groupId?: number,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<TurnusDay>> {
    const params: any = { page, limit };
    if (groupId) {
      params.groupId = groupId;
    }
    const response = await api.get('/api/turnusi-sync/main/days', {
      params,
    });
    return response.data;
  }
}

export const turnusiSyncService = new TurnusiSyncService();
