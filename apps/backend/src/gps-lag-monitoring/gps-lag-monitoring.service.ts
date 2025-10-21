import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'pg';
import {
  ProcessingOverview,
  HealthCheck,
  VehicleProgress,
  OutlierAnalysis,
  HourlyProcessingRate,
  ProcessingRecommendation,
} from './dto/monitoring.dto';

@Injectable()
export class GpsLagMonitoringService {
  private readonly logger = new Logger(GpsLagMonitoringService.name);

  private getClient(): Client {
    return new Client({
      connectionString:
        process.env.TIMESCALE_DATABASE_URL ||
        'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable',
    });
  }

  async getProcessingOverview(): Promise<ProcessingOverview> {
    const client = this.getClient();

    try {
      await client.connect();
      const result = await client.query<ProcessingOverview>('SELECT * FROM v_processing_overview');

      if (result.rows.length === 0) {
        // Return default values if no data
        return {
          total_raw_points: 0,
          total_vehicles: 0,
          total_processed_points: 0,
          processed_vehicles: 0,
          total_outliers: 0,
          processing_percentage: 0,
          outlier_percentage: 0,
          processing_lag: '0',
          completed_batches: 0,
          failed_batches: 0,
          active_batches: 0,
        };
      }

      return result.rows[0];
    } catch (error) {
      this.logger.error('Error fetching processing overview', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async getHealthChecks(): Promise<HealthCheck[]> {
    const client = this.getClient();

    try {
      await client.connect();
      const result = await client.query<HealthCheck>('SELECT * FROM get_health_check()');
      return result.rows;
    } catch (error) {
      this.logger.error('Error fetching health checks', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async getVehicleProgress(limit: number = 10): Promise<VehicleProgress[]> {
    const client = this.getClient();

    try {
      await client.connect();
      const result = await client.query<VehicleProgress>(
        'SELECT * FROM v_vehicle_processing_progress ORDER BY progress_percentage ASC LIMIT $1',
        [limit],
      );
      return result.rows;
    } catch (error) {
      this.logger.error('Error fetching vehicle progress', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async getOutlierAnalysis(limit: number = 5): Promise<OutlierAnalysis[]> {
    const client = this.getClient();

    try {
      await client.connect();
      const result = await client.query<OutlierAnalysis>(
        'SELECT * FROM v_outlier_analysis ORDER BY total_count DESC LIMIT $1',
        [limit],
      );
      return result.rows;
    } catch (error) {
      this.logger.error('Error fetching outlier analysis', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async getHourlyProcessingRate(): Promise<HourlyProcessingRate[]> {
    const client = this.getClient();

    try {
      await client.connect();
      const result = await client.query<HourlyProcessingRate>(
        'SELECT * FROM v_hourly_processing_rate ORDER BY processing_hour DESC',
      );
      return result.rows;
    } catch (error) {
      this.logger.error('Error fetching hourly processing rate', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async getRecommendations(): Promise<ProcessingRecommendation[]> {
    const client = this.getClient();

    try {
      await client.connect();
      const result = await client.query<ProcessingRecommendation>(
        'SELECT * FROM get_processing_recommendations()',
      );
      return result.rows;
    } catch (error) {
      this.logger.error('Error fetching recommendations', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async getDashboardData() {
    try {
      const [overview, healthChecks, vehicleProgress, outlierAnalysis, hourlyRate, recommendations] =
        await Promise.all([
          this.getProcessingOverview(),
          this.getHealthChecks(),
          this.getVehicleProgress(10),
          this.getOutlierAnalysis(5),
          this.getHourlyProcessingRate(),
          this.getRecommendations(),
        ]);

      return {
        overview,
        healthChecks,
        vehicleProgress,
        outlierAnalysis,
        hourlyRate,
        recommendations,
      };
    } catch (error) {
      this.logger.error('Error fetching dashboard data', error);
      throw error;
    }
  }
}
