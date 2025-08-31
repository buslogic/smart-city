import axios from 'axios';
import { TokenManager } from '../utils/token';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export interface DrivingEvent {
  id: number;
  time: string;
  vehicleId: number;
  garageNo: string;
  eventType: 'acceleration' | 'braking' | 'cornering';
  severity: 'normal' | 'moderate' | 'severe';
  accelerationValue: number;
  gForce: number;
  speedBefore: number;
  speedAfter: number;
  durationMs: number;
  distanceMeters: number;
  lat: number;
  lng: number;
  heading?: number;
  confidence: number;
}

export interface VehicleStatistics {
  totalEvents: number;
  severeAccelerations: number;
  moderateAccelerations: number;
  severeBrakings: number;
  moderateBrakings: number;
  avgGForce: number;
  maxGForce: number;
  totalDistanceKm: number;
  eventsPer100Km: number;
  mostCommonHour: number;
  safetyScore: number;
  startDate: string;
  endDate: string;
  vehicleId: number;
  garageNo: string;
}

export interface ChartDataPoint {
  time: string;
  acceleration: number;
  speed: number;
  eventType?: 'acceleration' | 'braking' | 'cornering';
  severity?: 'normal' | 'moderate' | 'severe';
  gForce?: number;
}

export interface ChartData {
  vehicleId: number;
  garageNo: string;
  startDate: string;
  endDate: string;
  dataPoints: ChartDataPoint[];
  totalPoints: number;
  eventCount: number;
}

export interface GetEventsParams {
  startDate?: string;
  endDate?: string;
  severity?: 'normal' | 'moderate' | 'severe';
  eventType?: 'acceleration' | 'braking' | 'cornering';
  page?: number;
  limit?: number;
}

class DrivingBehaviorService {
  private getAuthHeaders() {
    const token = TokenManager.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get driving events for a specific vehicle
   */
  async getVehicleEvents(
    vehicleId: number,
    params?: GetEventsParams
  ): Promise<{ events: DrivingEvent[]; total: number }> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/driving-behavior/vehicle/${vehicleId}/events`,
        {
          params,
          headers: this.getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching vehicle events:', error);
      throw error;
    }
  }

  /**
   * Get statistics for a specific vehicle
   */
  async getVehicleStatistics(
    vehicleId: number,
    startDate?: string,
    endDate?: string
  ): Promise<VehicleStatistics> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/driving-behavior/vehicle/${vehicleId}/statistics`,
        {
          params: { startDate, endDate },
          headers: this.getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching vehicle statistics:', error);
      throw error;
    }
  }

  /**
   * Get chart data for a specific vehicle
   */
  async getVehicleChartData(
    vehicleId: number,
    startDate?: string,
    endDate?: string
  ): Promise<ChartData> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/driving-behavior/vehicle/${vehicleId}/chart-data`,
        {
          params: { startDate, endDate },
          headers: this.getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching vehicle chart data:', error);
      throw error;
    }
  }

  /**
   * Helper to format date for API
   */
  formatDateForAPI(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Helper to get severity color
   */
  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'severe':
        return '#ff4d4f'; // red
      case 'moderate':
        return '#faad14'; // orange
      case 'normal':
        return '#52c41a'; // green
      default:
        return '#d9d9d9'; // gray
    }
  }

  /**
   * Helper to get event type icon
   */
  getEventTypeIcon(eventType: string): string {
    switch (eventType) {
      case 'acceleration':
        return '🚀';
      case 'braking':
        return '🛑';
      case 'cornering':
        return '🔄';
      default:
        return '⚠️';
    }
  }

  /**
   * Helper to format G-force display
   */
  formatGForce(gForce: number): string {
    return `${gForce.toFixed(2)}G`;
  }

  /**
   * Helper to get safety score color
   */
  getSafetyScoreColor(score: number): string {
    if (score >= 90) return '#52c41a'; // green - excellent
    if (score >= 75) return '#73d13d'; // light green - good
    if (score >= 60) return '#faad14'; // orange - average
    if (score >= 40) return '#fa8c16'; // dark orange - poor
    return '#ff4d4f'; // red - critical
  }

  /**
   * Helper to get safety score label
   */
  getSafetyScoreLabel(score: number): string {
    if (score >= 90) return 'Odličan';
    if (score >= 75) return 'Dobar';
    if (score >= 60) return 'Prosečan';
    if (score >= 40) return 'Loš';
    return 'Kritičan';
  }
}

export const drivingBehaviorService = new DrivingBehaviorService();