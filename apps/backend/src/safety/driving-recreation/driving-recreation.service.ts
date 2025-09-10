import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VehicleMapperService } from '../../common/helpers/vehicle-mapper';
import { Pool } from 'pg';
import { createTimescalePool } from '../../common/config/timescale.config';
import {
  StartRecreationDto,
  RecreationStatus,
  RecreationStrategy,
  RecreationStatusDto,
  VehicleWithStatsDto,
  RecreationHistoryDto,
  VehicleProgressDto,
} from './dto/driving-recreation.dto';

@Injectable()
export class DrivingRecreationService {
  private readonly logger = new Logger(DrivingRecreationService.name);
  private pgPool: Pool;
  private activeRecreations: Map<number, any> = new Map();

  constructor(
    private prisma: PrismaService,
    private vehicleMapper: VehicleMapperService,
  ) {
    this.pgPool = createTimescalePool();
  }

  /**
   * Get vehicles with GPS points and existing events statistics
   */
  async getVehiclesWithStats(
    startDate: string,
    endDate: string,
  ): Promise<VehicleWithStatsDto[]> {
    try {
      // Get all vehicles from MySQL
      const vehicles = await this.prisma.busVehicle.findMany({
        where: { active: true },
        select: {
          id: true,
          garageNumber: true,
          registrationNumber: true,
          active: true,
        },
      });

      // Get all vehicle IDs for batch query
      const vehicleIds = vehicles.map(v => v.id);
      
      let vehicleStats = new Map();
      
      try {
        // Batch query to get GPS and event counts for all vehicles at once
        const batchQuery = `
          WITH vehicle_gps AS (
            SELECT 
              vehicle_id,
              COUNT(*) as gps_count
            FROM gps_data
            WHERE vehicle_id = ANY($1::int[])
              AND time >= $2::date
              AND time < $3::date + interval '1 day'
            GROUP BY vehicle_id
          ),
          vehicle_events AS (
            SELECT 
              vehicle_id,
              COUNT(*) as event_count
            FROM driving_events
            WHERE vehicle_id = ANY($1::int[])
              AND time >= $2::date
              AND time < $3::date + interval '1 day'
            GROUP BY vehicle_id
          )
          SELECT 
            v.id as vehicle_id,
            COALESCE(g.gps_count, 0) as gps_count,
            COALESCE(e.event_count, 0) as event_count
          FROM unnest($1::int[]) as v(id)
          LEFT JOIN vehicle_gps g ON g.vehicle_id = v.id
          LEFT JOIN vehicle_events e ON e.vehicle_id = v.id
        `;
        
        const statsResult = await this.pgPool.query(batchQuery, [
          vehicleIds,
          startDate,
          endDate,
        ]);
        
        // Convert to map for easy lookup
        statsResult.rows.forEach(row => {
          vehicleStats.set(row.vehicle_id, {
            gpsPoints: parseInt(row.gps_count),
            existingEvents: parseInt(row.event_count),
          });
        });
      } catch (error) {
        this.logger.error(`Error getting batch stats: ${error.message}`);
        // If batch query fails, set all to 0
        vehicleIds.forEach(id => {
          vehicleStats.set(id, { gpsPoints: 0, existingEvents: 0 });
        });
      }

      // Map vehicles with their stats
      const vehiclesWithStats = vehicles.map(vehicle => {
        const stats = vehicleStats.get(vehicle.id) || { gpsPoints: 0, existingEvents: 0 };
        return {
          id: vehicle.id,
          garageNo: vehicle.garageNumber,
          registration: vehicle.registrationNumber || '',
          status: vehicle.active ? 'active' : 'inactive',
          gpsPoints: stats.gpsPoints,
          existingEvents: stats.existingEvents,
        };
      });

      return vehiclesWithStats;
    } catch (error) {
      this.logger.error('Error getting vehicles with stats:', error);
      throw error;
    }
  }

