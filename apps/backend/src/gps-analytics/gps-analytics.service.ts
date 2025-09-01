import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { VehicleAnalyticsDto, HourlyDataDto, SpeedDistributionDto, DailyStatsDto } from './dto/vehicle-analytics.dto';
import { createTimescalePool, testTimescaleConnection } from '../common/config/timescale.config';

@Injectable()
export class GpsAnalyticsService {
  private readonly logger = new Logger(GpsAnalyticsService.name);
  private pgPool: Pool;

  constructor() {
    // Koristi centralizovanu konfiguraciju za TimescaleDB
    this.pgPool = createTimescalePool();
    
    // Test connection - quiet initialization
    testTimescaleConnection(this.pgPool).then(success => {
      if (!success) {
        this.logger.error('❌ GpsAnalyticsService nije mogao da se poveže na TimescaleDB');
      }
    });
  }

  async getVehicleAnalytics(
    vehicleId: number,
    startDate: string,
    endDate: string,
  ): Promise<VehicleAnalyticsDto> {
    try {
      // Prvo proveri da li ima podataka
      const countQuery = `
        SELECT COUNT(*) as count 
        FROM gps_data 
        WHERE vehicle_id = $1 AND time BETWEEN $2 AND $3
      `;
      const countResult = await this.pgPool.query(countQuery, [vehicleId, startDate, endDate]);
      const totalPoints = parseInt(countResult.rows[0]?.count || '0');
      
      // Ako nema podataka, vrati prazan rezultat sa strukturom
      if (totalPoints === 0) {
        return {
          totalPoints: 0,
          totalDistance: 0,
          avgSpeed: 0,
          maxSpeed: 0,
          drivingHours: 0,
          idleTime: 0,
          totalStops: 0,
          efficiency: 0,
          hourlyData: [],
          speedDistribution: [
            { range: '0 km/h (mirovanje)', count: 0, percentage: 0 },
            { range: '1-20 km/h', count: 0, percentage: 0 },
            { range: '21-40 km/h', count: 0, percentage: 0 },
            { range: '41-60 km/h', count: 0, percentage: 0 },
            { range: '60+ km/h', count: 0, percentage: 0 },
          ],
          dailyStats: [],
        };
      }

      // Osnovne metrike
      const metricsQuery = `
        WITH vehicle_data AS (
          SELECT 
            COUNT(*) as total_points,
            AVG(speed) FILTER (WHERE speed > 0) as avg_speed,
            MAX(speed) as max_speed,
            MIN(time) as start_time,
            MAX(time) as end_time,
            COUNT(*) FILTER (WHERE speed = 0) as idle_points,
            COUNT(*) FILTER (WHERE speed > 0) as moving_points
          FROM gps_data
          WHERE vehicle_id = $1
            AND time BETWEEN $2 AND $3
        ),
        route_calculation AS (
          SELECT 
            COALESCE(
              ST_Length(
                ST_MakeLine(location ORDER BY time)::geography
              ) / 1000.0,
              0
            ) as total_distance
          FROM gps_data
          WHERE vehicle_id = $1
            AND time BETWEEN $2 AND $3
            AND speed > 0
        ),
        stop_detection AS (
          SELECT COUNT(*) as total_stops
          FROM (
            SELECT 
              time,
              speed,
              LAG(speed) OVER (ORDER BY time) as prev_speed
            FROM gps_data
            WHERE vehicle_id = $1
              AND time BETWEEN $2 AND $3
          ) t
          WHERE speed = 0 AND prev_speed > 0
        )
        SELECT 
          vd.total_points::INTEGER,
          COALESCE(rc.total_distance, 0)::NUMERIC(10,2) as total_distance,
          COALESCE(vd.avg_speed, 0)::NUMERIC(5,1) as avg_speed,
          COALESCE(vd.max_speed, 0)::INTEGER as max_speed,
          EXTRACT(EPOCH FROM (vd.end_time - vd.start_time)) / 3600.0 as total_hours,
          (vd.moving_points::NUMERIC / NULLIF(vd.total_points, 0) * 100)::NUMERIC(5,1) as efficiency,
          (vd.idle_points * 30.0 / 3600.0)::NUMERIC(5,1) as idle_time,
          COALESCE(sd.total_stops, 0)::INTEGER as total_stops
        FROM vehicle_data vd, route_calculation rc, stop_detection sd
      `;

      const metricsResult = await this.pgPool.query(metricsQuery, [
        vehicleId,
        startDate,
        endDate,
      ]);

      const metrics = metricsResult.rows[0] || {
        total_points: 0,
        total_distance: 0,
        avg_speed: 0,
        max_speed: 0,
        total_hours: 0,
        efficiency: 0,
        idle_time: 0,
        total_stops: 0,
      };

      // Podaci po satima
      const hourlyQuery = `
        SELECT 
          LPAD(EXTRACT(HOUR FROM time)::TEXT, 2, '0') as hour,
          COUNT(*) as points,
          COALESCE(AVG(speed) FILTER (WHERE speed > 0), 0)::NUMERIC(5,1) as avg_speed,
          COALESCE(
            ST_Length(
              ST_MakeLine(location ORDER BY time)::geography
            ) / 1000.0,
            0
          )::NUMERIC(10,2) as distance
        FROM gps_data
        WHERE vehicle_id = $1
          AND time BETWEEN $2 AND $3
        GROUP BY EXTRACT(HOUR FROM time)
        ORDER BY hour
      `;

      const hourlyResult = await this.pgPool.query(hourlyQuery, [
        vehicleId,
        startDate,
        endDate,
      ]);

      const hourlyData: HourlyDataDto[] = hourlyResult.rows.map(row => ({
        hour: row.hour,
        distance: parseFloat(row.distance),
        avgSpeed: parseFloat(row.avg_speed),
        points: parseInt(row.points),
      }));

      // Distribucija brzine
      const speedDistQuery = `
        WITH speed_ranges AS (
          SELECT 
            CASE 
              WHEN speed = 0 THEN '0 (mirovanje)'
              WHEN speed BETWEEN 1 AND 20 THEN '1-20 km/h'
              WHEN speed BETWEEN 21 AND 40 THEN '21-40 km/h'
              WHEN speed BETWEEN 41 AND 60 THEN '41-60 km/h'
              WHEN speed > 60 THEN '60+ km/h'
            END as range,
            COUNT(*) as count
          FROM gps_data
          WHERE vehicle_id = $1
            AND time BETWEEN $2 AND $3
          GROUP BY range
        ),
        total AS (
          SELECT SUM(count) as total_count FROM speed_ranges
        )
        SELECT 
          sr.range,
          sr.count::INTEGER,
          (sr.count * 100.0 / NULLIF(t.total_count, 0))::NUMERIC(5,1) as percentage
        FROM speed_ranges sr, total t
        ORDER BY 
          CASE sr.range
            WHEN '0 (mirovanje)' THEN 1
            WHEN '1-20 km/h' THEN 2
            WHEN '21-40 km/h' THEN 3
            WHEN '41-60 km/h' THEN 4
            WHEN '60+ km/h' THEN 5
          END
      `;

      const speedDistResult = await this.pgPool.query(speedDistQuery, [
        vehicleId,
        startDate,
        endDate,
      ]);

      const speedDistribution: SpeedDistributionDto[] = speedDistResult.rows.map(row => ({
        range: row.range,
        count: row.count,
        percentage: parseFloat(row.percentage),
      }));

      // Dnevna statistika (ako je period duži od jednog dana)
      const daysDiff = Math.ceil(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      let dailyStats: DailyStatsDto[] = [];

      if (daysDiff > 1) {
        const dailyQuery = `
          SELECT 
            DATE(time) as date,
            COUNT(*) FILTER (WHERE speed > 0) as moving_points,
            COALESCE(AVG(speed) FILTER (WHERE speed > 0), 0)::NUMERIC(5,1) as avg_speed,
            COALESCE(
              ST_Length(
                ST_MakeLine(location ORDER BY time)::geography
              ) / 1000.0,
              0
            )::NUMERIC(10,2) as distance
          FROM gps_data
          WHERE vehicle_id = $1
            AND time BETWEEN $2 AND $3
          GROUP BY DATE(time)
          ORDER BY date
        `;

        const dailyResult = await this.pgPool.query(dailyQuery, [
          vehicleId,
          startDate,
          endDate,
        ]);

        dailyStats = dailyResult.rows.map(row => ({
          date: row.date.toISOString().split('T')[0],
          distance: parseFloat(row.distance),
          drivingHours: (row.moving_points * 30 / 3600), // Procena na osnovu broja tačaka
          avgSpeed: parseFloat(row.avg_speed),
        }));
      }

      return {
        totalPoints: parseInt(metrics.total_points) || 0,
        totalDistance: parseFloat(metrics.total_distance) || 0,
        avgSpeed: parseFloat(metrics.avg_speed) || 0,
        maxSpeed: parseInt(metrics.max_speed) || 0,
        drivingHours: parseFloat(metrics.total_hours) || 0,
        idleTime: parseFloat(metrics.idle_time) || 0,
        totalStops: parseInt(metrics.total_stops) || 0,
        efficiency: parseFloat(metrics.efficiency) || 0,
        hourlyData,
        speedDistribution,
        dailyStats,
      };
    } catch (error) {
      this.logger.error(`Greška pri dohvatanju analitike: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pgPool.end();
  }
}