import { api } from './api';

export interface SyncResultDetail {
  upserted: number; // Created + Updated (UPSERT approach)
  skipped: number;
  errors: number;
  totalProcessed: number;
}

export interface TurnusSyncLog {
  id: number;
  syncId: string;
  groupId: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'abandoned';
  totalRecords: number;
  processedRecords: number;
  upsertedRecords: number;
  errorRecords: number;
  lastProcessedTurnusId: number | null;
  lastProcessedBatch: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TurnusGroup {
  id: number;
  name: string;
  active: boolean;
  changed_by: number;
  change_date: string;
  date_valid_from: string;
}

// Legacy baza (snake_case)
export interface ChangesCodeTour {
  id: number;
  turnus_id: number;
  turnus_name: string;
  line_no: string;
  start_time: string;
  direction: number;
  duration: string;
  central_point: string;
  change_code: number;
  job_id: number;
  new_start_time: string;
  new_duration: string;
  start_station: number;
  end_station: number;
  day_number: number;
  line_type_id: number;
  rezijski: string;
  print_id: string;
  between_rez: number;
  bus_number: number;
  start_station_id: number;
  end_station_id: number;
  change_time: string;
  change_user: string;
  active: number;
  first_day_duration_part: string;
  second_day_duration_part: string;
  custom_id: string;
  transport_id: string;
  departure_number: number;
  shift_number: number;
  turage_no: number;
  departure_no_in_turage: number;
}

// Naša baza (camelCase - Prisma)
export interface ChangesCodeTourMain {
  id: number;
  turnusId: number;
  turnusName: string;
  lineNo: string;
  startTime: string;
  direction: number;
  duration: string;
  centralPoint: string;
  changeCode: number;
  jobId: number;
  newStartTime: string;
  newDuration: string;
  startStation: number;
  endStation: number;
  dayNumber: number;
  lineTypeId: number;
  rezijski: string;
  printId: string;
  betweenRez: number;
  busNumber: number;
  startStationId: number;
  endStationId: number;
  changeTime: string;
  changeUser: string;
  active: number;
  firstDayDurationPart: string;
  secondDayDurationPart: string;
  customId: string;
  transportId: string;
  departureNumber: number;
  shiftNumber: number;
  turageNo: number;
  departureNoInTurage: number;
}

class TurnusiService {
  // ========== TIKETING SERVER (READ-ONLY) ==========

  async getAllGroupsTicketing(): Promise<TurnusGroup[]> {
    const response = await api.get('/api/turnusi/ticketing/groups');
    return response.data;
  }

  async getAllChangesCodesTicketing(
    groupId?: number,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<ChangesCodeTour>> {
    const params: any = { page, limit };
    if (groupId) {
      params.groupId = groupId;
    }
    const response = await api.get('/api/turnusi/ticketing/changes-codes', {
      params,
    });
    return response.data;
  }

  async syncFromTicketing(groupId: number): Promise<SyncResultDetail> {
    const response = await api.post('/api/turnusi/sync-ticketing', {
      groupId,
    });
    return response.data;
  }

  /**
   * Start sync asynchronously and get syncId immediately for real-time tracking
   */
  async syncFromTicketingAsync(
    groupId: number,
  ): Promise<{ syncId: string; message: string }> {
    const response = await api.post('/api/turnusi/sync-ticketing-async', {
      groupId,
    });
    return response.data;
  }

  // ========== CITY SERVER (READ-ONLY) ==========

  async getAllGroupsCity(): Promise<TurnusGroup[]> {
    const response = await api.get('/api/turnusi/city/groups');
    return response.data;
  }

  async getAllChangesCodesCity(
    groupId?: number,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<ChangesCodeTour>> {
    const params: any = { page, limit };
    if (groupId) {
      params.groupId = groupId;
    }
    const response = await api.get('/api/turnusi/city/changes-codes', {
      params,
    });
    return response.data;
  }

  async syncFromCity(groupId: number): Promise<SyncResultDetail> {
    const response = await api.post('/api/turnusi/sync-city', {
      groupId,
    });
    return response.data;
  }

  /**
   * Start sync asynchronously and get syncId immediately for real-time tracking
   */
  async syncFromCityAsync(
    groupId: number,
  ): Promise<{ syncId: string; message: string }> {
    const response = await api.post('/api/turnusi/sync-city-async', {
      groupId,
    });
    return response.data;
  }

  // ========== GLAVNI SERVER (NAŠA BAZA) ==========

  async getAllChangesCodesMain(
    groupId?: number,
    lineNumber?: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<ChangesCodeTourMain>> {
    const params: any = { page, limit };
    if (groupId) {
      params.groupId = groupId;
    }
    if (lineNumber) {
      params.lineNumber = lineNumber;
    }
    const response = await api.get('/api/turnusi/main/changes-codes', {
      params,
    });
    return response.data;
  }

  // ========== SYNC PROGRESS TRACKING ==========

  /**
   * Get sync status by syncId for real-time progress monitoring
   */
  async getSyncStatus(syncId: string): Promise<TurnusSyncLog> {
    const response = await api.get(`/api/turnusi/sync-status/${syncId}`);
    return response.data;
  }

  /**
   * Get last incomplete sync for a group (if exists)
   */
  async getIncompleteSyncForGroup(
    groupId: number,
  ): Promise<TurnusSyncLog | null> {
    const response = await api.get(
      `/api/turnusi/sync-status/group/${groupId}/incomplete`,
    );
    return response.data;
  }
}

export const turnusiService = new TurnusiService();
