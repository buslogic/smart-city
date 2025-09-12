import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { VehicleAnalyticsDto, HourlyDataDto, SpeedDistributionDto, DailyStatsDto, DrivingEventStatsDto } from './dto/vehicle-analytics.dto';
import { createTimescalePool, testTimescaleConnection } from '../common/config/timescale.config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GpsAnalyticsService {
  private readonly logger = new Logger(GpsAnalyticsService.name);
  private pgPool: Pool;

  constructor(private readonly prisma: PrismaService) {
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
      // DEBUGGING: Logiraj primljene datume
      this.logger.log(`📅 ANALITIKA - Primljeni datumi:`);
      this.logger.log(`   Start (raw): ${startDate}`);
      this.logger.log(`   End (raw): ${endDate}`);
      this.logger.log(`   Vehicle ID: ${vehicleId}`);
      
      // Prvo proveri da li ima podataka
      const countQuery = `
        SELECT 
          COUNT(*) as count,
          MIN(time) as min_time,
          MAX(time) as max_time
        FROM gps_data 
        WHERE vehicle_id = $1 AND time BETWEEN $2 AND $3
      `;
      const countResult = await this.pgPool.query(countQuery, [vehicleId, startDate, endDate]);
      const totalPoints = parseInt(countResult.rows[0]?.count || '0');
      
      // Logiraj rezultate
      this.logger.log(`📊 Rezultat COUNT query:`);
      this.logger.log(`   Total points: ${totalPoints}`);
      this.logger.log(`   Min time in range: ${countResult.rows[0]?.min_time}`);
      this.logger.log(`   Max time in range: ${countResult.rows[0]?.max_time}`);
      
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
          drivingEventStats: [
            { severity: 1, label: 'Veoma blago', count: 0, harshBraking: 0, harshAcceleration: 0 },
            { severity: 2, label: 'Blago', count: 0, harshBraking: 0, harshAcceleration: 0 },
            { severity: 3, label: 'Umereno', count: 0, harshBraking: 0, harshAcceleration: 0 },
            { severity: 4, label: 'Ozbiljno', count: 0, harshBraking: 0, harshAcceleration: 0 },
            { severity: 5, label: 'Veoma ozbiljno', count: 0, harshBraking: 0, harshAcceleration: 0 },
          ],
          safetyScore: 100, // Nema podataka = savršen score
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
          LPAD(EXTRACT(HOUR FROM time AT TIME ZONE 'Europe/Belgrade')::TEXT, 2, '0') as hour,
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
        GROUP BY EXTRACT(HOUR FROM time AT TIME ZONE 'Europe/Belgrade')
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
            DATE(time AT TIME ZONE 'Europe/Belgrade') as date,
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
          GROUP BY DATE(time AT TIME ZONE 'Europe/Belgrade')
          ORDER BY date
        `;
        
        this.logger.log(`📅 Daily stats query - parametri: vehicleId=${vehicleId}, start=${startDate}, end=${endDate}`);

        const dailyResult = await this.pgPool.query(dailyQuery, [
          vehicleId,
          startDate,
          endDate,
        ]);
        
        this.logger.log(`📊 Daily stats rezultat: ${dailyResult.rows.length} dana pronađeno`);
        if (dailyResult.rows.length > 0) {
          this.logger.log(`   Prvi dan: ${dailyResult.rows[0].date}`);
          this.logger.log(`   Poslednji dan: ${dailyResult.rows[dailyResult.rows.length - 1].date}`);
        }

        dailyStats = dailyResult.rows.map((row, index) => {
          // row.date je već Date objekat u lokalnom vremenu
          // Formatuj kao YYYY-MM-DD bez konverzije u UTC
          const year = row.date.getFullYear();
          const month = String(row.date.getMonth() + 1).padStart(2, '0');
          const day = String(row.date.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          // Log samo za prvi i poslednji
          if (index === 0 || index === dailyResult.rows.length - 1) {
            this.logger.log(`   Formatovan datum: ${dateStr} (iz Date objekta: ${row.date})`);
          }
          
          return {
            date: dateStr,
            distance: parseFloat(row.distance),
            drivingHours: (row.moving_points * 30 / 3600), // Procena na osnovu broja tačaka
            avgSpeed: parseFloat(row.avg_speed),
          };
        });
      }

      // Dohvati statistiku agresivne vožnje iz driving_events tabele
      const drivingEventsQuery = `
        WITH severity_stats AS (
          SELECT 
            severity,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking') as harsh_braking_count,
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration') as harsh_acceleration_count
          FROM driving_events
          WHERE vehicle_id = $1
            AND time BETWEEN $2 AND $3
          GROUP BY severity
        )
        SELECT 
          severity,
          total_count::INTEGER,
          harsh_braking_count::INTEGER,
          harsh_acceleration_count::INTEGER
        FROM severity_stats
        ORDER BY severity
      `;

      const drivingEventsResult = await this.pgPool.query(drivingEventsQuery, [
        vehicleId,
        startDate,
        endDate,
      ]);

      // Mapiraj nivoe ozbiljnosti na opise
      const severityLabels = {
        1: 'Veoma blago',
        2: 'Blago',
        3: 'Umereno',
        4: 'Ozbiljno',
        5: 'Veoma ozbiljno'
      };

      // Kreiraj statistiku sa svim nivoima (1-5), čak i ako nema podataka
      const drivingEventStats: DrivingEventStatsDto[] = [];
      for (let severity = 1; severity <= 5; severity++) {
        const eventData = drivingEventsResult.rows.find(row => row.severity === severity);
        drivingEventStats.push({
          severity,
          label: severityLabels[severity],
          count: eventData?.total_count || 0,
          harshBraking: eventData?.harsh_braking_count || 0,
          harshAcceleration: eventData?.harsh_acceleration_count || 0
        });
      }

      // Kalkuliši Safety Score na osnovu konfiguracije iz baze
      const safetyScore = await this.calculateSafetyScore(
        drivingEventStats,
        parseFloat(metrics.total_distance) || 0
      );

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
        drivingEventStats,
        safetyScore,
      };
    } catch (error) {
      this.logger.error(`Greška pri dohvatanju analitike: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kalkuliše Safety Score na osnovu konfiguracije iz baze podataka
   */
  private async calculateSafetyScore(
    drivingEventStats: DrivingEventStatsDto[],
    totalDistanceKm: number
  ): Promise<number> {
    // Nema vožnje = savršen score
    if (totalDistanceKm === 0) return 100;

    try {
      // Dohvati konfiguraciju iz baze
      const [configs, globalConfig] = await Promise.all([
        this.prisma.safetyScoreConfig.findMany({
          where: { isActive: true }
        }),
        this.prisma.safetyScoreGlobalConfig.findMany()
      ]);

      // Konvertuj globalnu konfiguraciju u mapu
      const globalParams = new Map(
        globalConfig.map(g => [g.parameterName, Number(g.parameterValue)])
      );

      const baseScore = globalParams.get('base_score') ?? 100;
      const minScore = globalParams.get('min_score') ?? 0;
      const maxScore = globalParams.get('max_score') ?? 100;
      const distanceNorm = globalParams.get('distance_normalization') ?? 100;

      let totalPenalty = 0;

      // Pronađi severity 3 (moderate) i 5 (severe) događaje
      const moderateEvents = drivingEventStats.find(s => s.severity === 3);
      const severeEvents = drivingEventStats.find(s => s.severity === 5);

      const moderateAccelerations = moderateEvents?.harshAcceleration || 0;
      const severeAccelerations = severeEvents?.harshAcceleration || 0;
      const moderateBrakings = moderateEvents?.harshBraking || 0;
      const severeBrakings = severeEvents?.harshBraking || 0;

      // Procesuj svaku konfiguraciju
      for (const config of configs) {
        let eventCount = 0;

        // Mapiraj događaje iz baze na brojeve
        if (config.eventType === 'harsh_acceleration') {
          eventCount = config.severity === 'severe' ? severeAccelerations : moderateAccelerations;
        } else if (config.eventType === 'harsh_braking') {
          eventCount = config.severity === 'severe' ? severeBrakings : moderateBrakings;
        }

        // Kalkuliši događaje po normalizovanoj distanci
        const thresholdDistance = Number(config.thresholdDistanceKm) || 100;
        const normalizedDistance = Math.max(totalDistanceKm, 1) * (distanceNorm / thresholdDistance);
        const eventsPer = (eventCount / normalizedDistance) * distanceNorm;

        // Kalkuliši kaznu ako je prag prekoračen
        const thresholdEvents = Number(config.thresholdEvents) || 10;
        if (eventsPer > thresholdEvents) {
          const excess = eventsPer - thresholdEvents;
          const penaltyPoints = Number(config.penaltyPoints) || 5;
          const penaltyMultiplier = Number(config.penaltyMultiplier) || 1.5;
          let penalty = penaltyPoints + (excess * penaltyMultiplier);
          
          // Primeni maksimalnu kaznu ako je konfigurisana
          const maxPenalty = Number(config.maxPenalty);
          if (maxPenalty > 0) {
            penalty = Math.min(penalty, maxPenalty);
          }
          
          totalPenalty += penalty;
        }
      }

      // Kalkuliši finalni score
      const finalScore = baseScore - totalPenalty;
      return Math.max(minScore, Math.min(maxScore, Math.round(finalScore)));

    } catch (error) {
      this.logger.warn(`Neuspešno učitavanje Safety Score konfiguracije, koristi se default: ${error.message}`);
      // Fallback na jednostavnu kalkulaciju ako konfiguracija nije dostupna
      const totalEvents = drivingEventStats.reduce((sum, stat) => sum + stat.count, 0);
      const eventsPer100km = (totalEvents / Math.max(totalDistanceKm, 1)) * 100;
      return Math.max(0, Math.min(100, Math.round(100 - Math.min(50, eventsPer100km))));
    }
  }

  async onModuleDestroy() {
    await this.pgPool.end();
  }
}