  /**
   * Start driving events recreation process
   */
  async startRecreation(
    userId: number,
    dto: StartRecreationDto,
  ): Promise<{ id: number; message: string }> {
    try {
      // Validate vehicles exist
      const vehicles = await this.prisma.busVehicle.findMany({
        where: { id: { in: dto.vehicleIds } },
        select: { id: true, garageNumber: true },
      });

      if (vehicles.length !== dto.vehicleIds.length) {
        throw new BadRequestException('Neka vozila ne postoje u sistemu');
      }

      // Create log entry
      const recreationLog = await this.prisma.drivingAnalysisLog.create({
        data: {
          userId,
          vehicleIds: dto.vehicleIds,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          totalVehicles: dto.vehicleIds.length,
          processedVehicles: 0,
          totalEventsDetected: 0,
          totalEventsBefore: 0,
          status: RecreationStatus.PENDING,
          strategy: dto.strategy || RecreationStrategy.DAILY,
          clearExisting: dto.clearExisting || false,
          vehicleProgress: {},
        },
      });

      // Start async processing
      this.logger.log(`Starting async processing for recreation ${recreationLog.id}`);
      this.processRecreation(recreationLog.id, dto, vehicles).catch((error) => {
        this.logger.error(`Recreation ${recreationLog.id} failed:`, error);
        this.updateRecreationStatus(recreationLog.id, RecreationStatus.FAILED, error.message);
      });

      return {
        id: recreationLog.id,
        message: `Rekreacija podataka pokrenuta za ${dto.vehicleIds.length} vozila`,
      };
    } catch (error) {
      this.logger.error('Error starting recreation:', error);
      throw error;
    }
  }

