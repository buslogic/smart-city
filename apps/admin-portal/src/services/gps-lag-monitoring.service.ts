import { api } from './api';

export interface ProcessingOverview {
  total_raw_points: number;
  total_vehicles: number;
  total_processed_points: number;
  processed_vehicles: number;
  total_outliers: number;
  processing_percentage: number;
  outlier_percentage: number;
  processing_lag: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | string;
  completed_batches: number;
  failed_batches: number;
  active_batches: number;
}

export interface HealthCheck {
  check_name: string;
  status: 'OK' | 'WARNING' | 'CRITICAL';
  message: string;
}

export interface VehicleProgress {
  vehicle_id: number;
  garage_no: string;
  progress_percentage: number;
  processed_points: number;
  remaining_points: number;
  outlier_percentage: number;
}

export interface DashboardData {
  overview: ProcessingOverview;
  healthChecks: HealthCheck[];
  vehicleProgress: VehicleProgress[];
  outlierAnalysis: any[];
  hourlyRate: any[];
  recommendations: any[];
}

export const GpsLagMonitoringService = {
  async getDashboard(): Promise<DashboardData> {
    const response = await api.get('/api/gps-lag-monitoring/dashboard');
    return response.data;
  },

  async getOverview(): Promise<ProcessingOverview> {
    const response = await api.get('/api/gps-lag-monitoring/overview');
    return response.data;
  },

  async getHealthChecks(): Promise<HealthCheck[]> {
    const response = await api.get('/api/gps-lag-monitoring/health-checks');
    return response.data;
  },

  async getVehicleProgress(limit: number = 10): Promise<VehicleProgress[]> {
    const response = await api.get(`/api/gps-lag-monitoring/vehicle-progress?limit=${limit}`);
    return response.data;
  },
};
