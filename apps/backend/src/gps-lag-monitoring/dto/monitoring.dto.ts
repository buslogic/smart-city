export interface ProcessingOverview {
  total_raw_points: number;
  total_vehicles: number;
  total_processed_points: number;
  processed_vehicles: number;
  total_outliers: number;
  processing_percentage: number;
  outlier_percentage: number;
  processing_lag: string;
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

export interface OutlierAnalysis {
  outlier_type: string;
  severity: string;
  total_count: number;
  vehicle_count: number;
  avg_speed_kmh: number;
  avg_distance_m: number;
}

export interface HourlyProcessingRate {
  processing_hour: string;
  batches_completed: number;
  total_rows_processed: number;
  total_outliers: number;
  avg_rows_per_batch: number;
  avg_seconds_per_batch: number;
  rows_per_second: number;
}

export interface ProcessingRecommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  message: string;
  action: string;
}