  /**
   * Process recreation asynchronously
   */
  private async processRecreation(
    logId: number,
    dto: StartRecreationDto,
    vehicles: any[],
  ): Promise<void> {
    this.logger.log(`processRecreation started for log ${logId} with ${vehicles.length} vehicles`);
    try {
      // Update status to processing
      await this.prisma.drivingAnalysisLog.update({
        where: { id: logId },
        data: {
          status: RecreationStatus.PROCESSING,
          startedAt: new Date(),
        },
      });
      this.logger.log(`Updated status to PROCESSING for log ${logId}`);

      let totalEventsDetected = 0;
      let totalEventsBefore = 0;
      const vehicleProgress: any = {};

      // Process each vehicle
      for (let i = 0; i < vehicles.length; i++) {
        const vehicle = vehicles[i];
        
        try {
          // Initialize vehicle progress
          vehicleProgress[vehicle.id] = {
            garageNo: vehicle.garageNumber,
            status: 'processing',
            progress: 0,
            startedAt: new Date(),
          };

          // Get events count before recreation
          const beforeCountQuery = `
            SELECT COUNT(*) as count
            FROM driving_events
            WHERE vehicle_id = $1
              AND time >= $2::date
              AND time < $3::date + interval '1 day'
          `;
          const beforeResult = await this.pgPool.query(beforeCountQuery, [
            vehicle.id,
            dto.startDate,
            dto.endDate,
          ]);
          const eventsBefore = parseInt(beforeResult.rows[0]?.count || 0);
          totalEventsBefore += eventsBefore;

          // Clear existing events if requested
          if (dto.clearExisting) {
            const deleteQuery = `
              DELETE FROM driving_events
              WHERE vehicle_id = $1
                AND time >= $2::date
                AND time < $3::date + interval '1 day'
            `;
            await this.pgPool.query(deleteQuery, [vehicle.id, dto.startDate, dto.endDate]);
            this.logger.log(`Cleared ${eventsBefore} existing events for vehicle ${vehicle.garageNumber}`);
          }

          // Process based on strategy
          let eventsDetected = 0;
          if (dto.strategy === RecreationStrategy.DAILY) {
            eventsDetected = await this.processVehicleDaily(
              vehicle.id,
              vehicle.garageNumber,
              dto.startDate,
              dto.endDate,
            );
          } else {
            eventsDetected = await this.processVehicleBulk(
              vehicle.id,
              vehicle.garageNumber,
              dto.startDate,
              dto.endDate,
            );
          }

          totalEventsDetected += eventsDetected;

          // Update vehicle progress
          vehicleProgress[vehicle.id] = {
            ...vehicleProgress[vehicle.id],
            status: 'completed',
            progress: 100,
            eventsDetected,
            eventsBefore,
            completedAt: new Date(),
          };

          // Update log with progress
          await this.prisma.drivingAnalysisLog.update({
            where: { id: logId },
            data: {
              processedVehicles: i + 1,
              totalEventsDetected,
              totalEventsBefore,
              vehicleProgress,
            },
          });

          this.logger.log(
            `Processed vehicle ${vehicle.garageNumber}: ${eventsDetected} events detected`,
          );
        } catch (error) {
          this.logger.error(`Error processing vehicle ${vehicle.id}:`, error);
          vehicleProgress[vehicle.id] = {
            ...vehicleProgress[vehicle.id],
            status: 'error',
            error: error.message,
          };
        }
      }

      // Mark as completed
      await this.prisma.drivingAnalysisLog.update({
        where: { id: logId },
        data: {
          status: RecreationStatus.COMPLETED,
          completedAt: new Date(),
          vehicleProgress,
        },
      });

      this.logger.log(`Recreation ${logId} completed: ${totalEventsDetected} total events detected`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process vehicle with daily strategy (better for large periods)
   */
  private async processVehicleDaily(
    vehicleId: number,
    garageNo: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    let totalEvents = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayStart = currentDate.toISOString().split('T')[0];
      const dayEnd = dayStart;

      try {
        const query = `
          SELECT * FROM detect_aggressive_driving_batch($1, $2, $3::date, $3::date + interval '1 day')
        `;
        const result = await this.pgPool.query(query, [vehicleId, garageNo, dayStart]);
        
        if (result.rows[0]) {
          const dayEvents = result.rows[0].total_events || 0;
          totalEvents += dayEvents;
        }
      } catch (error) {
        this.logger.warn(`Error processing day ${dayStart} for vehicle ${garageNo}: ${error.message}`);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalEvents;
  }

  /**
   * Process vehicle with bulk strategy (faster for short periods)
   */
  private async processVehicleBulk(
    vehicleId: number,
    garageNo: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    try {
      const query = `
        SELECT * FROM detect_aggressive_driving_batch($1, $2, $3::date, $4::date + interval '1 day')
      `;
      const result = await this.pgPool.query(query, [vehicleId, garageNo, startDate, endDate]);
      
      if (result.rows[0]) {
        return result.rows[0].total_events || 0;
      }
      return 0;
    } catch (error) {
      this.logger.error(`Error processing bulk for vehicle ${garageNo}:`, error);
      throw error;
    }
  }

  /**
   * Get recreation status
   */
  async getRecreationStatus(id: number): Promise<RecreationStatusDto> {
    const recreation = await this.prisma.drivingAnalysisLog.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!recreation) {
      throw new NotFoundException(`Rekreacija ${id} nije pronađena`);
    }

    // Parse vehicle progress
    const vehicleProgress = (recreation.vehicleProgress as any) || {};
    const vehicles: VehicleProgressDto[] = Object.entries(vehicleProgress).map(
      ([vehicleId, progress]: [string, any]) => ({
        id: parseInt(vehicleId),
        garageNo: progress.garageNo,
        status: progress.status,
        progress: progress.progress || 0,
        eventsDetected: progress.eventsDetected,
        eventsBefore: progress.eventsBefore,
        error: progress.error,
        processingTime: progress.completedAt
          ? new Date(progress.completedAt).getTime() - new Date(progress.startedAt).getTime()
          : undefined,
      }),
    );

    // Find current vehicle being processed
    const currentVehicle = vehicles.find((v) => v.status === 'processing');

    return {
      id: recreation.id,
      status: recreation.status as RecreationStatus,
      totalVehicles: recreation.totalVehicles,
      processedVehicles: recreation.processedVehicles,
      currentVehicle: currentVehicle
        ? {
            id: currentVehicle.id,
            garageNo: currentVehicle.garageNo,
            progress: currentVehicle.progress,
            eventsDetected: currentVehicle.eventsDetected || 0,
          }
        : undefined,
      vehicles,
      startedAt: recreation.startedAt || recreation.createdAt,
      estimatedCompletion: this.estimateCompletion(recreation),
      totalEventsDetected: recreation.totalEventsDetected,
      totalEventsBefore: recreation.totalEventsBefore,
    };
  }

  /**
   * Stop recreation process
   */
  async stopRecreation(id: number): Promise<{ message: string }> {
    const recreation = await this.prisma.drivingAnalysisLog.findUnique({
      where: { id },
    });

    if (!recreation) {
      throw new NotFoundException(`Rekreacija ${id} nije pronađena`);
    }

    if (recreation.status !== RecreationStatus.PROCESSING) {
      throw new BadRequestException('Samo aktivne rekreacije mogu biti zaustavljene');
    }

    await this.prisma.drivingAnalysisLog.update({
      where: { id },
      data: {
        status: RecreationStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    return { message: 'Rekreacija je zaustavljena' };
  }

  /**
   * Get recreation history
   */
  async getRecreationHistory(
    userId?: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: RecreationHistoryDto[]; total: number }> {
    const where = userId ? { userId } : {};
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.drivingAnalysisLog.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.drivingAnalysisLog.count({ where }),
    ]);

    const history = data.map((log) => ({
      id: log.id,
      userId: log.userId,
      userEmail: log.user.email,
      vehicleIds: log.vehicleIds as number[],
      startDate: log.startDate,
      endDate: log.endDate,
      totalVehicles: log.totalVehicles,
      processedVehicles: log.processedVehicles,
      totalEventsDetected: log.totalEventsDetected,
      totalEventsBefore: log.totalEventsBefore,
      status: log.status as RecreationStatus,
      strategy: log.strategy as RecreationStrategy,
      clearExisting: log.clearExisting,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt,
    }));

    return { data: history, total };
  }

  /**
   * Preview events count for selected vehicles and period
   */
  async previewEventsCount(
    vehicleIds: number[],
    startDate: string,
    endDate: string,
  ): Promise<{ vehicleId: number; garageNo: string; existingEvents: number; estimatedNew: number }[]> {
    const results = await Promise.all(
      vehicleIds.map(async (vehicleId) => {
        try {
          // Get vehicle info
          const vehicle = await this.vehicleMapper.getVehicleById(vehicleId);
          
          if (!vehicle) {
            return {
              vehicleId,
              garageNo: `ID:${vehicleId}`,
              existingEvents: 0,
              estimatedNew: 0,
            };
          }
          
          // Get existing events count
          const eventsQuery = `
            SELECT COUNT(*) as count
            FROM driving_events
            WHERE vehicle_id = $1
              AND time >= $2::date
              AND time < $3::date + interval '1 day'
          `;
          const eventsResult = await this.pgPool.query(eventsQuery, [vehicleId, startDate, endDate]);
          const existingEvents = parseInt(eventsResult.rows[0]?.count || 0);

          // Estimate new events based on GPS points
          const gpsQuery = `
            SELECT COUNT(*) as count
            FROM gps_data
            WHERE vehicle_id = $1
              AND time >= $2::date
              AND time < $3::date + interval '1 day'
              AND speed > 0
          `;
          const gpsResult = await this.pgPool.query(gpsQuery, [vehicleId, startDate, endDate]);
          const gpsPoints = parseInt(gpsResult.rows[0]?.count || 0);
          
          // Rough estimate: ~0.5% of GPS points result in events
          const estimatedNew = Math.round(gpsPoints * 0.005);

          return {
            vehicleId,
            garageNo: vehicle.garageNumber,
            existingEvents,
            estimatedNew,
          };
        } catch (error) {
          this.logger.warn(`Error previewing events for vehicle ${vehicleId}: ${error.message}`);
          return {
            vehicleId,
            garageNo: `ID:${vehicleId}`,
            existingEvents: 0,
            estimatedNew: 0,
          };
        }
      }),
    );

    return results;
  }

  /**
   * Helper: Update recreation status
   */
  private async updateRecreationStatus(
    id: number,
    status: RecreationStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.drivingAnalysisLog.update({
      where: { id },
      data: {
        status,
        errorMessage,
        completedAt: status === RecreationStatus.FAILED ? new Date() : undefined,
      },
    });
  }

  /**
   * Helper: Estimate completion time
   */
  private estimateCompletion(recreation: any): Date | undefined {
    if (recreation.status !== RecreationStatus.PROCESSING || !recreation.startedAt) {
      return undefined;
    }

    const elapsed = Date.now() - new Date(recreation.startedAt).getTime();
    const processed = recreation.processedVehicles;
    const total = recreation.totalVehicles;

    if (processed === 0) {
      return undefined;
    }

    const averageTime = elapsed / processed;
    const remaining = total - processed;
    const estimatedRemaining = averageTime * remaining;

    return new Date(Date.now() + estimatedRemaining);
  }
}