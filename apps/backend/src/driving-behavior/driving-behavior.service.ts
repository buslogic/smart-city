import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { createTimescalePool, testTimescaleConnection } from '../common/config/timescale.config';
import {
  DrivingEventDto,
  GetEventsQueryDto,
  VehicleStatisticsDto,
  ChartDataDto,
  ChartDataPointDto,
  EventType,
  SeverityLevel,
} from './dto/driving-events.dto';

@Injectable()
export class DrivingBehaviorService {
  private readonly logger = new Logger(DrivingBehaviorService.name);
  private pgPool: Pool;

  constructor() {
    // Initialize TimescaleDB connection pool using centralized config
    this.pgPool = createTimescalePool();
    
    // Test connection
    testTimescaleConnection(this.pgPool).then(success => {
      if (success) {
        this.logger.log('✅ DrivingBehaviorService povezan na TimescaleDB');
      } else {
        this.logger.error('❌ DrivingBehaviorService - neuspešna konekcija na TimescaleDB');
      }
    });
  }

  /**
   * Get driving events for a specific vehicle
   */
  async getVehicleEvents(
    vehicleId: number,
    query: GetEventsQueryDto,
  ): Promise<{ events: DrivingEventDto[]; total: number }> {
    try {
      const { startDate, endDate, severity, eventType, page = 1, limit = 50 } = query;
      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions: string[] = ['vehicle_id = $1'];
      const params: any[] = [vehicleId];
      let paramIndex = 2;

      if (startDate) {
        conditions.push(`time >= $${paramIndex}::date`);
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        conditions.push(`time <= $${paramIndex}::date + interval '1 day'`);
        params.push(endDate);
        paramIndex++;
      }

      if (severity) {
        conditions.push(`severity = $${paramIndex}`);
        params.push(severity);
        paramIndex++;
      }

      if (eventType) {
        conditions.push(`event_type = $${paramIndex}`);
        params.push(eventType);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM driving_events 
        WHERE ${whereClause}
      `;
      const countResult = await this.pgPool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated events
      const eventsQuery = `
        SELECT 
          id,
          time,
          vehicle_id as "vehicleId",
          garage_no as "garageNo",
          event_type as "eventType",
          severity,
          acceleration_value as "accelerationValue",
          g_force as "gForce",
          speed_before as "speedBefore",
          speed_after as "speedAfter",
          duration_ms as "durationMs",
          distance_meters as "distanceMeters",
          lat,
          lng,
          heading,
          confidence
        FROM driving_events
        WHERE ${whereClause}
        ORDER BY time DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const eventsResult = await this.pgPool.query(eventsQuery, params);

      return {
        events: eventsResult.rows,
        total,
      };
    } catch (error) {
      this.logger.error(`Error fetching vehicle events: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get statistics for a specific vehicle
   */
  async getVehicleStatistics(
    vehicleId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<VehicleStatisticsDto> {
    try {
      // Default date range: last 30 days
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      // Call the PostGIS function
      const statsQuery = `
        SELECT * FROM get_vehicle_driving_statistics($1, $2::date, $3::date)
      `;
      
      this.logger.log(`Getting statistics for vehicle ${vehicleId} from ${start} to ${end}`);
      const statsResult = await this.pgPool.query(statsQuery, [vehicleId, start, end]);
      
      if (statsResult.rows.length > 0) {
        this.logger.log(`Statistics result:`, statsResult.rows[0]);
      }

      if (!statsResult.rows.length) {
        // No statistics available, return zeros
        return this.getEmptyStatistics(vehicleId, start, end);
      }

      const stats = statsResult.rows[0];

      // Get garage number
      const garageQuery = `
        SELECT DISTINCT garage_no 
        FROM gps_data 
        WHERE vehicle_id = $1 
        LIMIT 1
      `;
      const garageResult = await this.pgPool.query(garageQuery, [vehicleId]);
      const garageNo = garageResult.rows[0]?.garage_no || `V${vehicleId}`;

      return {
        totalEvents: stats.total_events || 0,
        severeAccelerations: stats.severe_accelerations || 0,
        moderateAccelerations: stats.moderate_accelerations || 0,
        severeBrakings: stats.severe_brakings || 0,
        moderateBrakings: stats.moderate_brakings || 0,
        avgGForce: parseFloat(stats.avg_g_force) || 0,
        maxGForce: parseFloat(stats.max_g_force) || 0,
        totalDistanceKm: parseFloat(stats.total_distance_km) || 0,
        eventsPer100Km: parseFloat(stats.events_per_100km) || 0,
        mostCommonHour: stats.most_common_hour || 0,
        safetyScore: stats.safety_score || 100,
        startDate: start,
        endDate: end,
        vehicleId,
        garageNo,
      };
    } catch (error) {
      this.logger.error(`Error fetching vehicle statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get chart data for a specific vehicle
   */
  async getVehicleChartData(
    vehicleId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<ChartDataDto> {
    try {
      // Default date range: last 7 days for chart
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      // Get events for chart
      const eventsQuery = `
        SELECT 
          time,
          acceleration_value as acceleration,
          speed_after as speed,
          event_type as "eventType",
          severity,
          g_force as "gForce"
        FROM driving_events
        WHERE vehicle_id = $1
          AND time >= $2::date
          AND time <= $3::date + interval '1 day'
        ORDER BY time ASC
      `;

      const eventsResult = await this.pgPool.query(eventsQuery, [vehicleId, start, end]);

      // Calculate period length for smart sampling
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      const periodDays = Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)));
      
      // Determine sampling interval - for 1 day we need to sample more aggressively
      // GPS data every 3 seconds = 28,800 points per day
      // We want max 5000 points for good performance
      let samplingInterval = 1;
      if (periodDays <= 1) {
        samplingInterval = 6; // Every 6th point (every 18 seconds) for 1 day
      } else if (periodDays <= 3) {
        samplingInterval = 20; // Every 20th point (every minute) for 2-3 days
      } else if (periodDays <= 7) {
        samplingInterval = 40; // Every 40th point (every 2 minutes) for week
      } else {
        samplingInterval = 120; // Every 120th point (every 6 minutes) for month
      }

      this.logger.log(`Chart data: Period ${periodDays} days, sampling every ${samplingInterval} points`);

      // Get GPS data points for continuous line with smart sampling
      // Also include all times where we have events
      const gpsQuery = `
        WITH event_times AS (
          SELECT DISTINCT time 
          FROM driving_events 
          WHERE vehicle_id = $1
            AND time >= $2::date
            AND time <= ($3::date + interval '1 day')
        ),
        speed_calc AS (
          SELECT 
            time,
            speed,
            LAG(speed) OVER (ORDER BY time) as prev_speed,
            EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as time_diff,
            ROW_NUMBER() OVER (ORDER BY time) as row_num,
            EXISTS(SELECT 1 FROM event_times et WHERE et.time = gps_data.time) as has_event
          FROM gps_data
          WHERE vehicle_id = $1
            AND time >= $2::date
            AND time <= ($3::date + interval '1 day')
            AND speed IS NOT NULL
          ORDER BY time
        )
        SELECT 
          time,
          speed,
          CASE 
            WHEN time_diff > 0 AND time_diff < 60 THEN
              ((speed * 0.27778) - (prev_speed * 0.27778)) / time_diff
            ELSE 0
          END as acceleration
        FROM speed_calc
        WHERE time_diff IS NOT NULL
          AND (MOD(row_num, $4) = 0 OR has_event = true)  -- Include sampled points OR event points
        ORDER BY time
        LIMIT 5000
      `;

      const gpsResult = await this.pgPool.query(gpsQuery, [vehicleId, start, end, samplingInterval]);

      // Log events for debugging
      this.logger.log(`Found ${eventsResult.rows.length} driving events for vehicle ${vehicleId}`);
      if (eventsResult.rows.length > 0) {
        this.logger.log(`Event severities: ${eventsResult.rows.map(e => e.severity).join(', ')}`);
      }

      // Create a map of events by rounded time (to nearest second) for easier merging
      const eventsMap = new Map<string, any>();
      eventsResult.rows.forEach(event => {
        // Round to nearest second for matching
        const eventTime = new Date(event.time);
        eventTime.setMilliseconds(0);
        const timeKey = eventTime.toISOString();
        eventsMap.set(timeKey, {
          eventType: event.eventType,
          severity: event.severity,
          gForce: parseFloat(event.gForce),
          originalTime: event.time,
        });
        this.logger.log(`Event at ${timeKey}: ${event.eventType} - ${event.severity}`);
      });

      // Merge GPS data with events
      const dataPoints: ChartDataPointDto[] = [];
      
      // Add GPS points
      gpsResult.rows.forEach(row => {
        // Round GPS time to nearest second for matching
        const gpsTime = new Date(row.time);
        gpsTime.setMilliseconds(0);
        const timeKey = gpsTime.toISOString();
        
        const point: ChartDataPointDto = {
          time: row.time.toISOString(), // Keep original time for display
          acceleration: parseFloat(row.acceleration) || 0,
          speed: row.speed || 0,
        };
        
        // Check if there's an event at this time (rounded to second)
        if (eventsMap.has(timeKey)) {
          const event = eventsMap.get(timeKey);
          point.eventType = event.eventType;
          point.severity = event.severity;
          point.gForce = event.gForce;
          this.logger.log(`Matched event at ${timeKey}: ${event.eventType} - ${event.severity}`);
        }
        
        dataPoints.push(point);
      });

      // Add events that don't have matching GPS points (if any)
      let unmatchedEvents = 0;
      eventsResult.rows.forEach(event => {
        const eventTime = new Date(event.time);
        eventTime.setMilliseconds(0);
        const roundedTimeKey = eventTime.toISOString();
        
        // Check if we already have a point close to this time
        const hasMatch = dataPoints.some(p => {
          const pointTime = new Date(p.time);
          pointTime.setMilliseconds(0);
          return pointTime.toISOString() === roundedTimeKey;
        });
        
        if (!hasMatch) {
          unmatchedEvents++;
          dataPoints.push({
            time: event.time.toISOString(),
            acceleration: parseFloat(event.acceleration),
            speed: event.speed,
            eventType: event.eventType,
            severity: event.severity,
            gForce: parseFloat(event.gForce),
          });
          this.logger.log(`Added unmatched event at ${event.time}: ${event.eventType} - ${event.severity}`);
        }
      });
      
      if (unmatchedEvents > 0) {
        this.logger.log(`Added ${unmatchedEvents} unmatched events to chart`);
      }

      // Sort by time
      dataPoints.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      
      this.logger.log(`Total chart data points: ${dataPoints.length}, with events: ${dataPoints.filter(p => p.eventType).length}`);

      // Get garage number
      const garageQuery = `
        SELECT DISTINCT garage_no 
        FROM gps_data 
        WHERE vehicle_id = $1 
        LIMIT 1
      `;
      const garageResult = await this.pgPool.query(garageQuery, [vehicleId]);
      const garageNo = garageResult.rows[0]?.garage_no || `V${vehicleId}`;

      return {
        vehicleId,
        garageNo,
        startDate: start,
        endDate: end,
        dataPoints,
        totalPoints: dataPoints.length,
        eventCount: eventsResult.rows.length,
      };
    } catch (error) {
      this.logger.error(`Error fetching vehicle chart data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process new GPS data for aggressive driving detection
   * This will be called from GPS Sync service
   */
  async processGpsData(vehicleId: number, startTime: Date, endTime: Date): Promise<void> {
    try {
      const query = `
        SELECT * FROM detect_aggressive_driving_batch($1, $2, $3)
      `;
      
      const result = await this.pgPool.query(query, [vehicleId, startTime, endTime]);
      
      if (result.rows[0].detected_events > 0) {
        this.logger.log(
          `Detected ${result.rows[0].detected_events} events for vehicle ${vehicleId} ` +
          `(${result.rows[0].severe_count} severe, ${result.rows[0].moderate_count} moderate)`,
        );
      }
    } catch (error) {
      this.logger.error(`Error processing GPS data for aggressive driving: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper method to return empty statistics
   */
  private getEmptyStatistics(vehicleId: number, startDate: string, endDate: string): VehicleStatisticsDto {
    return {
      totalEvents: 0,
      severeAccelerations: 0,
      moderateAccelerations: 0,
      severeBrakings: 0,
      moderateBrakings: 0,
      avgGForce: 0,
      maxGForce: 0,
      totalDistanceKm: 0,
      eventsPer100Km: 0,
      mostCommonHour: 0,
      safetyScore: 100,
      startDate,
      endDate,
      vehicleId,
      garageNo: `V${vehicleId}`,
    };
  }

  async onModuleDestroy() {
    await this.pgPool.end();
    this.logger.log('DrivingBehaviorService database connection closed');
  }
}
