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

  async deleteSchedule(id: number, startDate: string): Promise<{ success: boolean; message: string }> {
    const response = await axios.delete<{ success: boolean; message: string }>(
      `${BASE_URL}/schedule/${id}/${startDate}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
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
}

export const planningService = new PlanningService();
