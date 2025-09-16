import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
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

  constructor(private prisma: PrismaService) {
    // Initialize TimescaleDB connection pool using centralized config
    this.pgPool = createTimescalePool();
    
    // Test connection - quiet initialization
    testTimescaleConnection(this.pgPool).then(success => {
      if (!success) {
        this.logger.error('❌ DrivingBehaviorService - neuspešna konekcija na TimescaleDB');
      }
    });
  }

  /**
   * Map frontend event types to database enum values
   */
  private mapEventType(eventType: string): string {
    const mapping = {
      'acceleration': 'harsh_acceleration',
      'braking': 'harsh_braking',
      'cornering': 'sharp_turn',
    };
    return mapping[eventType] || eventType;
  }

  /**
   * Map database event types to frontend values
   */
  private mapEventTypeToFrontend(dbEventType: string): EventType {
    const mapping = {
      'harsh_acceleration': EventType.ACCELERATION,
      'harsh_braking': EventType.BRAKING,
      'sharp_turn': EventType.CORNERING,
    };
    return mapping[dbEventType] || EventType.ACCELERATION; // Default fallback
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
        // Convert string severity to integer for database
        const severityMap = {
          'normal': 1,
          'moderate': 3,
          'severe': 5,
        };
        const severityValue = severityMap[severity] || severity;
        conditions.push(`severity = $${paramIndex}`);
        params.push(severityValue);
        paramIndex++;
      }

      if (eventType) {
        conditions.push(`event_type = $${paramIndex}`);
        params.push(this.mapEventType(eventType));
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

      // Map database event types to frontend values
      const mappedEvents = eventsResult.rows.map(event => ({
        ...event,
        eventType: this.mapEventTypeToFrontend(event.eventType),
      }));

      return {
        events: mappedEvents,
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
      
      const statsResult = await this.pgPool.query(statsQuery, [vehicleId, start, end]);

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

      // Sampling logic based on period

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

      // Process events for chart

      // Create a map of events by rounded time (to nearest second) for easier merging
      const eventsMap = new Map<string, any>();
      eventsResult.rows.forEach(event => {
        // Round to nearest second for matching
        const eventTime = new Date(event.time);
        eventTime.setMilliseconds(0);
        const timeKey = eventTime.toISOString();
        eventsMap.set(timeKey, {
          eventType: this.mapEventTypeToFrontend(event.eventType), // Map to frontend values
          severity: event.severity,
          gForce: parseFloat(event.gForce),
          originalTime: event.time,
        });
        // Event mapped for chart
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
          // Event matched to GPS point
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
            eventType: this.mapEventTypeToFrontend(event.eventType), // Map to frontend values
            severity: event.severity,
            gForce: parseFloat(event.gForce),
          });
          // Unmatched event added
        }
      });

      // Sort by time
      dataPoints.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

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
   * OPTIMIZED: Get statistics for multiple vehicles at once
   * Much faster than individual queries!
   */
  async getBatchMonthlyStatistics(
    vehicleIds: number[],
    startDate: string,
    endDate: string,
  ): Promise<VehicleStatisticsDto[]> {
    try {
      // Batch query for all vehicles at once!
      const batchQuery = `
        WITH event_stats AS (
          SELECT 
            vehicle_id,
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity >= 4) as severe_acc,
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity = 3) as moderate_acc,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity >= 4) as severe_brake,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity = 3) as moderate_brake,
            AVG(g_force)::NUMERIC(5,3) as avg_g_force,
            MAX(g_force)::NUMERIC(5,3) as max_g_force,
            COUNT(*) as total_events,
            MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM time))::INTEGER as most_common_hour
          FROM driving_events
          WHERE vehicle_id = ANY($1::int[])
            AND time >= $2::date
            AND time < $3::date + INTERVAL '1 day'
          GROUP BY vehicle_id
        ),
        distance_stats AS (
          -- Kombinacija monthly i hourly agregata za tačne Belgrade km
          -- Monthly daje UTC bucket, hourly koriguje za UTC+2 offset
          WITH monthly_base AS (
            SELECT
              vehicle_id,
              total_km as km_monthly,
              active_days
            FROM monthly_vehicle_distance
            WHERE vehicle_id = ANY($1::int[])
              AND month_utc = DATE_TRUNC('month', $2::date)::timestamptz
          ),
          hourly_start_correction AS (
            -- Dodaj sate od prethodnog meseca koji pripadaju Belgrade mesecu
            -- Npr. za avgust: 31.07 22:00-23:59 UTC = 01.08 00:00-01:59 Belgrade
            SELECT
              vehicle_id,
              COALESCE(SUM(total_km), 0) as km_to_add
            FROM hourly_vehicle_distance
            WHERE vehicle_id = ANY($1::int[])
              AND hour_utc >= (DATE_TRUNC('month', $2::date) - INTERVAL '2 hours')::timestamptz
              AND hour_utc < DATE_TRUNC('month', $2::date)::timestamptz
            GROUP BY vehicle_id
          ),
          hourly_end_correction AS (
            -- Oduzmi sate koji ne pripadaju Belgrade mesecu
            -- Npr. za avgust: 31.08 22:00-23:59 UTC = 01.09 00:00-01:59 Belgrade
            SELECT
              vehicle_id,
              COALESCE(SUM(total_km), 0) as km_to_subtract
            FROM hourly_vehicle_distance
            WHERE vehicle_id = ANY($1::int[])
              AND hour_utc >= (DATE_TRUNC('month', $3::date + INTERVAL '1 day') - INTERVAL '2 hours')::timestamptz
              AND hour_utc < DATE_TRUNC('month', $3::date + INTERVAL '1 day')::timestamptz
            GROUP BY vehicle_id
          )
          SELECT
            COALESCE(m.vehicle_id, hs.vehicle_id, he.vehicle_id) as vehicle_id,
            COALESCE(m.km_monthly, 0) +
            COALESCE(hs.km_to_add, 0) -
            COALESCE(he.km_to_subtract, 0) as total_km,
            COALESCE(m.active_days, 0) as active_days
          FROM monthly_base m
          FULL OUTER JOIN hourly_start_correction hs ON m.vehicle_id = hs.vehicle_id
          FULL OUTER JOIN hourly_end_correction he ON
            COALESCE(m.vehicle_id, hs.vehicle_id) = he.vehicle_id
        ),
        garage_names AS (
          SELECT DISTINCT ON (vehicle_id)
            vehicle_id,
            garage_no
          FROM gps_data
          WHERE vehicle_id = ANY($1::int[])
          ORDER BY vehicle_id, time DESC
        )
        SELECT 
          COALESCE(e.vehicle_id, d.vehicle_id) as vehicle_id,
          COALESCE(g.garage_no, 'V' || COALESCE(e.vehicle_id, d.vehicle_id)) as garage_no,
          COALESCE(severe_acc, 0) as severe_accelerations,
          COALESCE(moderate_acc, 0) as moderate_accelerations,
          COALESCE(severe_brake, 0) as severe_brakings,
          COALESCE(moderate_brake, 0) as moderate_brakings,
          COALESCE(avg_g_force, 0) as avg_g_force,
          COALESCE(max_g_force, 0) as max_g_force,
          COALESCE(total_events, 0) as total_events,
          COALESCE(total_km, 0) as total_distance_km,
          COALESCE(active_days, 0) as active_days,
          COALESCE(most_common_hour, 0) as most_common_hour,
          CASE 
            WHEN total_km > 0 AND total_events > 0 THEN 
              (total_events::NUMERIC / total_km * 100)::NUMERIC(10,2)
            ELSE 0
          END as events_per_100km
        FROM event_stats e
        FULL OUTER JOIN distance_stats d ON e.vehicle_id = d.vehicle_id
        LEFT JOIN garage_names g ON COALESCE(e.vehicle_id, d.vehicle_id) = g.vehicle_id
        ORDER BY vehicle_id
      `;

      const result = await this.pgPool.query(batchQuery, [vehicleIds, startDate, endDate]);

      // Calculate safety scores in application (flexible!)
      return Promise.all(
        result.rows.map(async row => ({
          vehicleId: row.vehicle_id,
          garageNo: row.garage_no,
          totalEvents: row.total_events,
          severeAccelerations: row.severe_accelerations,
          moderateAccelerations: row.moderate_accelerations,
          severeBrakings: row.severe_brakings,
          moderateBrakings: row.moderate_brakings,
          avgGForce: parseFloat(row.avg_g_force) || 0,
          maxGForce: parseFloat(row.max_g_force) || 0,
          totalDistanceKm: parseFloat(row.total_distance_km) || 0,
          eventsPer100Km: parseFloat(row.events_per_100km) || 0,
          mostCommonHour: row.most_common_hour || 0,
          safetyScore: await this.calculateBatchSafetyScore(row),
          startDate,
          endDate,
        }))
      );
    } catch (error) {
      this.logger.error(`Error in batch monthly statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Flexible safety score calculation using database configuration
   */
  private async calculateBatchSafetyScore(stats: any): Promise<number> {
    const { 
      severe_accelerations = 0, 
      moderate_accelerations = 0,
      severe_brakings = 0,
      moderate_brakings = 0,
      total_distance_km = 0 
    } = stats;

    // No driving = perfect score
    if (total_distance_km === 0) return 100;

    try {
      // Get configuration from database
      const [configs, globalConfig] = await Promise.all([
        this.prisma.safetyScoreConfig.findMany({
          where: { isActive: true }
        }),
        this.prisma.safetyScoreGlobalConfig.findMany()
      ]);

      // Convert global config to map
      const globalParams = new Map(
        globalConfig.map(g => [g.parameterName, Number(g.parameterValue)])
      );

      const baseScore = globalParams.get('base_score') ?? 100;
      const minScore = globalParams.get('min_score') ?? 0;
      const maxScore = globalParams.get('max_score') ?? 100;
      const distanceNorm = globalParams.get('distance_normalization') ?? 100;

      let totalPenalty = 0;

      // Process each configuration rule
      for (const config of configs) {
        let eventCount = 0;

        // Map database events to actual counts
        if (config.eventType === 'harsh_acceleration') {
          eventCount = config.severity === 'severe' ? severe_accelerations : moderate_accelerations;
        } else if (config.eventType === 'harsh_braking') {
          eventCount = config.severity === 'severe' ? severe_brakings : moderate_brakings;
        }

        // Calculate events per normalized distance
        const thresholdDistance = Number(config.thresholdDistanceKm);
        const normalizedDistance = Math.max(total_distance_km, 1) * (distanceNorm / thresholdDistance);
        const eventsPer = (eventCount / normalizedDistance) * distanceNorm;

        // Calculate penalty if threshold exceeded
        if (eventsPer > Number(config.thresholdEvents)) {
          const excess = eventsPer - Number(config.thresholdEvents);
          let penalty = Number(config.penaltyPoints) + (excess * Number(config.penaltyMultiplier));
          
          // Apply max penalty if configured
          if (config.maxPenalty) {
            penalty = Math.min(penalty, Number(config.maxPenalty));
          }
          
          totalPenalty += penalty;
        }
      }

      // Calculate final score
      const finalScore = baseScore - totalPenalty;
      return Math.max(minScore, Math.min(maxScore, Math.round(finalScore)));

    } catch (error) {
      this.logger.warn(`Failed to load safety score config, using default: ${error.message}`);
      // Fallback to simple calculation if config fails
      const events = severe_accelerations + severe_brakings + moderate_accelerations + moderate_brakings;
      const eventsPer100km = (events / Math.max(total_distance_km, 1)) * 100;
      return Math.max(0, Math.min(100, Math.round(100 - Math.min(50, eventsPer100km))));
    }
  }

  /**
   * Get safety score configuration
   */
  async getSafetyScoreConfig() {
    try {
      const configs = await this.prisma.safetyScoreConfig.findMany({
        where: { isActive: true },
        orderBy: [
          { eventType: 'asc' },
          { severity: 'desc' }
        ]
      });

      // Map to frontend-friendly format
      return {
        severeAccelThreshold: configs.find(c => c.eventType === 'harsh_acceleration' && c.severity === 'severe')?.thresholdEvents || 2,
        severeAccelDistance: configs.find(c => c.eventType === 'harsh_acceleration' && c.severity === 'severe')?.thresholdDistanceKm || 100,
        severeAccelPenalty: Number(configs.find(c => c.eventType === 'harsh_acceleration' && c.severity === 'severe')?.penaltyPoints) || 15,
        
        moderateAccelThreshold: configs.find(c => c.eventType === 'harsh_acceleration' && c.severity === 'moderate')?.thresholdEvents || 10,
        moderateAccelDistance: configs.find(c => c.eventType === 'harsh_acceleration' && c.severity === 'moderate')?.thresholdDistanceKm || 100,
        moderateAccelPenalty: Number(configs.find(c => c.eventType === 'harsh_acceleration' && c.severity === 'moderate')?.penaltyPoints) || 5,
        
        severeBrakeThreshold: configs.find(c => c.eventType === 'harsh_braking' && c.severity === 'severe')?.thresholdEvents || 2,
        severeBrakeDistance: configs.find(c => c.eventType === 'harsh_braking' && c.severity === 'severe')?.thresholdDistanceKm || 100,
        severeBrakePenalty: Number(configs.find(c => c.eventType === 'harsh_braking' && c.severity === 'severe')?.penaltyPoints) || 15,
        
        moderateBrakeThreshold: configs.find(c => c.eventType === 'harsh_braking' && c.severity === 'moderate')?.thresholdEvents || 10,
        moderateBrakeDistance: configs.find(c => c.eventType === 'harsh_braking' && c.severity === 'moderate')?.thresholdDistanceKm || 100,
        moderateBrakePenalty: Number(configs.find(c => c.eventType === 'harsh_braking' && c.severity === 'moderate')?.penaltyPoints) || 5,
      };
    } catch (error) {
      this.logger.error(`Error fetching safety config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update safety score configuration
   */
  async updateSafetyScoreConfig(configs: any[], userId: number) {
    try {
      // Update each config in transaction
      return await this.prisma.$transaction(async (tx) => {
        const updates: Promise<any>[] = [];
        
        // Update severe acceleration
        if (configs['severeAccel']) {
          updates.push(
            tx.safetyScoreConfig.updateMany({
              where: {
                eventType: 'harsh_acceleration',
                severity: 'severe'
              },
              data: {
                thresholdEvents: configs['severeAccel'].threshold,
                thresholdDistanceKm: configs['severeAccel'].distance,
                penaltyPoints: configs['severeAccel'].penalty,
              }
            })
          );
        }
        
        // Update moderate acceleration
        if (configs['moderateAccel']) {
          updates.push(
            tx.safetyScoreConfig.updateMany({
              where: {
                eventType: 'harsh_acceleration',
                severity: 'moderate'
              },
              data: {
                thresholdEvents: configs['moderateAccel'].threshold,
                thresholdDistanceKm: configs['moderateAccel'].distance,
                penaltyPoints: configs['moderateAccel'].penalty,
              }
            })
          );
        }
        
        // Update severe braking
        if (configs['severeBrake']) {
          updates.push(
            tx.safetyScoreConfig.updateMany({
              where: {
                eventType: 'harsh_braking',
                severity: 'severe'
              },
              data: {
                thresholdEvents: configs['severeBrake'].threshold,
                thresholdDistanceKm: configs['severeBrake'].distance,
                penaltyPoints: configs['severeBrake'].penalty,
              }
            })
          );
        }
        
        // Update moderate braking
        if (configs['moderateBrake']) {
          updates.push(
            tx.safetyScoreConfig.updateMany({
              where: {
                eventType: 'harsh_braking',
                severity: 'moderate'
              },
              data: {
                thresholdEvents: configs['moderateBrake'].threshold,
                thresholdDistanceKm: configs['moderateBrake'].distance,
                penaltyPoints: configs['moderateBrake'].penalty,
              }
            })
          );
        }
        
        await Promise.all(updates);
        return { success: true, message: 'Configuration updated successfully' };
      });
    } catch (error) {
      this.logger.error(`Error updating safety config: ${error.message}`);
      throw error;
    }
  }

  /**
   * EMERGENCY: Force refresh continuous aggregates (LIVE SERVER)
   */
  async forceRefreshContinuousAggregates(userId: number) {
    try {
      this.logger.warn(`🚨 EMERGENCY: Force refresh pokrenuo korisnik ${userId}`);
      
      // 1. Refresh vehicle_hourly_stats
      await this.pgPool.query(`CALL refresh_continuous_aggregate('vehicle_hourly_stats', NULL, NULL)`);
      this.logger.log('✅ vehicle_hourly_stats refreshovan');
      
      // 2. Refresh daily_vehicle_stats  
      await this.pgPool.query(`CALL refresh_continuous_aggregate('daily_vehicle_stats', NULL, NULL)`);
      this.logger.log('✅ daily_vehicle_stats refreshovan');
      
      // 3. Update statistike
      await this.pgPool.query(`ANALYZE vehicle_hourly_stats`);
      await this.pgPool.query(`ANALYZE daily_vehicle_stats`);
      this.logger.log('✅ Statistike ažurirane');
      
      return { 
        success: true, 
        message: 'Continuous aggregates su uspešno refreshovani',
        timestamp: new Date().toISOString(),
        refreshedBy: userId
      };
      
    } catch (error) {
      this.logger.error(`❌ Greška u force refresh: ${error.message}`);
      throw new Error(`Force refresh failed: ${error.message}`);
    }
  }

  /**
   * Process new GPS data for aggressive driving detection
   * This will be called from GPS Sync service
   */
  async processGpsData(vehicleId: number, startTime: Date, endTime: Date): Promise<void> {
    try {
      // First get garage_no for this vehicle
      const garageQuery = `
        SELECT garage_no FROM gps_data 
        WHERE vehicle_id = $1 
        ORDER BY time DESC 
        LIMIT 1
      `;
      const garageResult = await this.pgPool.query(garageQuery, [vehicleId]);
      
      if (garageResult.rows.length === 0) {
        this.logger.warn(`No GPS data found for vehicle ${vehicleId}, skipping aggressive driving detection`);
        return;
      }
      
      const garageNo = garageResult.rows[0].garage_no;
      
      const query = `
        SELECT * FROM detect_aggressive_driving_batch($1, $2, $3, $4)
      `;
      
      const result = await this.pgPool.query(query, [vehicleId, garageNo, startTime, endTime]);
      
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
