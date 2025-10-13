import { api } from './api';

export interface SyncResultDetail {
  deleted: number;
  created: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
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
}

export const turnusiService = new TurnusiService();
