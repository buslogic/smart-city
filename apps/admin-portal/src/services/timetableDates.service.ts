import { api } from './api';

export interface TimetableDate {
  id: string; // BigInt iz backend-a dolazi kao string
  dateValidFrom: string;
  dateValidTo?: string | null;
  status: string;
  synchroStatus: string;
  sendIncremental: string;
  changedBy: string;
  dateTime: string;
  name: string;
  legacyTicketingId?: string | null;
  legacyCityId?: string | null;
}

export interface CreateTimetableDateDto {
  dateValidFrom: string;
  dateValidTo?: string;
  status?: string;
  synchroStatus?: string;
  sendIncremental?: string;
  changedBy: string;
  name: string;
}

export type UpdateTimetableDateDto = Partial<CreateTimetableDateDto>;

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
  message: string;
}

class TimetableDatesService {
  // ========== GLAVNI SERVER ==========

  async getAllMain(): Promise<TimetableDate[]> {
    const response = await api.get('/api/timetable-dates/main');
    return response.data;
  }

  async getOne(id: number): Promise<TimetableDate> {
    const response = await api.get(`/api/timetable-dates/main/${id}`);
    return response.data;
  }

  async create(data: CreateTimetableDateDto): Promise<TimetableDate> {
    const response = await api.post('/api/timetable-dates', data);
    return response.data;
  }

  async update(
    id: number,
    data: UpdateTimetableDateDto,
  ): Promise<TimetableDate> {
    const response = await api.patch(`/api/timetable-dates/${id}`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/api/timetable-dates/${id}`);
  }

  // ========== TIKETING SERVER (LEGACY) ==========

  async getAllTicketing(): Promise<any[]> {
    const response = await api.get('/api/timetable-dates/ticketing');
    return response.data;
  }

  async syncFromTicketing(): Promise<SyncResult> {
    const response = await api.post('/api/timetable-dates/sync-ticketing');
    return response.data;
  }

  // ========== GRADSKI SERVER (LEGACY) ==========

  async getAllCity(): Promise<any[]> {
    const response = await api.get('/api/timetable-dates/city');
    return response.data;
  }

  async syncFromCity(): Promise<SyncResult> {
    const response = await api.post('/api/timetable-dates/sync-city');
    return response.data;
  }
}

export const timetableDatesService = new TimetableDatesService();
