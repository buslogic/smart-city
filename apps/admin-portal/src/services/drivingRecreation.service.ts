import axios from 'axios';
import { TokenManager } from '../utils/token';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export interface VehicleWithStats {
  id: number;
  garageNo: string;
  registration: string;
  status: 'active' | 'inactive';
  gpsPoints: number;
  existingEvents: number;
}

export interface StartRecreationParams {
  vehicleIds: number[];
  startDate: string;
  endDate: string;
  clearExisting?: boolean;
  strategy?: 'daily' | 'bulk';
  notifyOnComplete?: boolean;
}

export interface VehicleProgress {
  id: number;
  garageNo: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  eventsDetected?: number;
  eventsBefore?: number;
  error?: string;
  processingTime?: number;
}

export interface RecreationStatus {
  id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalVehicles: number;
  processedVehicles: number;
  currentVehicle?: {
    id: number;
    garageNo: string;
    progress: number;
    eventsDetected: number;
  };
  vehicles: VehicleProgress[];
  startedAt: string;
  estimatedCompletion?: string;
  totalEventsDetected: number;
  totalEventsBefore: number;
}

export interface RecreationHistory {
  id: number;
  userId: number;
  userEmail: string;
  vehicleIds: number[];
  startDate: string;
  endDate: string;
  totalVehicles: number;
  processedVehicles: number;
  totalEventsDetected: number;
  totalEventsBefore: number;
  status: string;
  strategy: string;
  clearExisting: boolean;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface PreviewResult {
  vehicleId: number;
  garageNo: string;
  existingEvents: number;
  estimatedNew: number;
}

class DrivingRecreationService {
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
    };
  }

  async getVehiclesWithStats(startDate: string, endDate: string, loadStats: boolean = false): Promise<VehicleWithStats[]> {
    try {
      const response = await axios.get(
        `${API_URL}/api/driving-recreation/vehicles`,
        {
          params: { startDate, endDate, loadStats },
          headers: this.getHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching vehicles with stats:', error);
      throw error;
    }
  }

  async startRecreation(params: StartRecreationParams): Promise<{ id: number; message: string }> {
    try {
      const response = await axios.post(
        `${API_URL}/api/driving-recreation/start`,
        params,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error starting recreation:', error);
      throw error;
    }
  }

  async getRecreationStatus(id: number): Promise<RecreationStatus> {
    try {
      const response = await axios.get(
        `${API_URL}/api/driving-recreation/status/${id}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching recreation status:', error);
      throw error;
    }
  }

  async stopRecreation(id: number): Promise<{ message: string }> {
    try {
      const response = await axios.delete(
        `${API_URL}/api/driving-recreation/stop/${id}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error stopping recreation:', error);
      throw error;
    }
  }

  async getRecreationHistory(
    userId?: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: RecreationHistory[]; total: number }> {
    try {
      const response = await axios.get(
        `${API_URL}/api/driving-recreation/history`,
        {
          params: { userId, page, limit },
          headers: this.getHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching recreation history:', error);
      throw error;
    }
  }

  async previewEventsCount(
    vehicleIds: number[],
    startDate: string,
    endDate: string
  ): Promise<PreviewResult[]> {
    try {
      const response = await axios.post(
        `${API_URL}/api/driving-recreation/preview`,
        { vehicleIds, startDate, endDate },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error previewing events count:', error);
      throw error;
    }
  }

  // Helper method to poll status
  async pollStatus(
    id: number,
    onUpdate: (status: RecreationStatus) => void,
    interval: number = 2000
  ): Promise<() => void> {
    const intervalId = setInterval(async () => {
      try {
        const status = await this.getRecreationStatus(id);
        onUpdate(status);
        
        // Stop polling if completed or failed
        if (['completed', 'failed', 'cancelled'].includes(status.status)) {
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    }, interval);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }
}

export const drivingRecreationService = new DrivingRecreationService();