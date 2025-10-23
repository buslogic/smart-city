import axios from 'axios';
import { TokenManager } from '../utils/token';
import { API_URL } from '../config/runtime';

const BASE_URL = `${API_URL}/api/planning`;

export interface Line {
  id: string;
  lineNumberForDisplay: string;
  lineTitle: string;
  label: string;
  value: string;
}

export interface Turnus {
  turnusId: number;
  turnusIds: number[]; // Lista svih ID-eva za ovaj turnus (jer isti turnus može imati više ID-eva)
  turnusName: string;
  shifts: number[];
  label: string;
  value: number;
}

export interface Driver {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  label: string;
  value: number;
}

export interface Schedule {
  id: number;
  date: string;
  lineNumber: string;
  lineName: string;
  turnusId: number;
  turnusName: string;
  shiftNumber: number;
  turageNo: number;
  departureNoInTurage: number;
  turnusStartTime: any;
  turnusDuration: any;
  departuresCount: number;
  driverId: number;
  driverName: string;
  startTime?: any;
}

export interface CreateScheduleDto {
  date: string;
  lineNumber: string;
  turnusId: number;
  shiftNumber: number;
  driverId: number;
}

export interface CreateMonthlyScheduleDto {
  month: number;
  year: number;
  lineNumber: string;
  turnusName: string;
  shiftNumber: number;
  includedDaysOfWeek: number[];
  excludedDaysOfWeek: number[];
  driverId: number;
  conflictResolution?: 'skip' | 'overwrite';
  saturdayTurnusName?: string;
  sundayTurnusName?: string;
}

export interface MonthlyScheduleResult {
  totalDays: number;
  processedDays: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  results: Array<{
    date: string;
    status: 'success' | 'error';
    departuresCount?: number;
    error?: string;
  }>;
  summary?: {
    month: number;
    year: number;
    lineNumber: string;
    turnusName: string;
    shiftNumber: number;
    driverName: string;
    excludedDaysOfWeek: number[];
  };
  conflict?: {
    hasConflict: boolean;
    conflictDates: string[];
    conflictCount: number;
  };
  message?: string;
}

export interface TurageOption {
  value: string;  // turnus_name (npr. "00018-1", "00018-8")
  label: string;
}

export interface GetTurageOptionsParams {
  lineNumber: string;
  turnusName: string;
  shiftNumber: number;
  dayOfWeek: 'Subota' | 'Nedelja';
}

export interface DriverReport {
  driverId: number;
  driverName: string;
  workPlace: string; // Format: "5-18 I" (turaža-linija smena)
  freeDays: string;  // Format: "67" (subota i nedelja)
  maintenanceDate?: string;
}

class PlanningService {
  private getAuthHeaders() {
    const token = TokenManager.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getLines(): Promise<Line[]> {
    const response = await axios.get<Line[]>(`${BASE_URL}/lines`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getTurnusi(lineNumber: string, date: string): Promise<Turnus[]> {
    const response = await axios.get<Turnus[]>(`${BASE_URL}/turnusi`, {
      params: { lineNumber, date },
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getDrivers(): Promise<Driver[]> {
    const response = await axios.get<Driver[]>(`${BASE_URL}/drivers`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async createSchedule(data: CreateScheduleDto): Promise<Schedule> {
    const response = await axios.post<Schedule>(`${BASE_URL}/schedule`, data, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getSchedule(date: string): Promise<Schedule[]> {
    const response = await axios.get<Schedule[]>(`${BASE_URL}/schedule`, {
      params: { date },
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getMonthlySchedules(month: number, year: number, lineNumber: string): Promise<Schedule[]> {
    const response = await axios.get<Schedule[]>(`${BASE_URL}/schedule/monthly`, {
      params: { month, year, lineNumber },
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async deleteSchedule(id: number, startDate: string): Promise<{ success: boolean; message: string }> {
    const response = await axios.delete<{ success: boolean; message: string }>(
      `${BASE_URL}/schedule/${id}/${startDate}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async deleteMonthlySchedule(
    id: number,
    startDate: string,
    month: number,
    year: number,
    lineNumber: string,
    turnusName: string,
    shiftNumber: number
  ): Promise<{ success: boolean; message: string; deletedCount: number; daysDeleted: number }> {
    const response = await axios.delete<{
      success: boolean;
      message: string;
      deletedCount: number;
      daysDeleted: number;
    }>(`${BASE_URL}/schedule/monthly/${id}/${startDate}`, {
      params: {
        month,
        year,
        lineNumber,
        turnusName,
        shiftNumber,
      },
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getDriversAvailability(params: {
    date: string;
    lineNumber: string;
    turnusId: number;
    shiftNumber: number;
    onlyRecommended?: boolean;
  }): Promise<any> {
    const response = await axios.get(`${BASE_URL}/drivers-availability`, {
      params,
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getTurageOptions(params: GetTurageOptionsParams): Promise<TurageOption[]> {
    const response = await axios.get<TurageOption[]>(`${BASE_URL}/turage-options`, {
      params,
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async createMonthlySchedule(data: CreateMonthlyScheduleDto): Promise<MonthlyScheduleResult> {
    const response = await axios.post<MonthlyScheduleResult>(
      `${BASE_URL}/monthly-schedule`,
      data,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  /**
   * Kreiraj mesečni raspored sa real-time progress streaming preko SSE
   */
  createMonthlyScheduleStream(
    data: CreateMonthlyScheduleDto,
    onProgress: (data: any) => void,
    onComplete: (data: any) => void,
    onError: (error: any) => void,
  ): EventSource {
    const token = TokenManager.getAccessToken();

    // Konvertuj parametre u query string
    const params = new URLSearchParams({
      month: data.month.toString(),
      year: data.year.toString(),
      lineNumber: data.lineNumber,
      turnusName: data.turnusName,
      shiftNumber: data.shiftNumber.toString(),
      driverId: data.driverId.toString(),
      includedDaysOfWeek: JSON.stringify(data.includedDaysOfWeek),
      excludedDaysOfWeek: JSON.stringify(data.excludedDaysOfWeek),
    });

    if (data.conflictResolution) {
      params.append('conflictResolution', data.conflictResolution);
    }

    if (data.saturdayTurnusName) {
      params.append('saturdayTurnusName', data.saturdayTurnusName);
    }

    if (data.sundayTurnusName) {
      params.append('sundayTurnusName', data.sundayTurnusName);
    }

    const url = `${BASE_URL}/monthly-schedule-stream?${params.toString()}&token=${token}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'progress') {
          onProgress(data);
        } else if (data.type === 'complete') {
          onComplete(data);
          eventSource.close();
        } else if (data.type === 'conflict') {
          onComplete(data);
          eventSource.close();
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      onError(error);
      eventSource.close();
    };

    return eventSource;
  }

  /**
   * Dobavi mesečni izveštaj vozača
   */
  async getMonthlyDriverReport(month: number, year: number): Promise<DriverReport[]> {
    const response = await axios.get<DriverReport[]>(`${BASE_URL}/monthly-driver-report`, {
      params: { month, year },
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }
}

export const planningService = new PlanningService();
