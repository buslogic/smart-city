import { api } from './api';

export interface Driver {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  userGroup: {
    id: number;
    groupName: string;
  };
}

export interface DriverCard {
  driver: {
    id: number;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    userGroup: {
      id: number;
      groupName: string;
    };
    employedSince: string;
  };
  contactInfo: {
    address: string;
    phone1: string;
    phone2: string;
    employeeNumber: string;
  };
  workHistory: {
    years: string[];
    months: string[];
    data: Record<string, any>;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  message?: string;
}

class DispatcherService {
  /**
   * Dohvata listu vozača
   */
  async getDrivers(): Promise<ApiResponse<Driver[]>> {
    const response = await api.get('/api/dispatcher/drivers');
    return response.data;
  }

  /**
   * Dohvata podatke za karton vozača
   */
  async getDriverCard(driverId: number): Promise<ApiResponse<DriverCard>> {
    const response = await api.get(`/api/dispatcher/driver-card/${driverId}`);
    return response.data;
  }
}

export const dispatcherService = new DispatcherService();