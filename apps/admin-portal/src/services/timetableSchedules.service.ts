import { api } from './api';

export interface SyncResultDetail {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
}

export interface TimetableSchedulesSyncResult {
  success: boolean;
  vremenaPolaska: SyncResultDetail;
  vremenaPolaskaSt: SyncResultDetail;
  totalProcessed: number;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface MainScheduleLine {
  priceTableIdent: string;
  lineNumber: string;
  lineNumberForDisplay: string;
  lineTitle: string;
  direction: string;
  lineType: string;
  totalSchedules: number;
  hasTicketingData: boolean;
  hasCityData: boolean;
  legacyTicketingCount: number;
  legacyCityCount: number;
}

export interface MainSchedulesResponse {
  data: MainScheduleLine[];
  total: number;
}

class TimetableSchedulesService {
  // ========== GLAVNI SERVER (LOKALNI MYSQL) ==========

  async getAllMain(dateValidFrom?: string): Promise<MainSchedulesResponse> {
    const params: any = {};
    if (dateValidFrom) {
      params.dateValidFrom = dateValidFrom;
    }
    const response = await api.get('/api/timetable-schedules/main', { params });
    return response.data;
  }

  // ========== TIKETING SERVER ==========

  async getAllVremenaPolaskaTicketing(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<any>> {
    const params: any = { page, limit };
    if (dateValidFrom) {
      params.dateValidFrom = dateValidFrom;
    }
    const response = await api.get(
      '/api/timetable-schedules/ticketing/vremena-polaska',
      { params },
    );
    return response.data;
  }

  async getAllVremenaPolaskaStTicketing(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<any>> {
    const params: any = { page, limit };
    if (dateValidFrom) {
      params.dateValidFrom = dateValidFrom;
    }
    const response = await api.get(
      '/api/timetable-schedules/ticketing/vremena-polaska-st',
      { params },
    );
    return response.data;
  }

  async syncFromTicketing(
    dateValidFrom: string,
  ): Promise<TimetableSchedulesSyncResult> {
    const response = await api.post(
      '/api/timetable-schedules/sync-ticketing',
      { dateValidFrom },
    );
    return response.data;
  }

  // ========== GRADSKI SERVER ==========

  async getAllVremenaPolaskaCity(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<any>> {
    const params: any = { page, limit };
    if (dateValidFrom) {
      params.dateValidFrom = dateValidFrom;
    }
    const response = await api.get(
      '/api/timetable-schedules/city/vremena-polaska',
      { params },
    );
    return response.data;
  }

  async getAllVremenaPolaskaStCity(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<any>> {
    const params: any = { page, limit };
    if (dateValidFrom) {
      params.dateValidFrom = dateValidFrom;
    }
    const response = await api.get(
      '/api/timetable-schedules/city/vremena-polaska-st',
      { params },
    );
    return response.data;
  }

  async syncFromCity(
    dateValidFrom: string,
  ): Promise<TimetableSchedulesSyncResult> {
    const response = await api.post('/api/timetable-schedules/sync-city', {
      dateValidFrom,
    });
    return response.data;
  }
}

export const timetableSchedulesService = new TimetableSchedulesService();
