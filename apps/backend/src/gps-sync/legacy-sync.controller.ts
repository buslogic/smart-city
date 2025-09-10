import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  Query,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery, ApiPropertyOptional, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { LegacySyncService } from './legacy-sync.service';
import { LegacySyncWorkerPoolService } from './legacy-sync-worker-pool.service';
import { SmartSlowSyncService, SlowSyncPreset, SlowSyncConfig, SlowSyncProgress } from './smart-slow-sync.service';
import { CopyConfigDto, CopyConfigResponseDto } from './dto/copy-config.dto';
import { IsArray, IsDateString, IsNumber, IsEnum, IsOptional, IsBoolean } from 'class-validator';

class VehicleWithSyncStatusDto {
  id: number;
  garage_number: string;
  vehicle_model: string;
  registration_number: string;
  last_sync_date: Date | null;
  total_gps_points: number;
  sync_status: 'never' | 'syncing' | 'completed' | 'error';
  last_sync_error: string | null;
  legacy_table_name: string;
  legacy_database: string;
}

class StartSyncDto {
  @IsArray()
  @IsNumber({}, { each: true })
  vehicle_ids: number[];
  
  @IsDateString()
  sync_from: string;
  
  @IsDateString()
  sync_to: string;
  
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ 
    description: 'Odmah osveži continuous aggregates nakon sync-a (može opteretiti server)',
    default: false 
  })
  refresh_aggregates?: boolean;
}

class SyncProgressDto {
  vehicle_id: number;
  garage_number: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress_percentage: number;
  total_records: number;
  processed_records: number;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
}

class SlowSyncConfigDto {
  @IsEnum(SlowSyncPreset)
  @IsOptional()
  preset?: SlowSyncPreset;

  @IsNumber()
  @IsOptional()
  vehiclesPerBatch?: number;

  @IsNumber()
  @IsOptional()
  workersPerBatch?: number;

  @IsNumber()
  @IsOptional()
  batchDelayMinutes?: number;

  @IsNumber()
  @IsOptional()
  nightHoursStart?: number;

  @IsNumber()
  @IsOptional()
  nightHoursEnd?: number;

  @IsNumber()
  @IsOptional()
  maxDailyBatches?: number;

  @IsNumber()
  @IsOptional()
  syncDaysBack?: number;

  @IsBoolean()
  @IsOptional()
  autoCleanup?: boolean;

  @IsNumber()
  @IsOptional()
  compressAfterBatches?: number;

  @IsNumber()
  @IsOptional()
  vacuumAfterBatches?: number;

  @IsBoolean()
  @IsOptional()
  forceProcess?: boolean;

  @IsBoolean()
  @IsOptional()
  syncAlreadySyncedVehicles?: boolean;
}

@ApiTags('Legacy GPS Sync')
@ApiBearerAuth()
@Controller('legacy-sync')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LegacySyncController {
  private readonly logger = new Logger(LegacySyncController.name);

  constructor(
    private readonly legacySyncService: LegacySyncService,
    private readonly workerPoolService: LegacySyncWorkerPoolService,
    private readonly slowSyncService: SmartSlowSyncService
  ) {}

  @Get('vehicles')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Dobavi listu vozila sa statusom sinhronizacije' })
  @ApiResponse({
    status: 200,
    description: 'Lista vozila sa statusom GPS sinhronizacije',
    type: [VehicleWithSyncStatusDto],
  })
  async getVehiclesWithSyncStatus(): Promise<VehicleWithSyncStatusDto[]> {
    try {
      this.logger.log('Fetching vehicles with sync status');
      return await this.legacySyncService.getVehiclesWithSyncStatus();
    } catch (error) {
      this.logger.error('Error fetching vehicles with sync status', error);
      throw error;
    }
  }

  @Post('start')
  @RequirePermissions('legacy.sync:start')
  @ApiOperation({ summary: 'Pokreni sinhronizaciju za odabrana vozila' })
  @ApiBody({ type: StartSyncDto })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija pokrenuta',
  })
  async startSync(@Body() dto: StartSyncDto): Promise<{ message: string; job_id: string }> {
    try {
      this.logger.log(`Starting sync for vehicles: ${dto.vehicle_ids.join(', ')}`);
      this.logger.log(`Date range: ${dto.sync_from} to ${dto.sync_to}`);
      
      const jobId = await this.legacySyncService.startLegacySync(
        dto.vehicle_ids,
        new Date(dto.sync_from),
        new Date(dto.sync_to),
        dto.refresh_aggregates || false
      );
      
      return {
        message: `Sinhronizacija pokrenuta za ${dto.vehicle_ids.length} vozila`,
        job_id: jobId,
      };
    } catch (error) {
      this.logger.error('Error starting sync', error);
      throw error;
    }
  }

  @Get('progress')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Dobavi status trenutnih sinhronizacija' })
  @ApiQuery({ name: 'job_id', required: false })
  @ApiResponse({
    status: 200,
    description: 'Status sinhronizacije po vozilu',
    type: [SyncProgressDto],
  })
  async getSyncProgress(@Query('job_id') jobId?: string): Promise<SyncProgressDto[]> {
    try {
      // Ako korisnik traži Worker Pool status, vrati Worker Pool podatke
      const workerStatuses = this.workerPoolService.getWorkerStatuses();
      if (workerStatuses.length > 0) {
        // Konvertuj Worker Pool statuse u SyncProgress format
        return workerStatuses.map(worker => ({
          vehicle_id: worker.vehicleId || 0,
          garage_number: worker.garageNumber || 'Unknown',
          status: this.mapWorkerStatusToSyncStatus(worker.status),
          progress_percentage: worker.progress || 0,
          total_records: worker.totalRecords || 0,
          processed_records: worker.processedRecords || 0,
          currentStep: worker.currentStep,
          logs: [], // Worker Pool čuva logove u rezultatima, ne u statusu
          created_at: worker.startTime || new Date(),
          updated_at: new Date(),
        }));
      }
      
      // Inače vrati legacy sync progress
      return await this.legacySyncService.getSyncProgress(jobId);
    } catch (error) {
      this.logger.error('Error fetching sync progress', error);
      throw error;
    }
  }
  
  private mapWorkerStatusToSyncStatus(workerStatus: string): 'pending' | 'running' | 'completed' | 'error' {
    switch (workerStatus) {
      case 'idle': return 'pending';
      case 'exporting':
      case 'transferring': 
      case 'importing':
      case 'detecting':
      case 'refreshing': return 'running';
      case 'completed': return 'completed';
      case 'failed': return 'error';
      default: return 'pending';
    }
  }

  @Post('stop')
  @RequirePermissions('legacy.sync:stop')
  @ApiOperation({ summary: 'Zaustavi sinhronizaciju' })
  @ApiBody({ schema: { properties: { job_id: { type: 'string' } } } })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija zaustavljena',
  })
  async stopSync(@Body() dto: { job_id: string }): Promise<{ message: string }> {
    try {
      await this.legacySyncService.stopSync(dto.job_id);
      return { message: 'Sinhronizacija zaustavljena' };
    } catch (error) {
      this.logger.error('Error stopping sync', error);
      throw error;
    }
  }

  @Get('config')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Dobavi konfiguraciju Worker Pool-a' })
  @ApiResponse({
    status: 200,
    description: 'Konfiguracija Worker Pool-a',
  })
  async getWorkerConfig(): Promise<any> {
    try {
      const config = await this.workerPoolService.getWorkerPoolConfig();
      return config;
    } catch (error) {
      this.logger.error('Error fetching worker config', error);
      throw error;
    }
  }

  @Post('config/aggressive-detection')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Uključi/isključi agresivnu detekciju' })
  @ApiBody({ schema: { properties: { enabled: { type: 'boolean' } } } })
  @ApiResponse({
    status: 200,
    description: 'Konfiguracija ažurirana',
  })
  async toggleAggressiveDetection(@Body() dto: { enabled: boolean }): Promise<{ message: string; enabled: boolean }> {
    try {
      await this.workerPoolService.toggleAggressiveDetection(dto.enabled);
      return { 
        message: `Agresivna detekcija ${dto.enabled ? 'uključena' : 'isključena'}`,
        enabled: dto.enabled
      };
    } catch (error) {
      this.logger.error('Error toggling aggressive detection', error);
      throw error;
    }
  }

  @Get('test-connection')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Test konekcije na legacy server' })
  @ApiResponse({
    status: 200,
    description: 'Status konekcije',
  })
  async testLegacyConnection(): Promise<{ 
    connected: boolean; 
    server: string;
    database: string;
    message: string;
    vehicle_count?: number;
  }> {
    try {
      return await this.legacySyncService.testLegacyConnection();
    } catch (error) {
      this.logger.error('Error testing legacy connection', error);
      return {
        connected: false,
        server: 'unknown',
        database: 'unknown', 
        message: error.message || 'Connection failed'
      };
    }
  }


  @Post('worker-pool/toggle')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Uključi/isključi Worker Pool' })
  @ApiBody({ schema: { properties: { enabled: { type: 'boolean' } } } })
  @ApiResponse({
    status: 200,
    description: 'Worker Pool status promenjen',
  })
  async toggleWorkerPool(@Body() dto: { enabled: boolean }): Promise<{ 
    message: string; 
    enabled: boolean 
  }> {
    try {
      // Ažuriraj SystemSettings
      await this.legacySyncService['prisma'].systemSettings.upsert({
        where: { key: 'legacy_sync.worker_pool.enabled' },
        update: { value: dto.enabled ? 'true' : 'false' },
        create: {
          key: 'legacy_sync.worker_pool.enabled',
          value: dto.enabled ? 'true' : 'false',
          type: 'boolean',
          category: 'legacy_sync',
          description: 'Enable Worker Pool for parallel vehicle sync'
        }
      });

      return {
        message: `Worker Pool je ${dto.enabled ? 'uključen' : 'isključen'}`,
        enabled: dto.enabled
      };
    } catch (error) {
      this.logger.error('Error toggling worker pool', error);
      throw error;
    }
  }

  // ============= SMART SLOW SYNC ENDPOINTS =============

  @Post('slow-sync/start')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Pokreni Smart Slow Sync za sva vozila' })
  @ApiBody({ type: SlowSyncConfigDto, required: false })
  @ApiResponse({
    status: 200,
    description: 'Smart Slow Sync pokrenut',
  })
  async startSlowSync(@Body() config?: SlowSyncConfigDto): Promise<SlowSyncProgress> {
    try {
      this.logger.log('Starting Smart Slow Sync');
      return await this.slowSyncService.startSlowSync(config);
    } catch (error) {
      this.logger.error('Error starting slow sync', error);
      throw error;
    }
  }

  @Post('slow-sync/pause')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Pauziraj Smart Slow Sync' })
  @ApiResponse({
    status: 200,
    description: 'Smart Slow Sync pauziran',
  })
  async pauseSlowSync(): Promise<SlowSyncProgress> {
    try {
      this.logger.log('Pausing Smart Slow Sync');
      return await this.slowSyncService.pauseSlowSync();
    } catch (error) {
      this.logger.error('Error pausing slow sync', error);
      throw error;
    }
  }

  @Post('slow-sync/resume')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Nastavi Smart Slow Sync' })
  @ApiResponse({
    status: 200,
    description: 'Smart Slow Sync nastavljen',
  })
  async resumeSlowSync(): Promise<SlowSyncProgress> {
    try {
      this.logger.log('Resuming Smart Slow Sync');
      return await this.slowSyncService.resumeSlowSync();
    } catch (error) {
      this.logger.error('Error resuming slow sync', error);
      throw error;
    }
  }

  @Post('slow-sync/stop')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Zaustavi Smart Slow Sync' })
  @ApiResponse({
    status: 200,
    description: 'Smart Slow Sync zaustavljen',
  })
  async stopSlowSync(): Promise<SlowSyncProgress> {
    try {
      this.logger.log('Stopping Smart Slow Sync');
      return await this.slowSyncService.stopSlowSync();
    } catch (error) {
      this.logger.error('Error stopping slow sync', error);
      throw error;
    }
  }

  @Get('slow-sync/progress')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Dobavi progress Smart Slow Sync-a' })
  @ApiResponse({
    status: 200,
    description: 'Progress Smart Slow Sync-a',
  })
  async getSlowSyncProgress(): Promise<SlowSyncProgress> {
    try {
      return await this.slowSyncService.getProgress();
    } catch (error) {
      this.logger.error('Error getting slow sync progress', error);
      throw error;
    }
  }

  @Get('slow-sync/config')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Dobavi trenutnu konfiguraciju Smart Slow Sync-a' })
  @ApiResponse({
    status: 200,
    description: 'Konfiguracija Smart Slow Sync-a',
  })
  async getSlowSyncConfig(): Promise<SlowSyncConfig> {
    try {
      return await this.slowSyncService.getConfig();
    } catch (error) {
      this.logger.error('Error getting slow sync config', error);
      throw error;
    }
  }

  @Patch('slow-sync/config')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Ažuriraj konfiguraciju Smart Slow Sync-a' })
  @ApiBody({ type: SlowSyncConfigDto })
  @ApiResponse({
    status: 200,
    description: 'Konfiguracija ažurirana',
  })
  async updateSlowSyncConfig(@Body() config: SlowSyncConfigDto): Promise<SlowSyncConfig> {
    try {
      this.logger.log('Updating Smart Slow Sync config', config);
      return await this.slowSyncService.updateConfig(config);
    } catch (error) {
      this.logger.error('Error updating slow sync config', error);
      throw error;
    }
  }

  @Delete('slow-sync/reset')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Resetuj progress Smart Slow Sync-a' })
  @ApiResponse({
    status: 200,
    description: 'Progress resetovan',
  })
  async resetSlowSyncProgress(): Promise<{ message: string }> {
    try {
      this.logger.log('Resetting Smart Slow Sync progress');
      await this.slowSyncService.resetProgress();
      return { message: 'Smart Slow Sync progress je resetovan' };
    } catch (error) {
      this.logger.error('Error resetting slow sync progress', error);
      throw error;
    }
  }

  @Post('slow-sync/process-batch')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Ručno pokreni jedan batch (za testiranje)' })
  @ApiResponse({
    status: 200,
    description: 'Batch procesiran',
  })
  async processSlowSyncBatch(): Promise<{ message: string }> {
    try {
      this.logger.log('Manually triggering batch processing with forceProcess=true');
      await this.slowSyncService.processBatch(true); // forceProcess=true za ručno pokretanje
      return { message: 'Batch je procesiran' };
    } catch (error) {
      this.logger.error('Error processing batch', error);
      throw error;
    }
  }

  @Get('worker-status')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Dobij status svih worker-a' })
  @ApiResponse({
    status: 200,
    description: 'Worker statusi',
  })
  async getWorkerStatus() {
    const workers = this.workerPoolService.getWorkerStatuses();
    return {
      workers: workers.map(worker => ({
        workerId: worker.workerId,
        status: worker.status,
        vehicleId: worker.vehicleId,
        garageNumber: worker.garageNumber,
        progress: worker.progress,
        totalRecords: worker.totalRecords,
        processedRecords: worker.processedRecords,
        currentStep: worker.currentStep,
        startedAt: worker.startTime, // Mapira startTime na startedAt
        completedAt: worker.status === 'completed' ? new Date() : undefined,
        error: worker.status === 'failed' ? 'Unknown error' : undefined
      }))
    };
  }

  @Get('slow-sync/activity-feed')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Dobij live activity feed' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maksimalni broj poruka (default: 50, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity feed',
  })
  async getActivityFeed(@Query('limit') limit?: string) {
    const maxLimit = limit ? Math.min(parseInt(limit), 100) : 50;
    return this.slowSyncService.getActivityFeed(maxLimit);
  }

  // ============= SMART SLOW SYNC VEHICLE MANAGEMENT =============

  @Get('slow-sync/vehicles/:vehicleId/count-points')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Broji GPS tačke za vozilo u TimescaleDB' })
  @ApiParam({ name: 'vehicleId', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Broj GPS tačaka u TimescaleDB',
  })
  async countVehiclePoints(@Param('vehicleId') vehicleId: string): Promise<any> {
    try {
      const id = parseInt(vehicleId);
      this.logger.log(`Counting GPS points for vehicle ${id} in TimescaleDB`);
      
      // Konektuj se na TimescaleDB
      const { Client } = require('pg');
      const pgClient = new Client({
        connectionString: process.env.TIMESCALE_DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      await pgClient.connect();
      
      try {
        // Broji stvaran broj tačaka u TimescaleDB
        const countResult = await pgClient.query(
          'SELECT COUNT(*) as count FROM gps_data WHERE vehicle_id = $1',
          [id]
        );
        
        const count = parseInt(countResult.rows[0]?.count || '0');
        
        // Ažuriraj u bazi
        await this.slowSyncService['prisma'].smartSlowSyncVehicle.update({
          where: { vehicleId: id },
          data: {
            uniquePointsInDb: BigInt(count),
            lastPointsCheck: new Date(),
          },
        });
        
        this.logger.log(`Vehicle ${id} has ${count} unique GPS points in TimescaleDB`);
        
        return {
          vehicleId: id,
          uniquePointsInDb: count,
          lastPointsCheck: new Date(),
        };
      } finally {
        await pgClient.end();
      }
    } catch (error) {
      this.logger.error(`Error counting points for vehicle ${vehicleId}`, error);
      throw error;
    }
  }

  @Get('slow-sync/vehicles')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Dobavi listu vozila za Smart Slow Sync' })
  @ApiResponse({
    status: 200,
    description: 'Lista vozila u Smart Slow Sync sistemu',
  })
  async getSlowSyncVehicles(): Promise<any[]> {
    try {
      const vehicles = await this.slowSyncService['prisma'].smartSlowSyncVehicle.findMany({
        include: {
          vehicle: {
            select: {
              id: true,
              garageNumber: true,
              vehicleModel: true,
              registrationNumber: true,
            },
          },
        },
        orderBy: [
          { enabled: 'desc' },
          { priority: 'desc' },
          { lastSyncAt: 'asc' },
        ],
      });
      
      // Konvertuj BigInt u string za JSON serijalizaciju
      return vehicles.map(v => ({
        ...v,
        totalPointsProcessed: v.totalPointsProcessed.toString(),
        uniquePointsInDb: v.uniquePointsInDb.toString(),
      }));
    } catch (error) {
      this.logger.error('Error fetching slow sync vehicles', error);
      throw error;
    }
  }

  @Post('slow-sync/vehicles')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Dodaj vozila u Smart Slow Sync' })
  @ApiBody({ 
    schema: { 
      properties: { 
        vehicleIds: { 
          type: 'array', 
          items: { type: 'number' },
          description: 'Lista ID-jeva vozila'
        },
        priority: {
          type: 'number',
          default: 100,
          description: 'Prioritet (viši broj = viši prioritet)'
        }
      } 
    } 
  })
  @ApiResponse({
    status: 200,
    description: 'Vozila dodata u Smart Slow Sync',
  })
  async addSlowSyncVehicles(
    @Body() dto: { vehicleIds: number[]; priority?: number }
  ): Promise<{ message: string; added: number }> {
    try {
      const priority = dto.priority || 100;
      let added = 0;
      
      for (const vehicleId of dto.vehicleIds) {
        try {
          await this.slowSyncService['prisma'].smartSlowSyncVehicle.create({
            data: {
              vehicleId,
              priority,
              enabled: true,
            },
          });
          added++;
        } catch (error) {
          // Ignoriši ako već postoji
          if (error.code !== 'P2002') {
            throw error;
          }
        }
      }
      
      return { 
        message: `Dodato ${added} vozila u Smart Slow Sync`,
        added 
      };
    } catch (error) {
      this.logger.error('Error adding slow sync vehicles', error);
      throw error;
    }
  }

  @Patch('slow-sync/vehicles/:vehicleId')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Ažuriraj postavke vozila u Smart Slow Sync' })
  @ApiBody({ 
    schema: { 
      properties: { 
        enabled: { type: 'boolean' },
        priority: { type: 'number' }
      } 
    } 
  })
  @ApiResponse({
    status: 200,
    description: 'Postavke vozila ažurirane',
  })
  async updateSlowSyncVehicle(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: { enabled?: boolean; priority?: number }
  ): Promise<{ message: string }> {
    try {
      await this.slowSyncService['prisma'].smartSlowSyncVehicle.update({
        where: { vehicleId: parseInt(vehicleId) },
        data: dto,
      });
      
      return { message: 'Postavke vozila ažurirane' };
    } catch (error) {
      this.logger.error('Error updating slow sync vehicle', error);
      throw error;
    }
  }

  @Delete('slow-sync/vehicles/:vehicleId')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Ukloni vozilo iz Smart Slow Sync' })
  @ApiResponse({
    status: 200,
    description: 'Vozilo uklonjeno iz Smart Slow Sync',
  })
  async removeSlowSyncVehicle(
    @Param('vehicleId') vehicleId: string
  ): Promise<{ message: string }> {
    try {
      await this.slowSyncService['prisma'].smartSlowSyncVehicle.delete({
        where: { vehicleId: parseInt(vehicleId) },
      });
      
      return { message: 'Vozilo uklonjeno iz Smart Slow Sync' };
    } catch (error) {
      this.logger.error('Error removing slow sync vehicle', error);
      throw error;
    }
  }

  @Get('slow-sync/history')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Dobavi istoriju Smart Slow Sync-a' })
  @ApiQuery({ name: 'vehicleId', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Istorija Smart Slow Sync-a',
  })
  async getSlowSyncHistory(
    @Query('vehicleId') vehicleId?: string,
    @Query('limit') limit?: string
  ): Promise<any[]> {
    try {
      const history = await this.slowSyncService['prisma'].smartSlowSyncHistory.findMany({
        where: vehicleId ? { vehicleId: parseInt(vehicleId) } : undefined,
        orderBy: { startedAt: 'desc' },
        take: limit ? parseInt(limit) : 50,
        include: {
          syncVehicle: {
            include: {
              vehicle: {
                select: {
                  garageNumber: true,
                  vehicleModel: true,
                },
              },
            },
          },
        },
      });
      
      return history;
    } catch (error) {
      this.logger.error('Error fetching slow sync history', error);
      throw error;
    }
  }

  @Get('slow-sync/available-vehicles')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Dobavi vozila koja nisu u Smart Slow Sync' })
  @ApiResponse({
    status: 200,
    description: 'Lista dostupnih vozila',
  })
  async getAvailableVehiclesForSlowSync(): Promise<any[]> {
    try {
      // Prvo dobavi ID-jeve vozila koja su već u slow sync
      const existingVehicles = await this.slowSyncService['prisma'].smartSlowSyncVehicle.findMany({
        select: { vehicleId: true },
      });
      const existingIds = existingVehicles.map(v => v.vehicleId);
      
      // Dobavi sva vozila koja nisu u slow sync
      const availableVehicles = await this.slowSyncService['prisma'].busVehicle.findMany({
        where: {
          active: true,
          legacyId: { not: null },
          id: { notIn: existingIds },
        },
        select: {
          id: true,
          garageNumber: true,
          vehicleModel: true,
          registrationNumber: true,
        },
        orderBy: { garageNumber: 'asc' },
      });
      
      return availableVehicles;
    } catch (error) {
      this.logger.error('Error fetching available vehicles', error);
      throw error;
    }
  }

  /**
   * 🔴 FIX: Health check endpoint za monitoring Smart Slow Sync stanja
   */
  @Get('smart-slow-sync/health')
  @RequirePermissions('legacy.sync:view')
  @ApiOperation({ summary: 'Health check za Smart Slow Sync' })
  @ApiResponse({
    status: 200,
    description: 'Health status Smart Slow Sync sistema',
  })
  async getSmartSlowSyncHealth(): Promise<any> {
    try {
      const progress = await this.slowSyncService.getProgress();
      const config = await this.slowSyncService.getConfig();
      
      // Pristup privatnim properti-ima preko bracket notacije
      const isRunning = this.slowSyncService['isRunning'];
      const isPaused = this.slowSyncService['isPaused'];
      
      // Proveri konzistentnost
      const isConsistent = !(isRunning && progress?.status === 'completed');
      
      return {
        isRunning,
        isPaused,
        progress,
        config,
        timestamp: new Date(),
        isConsistent,
        warning: !isConsistent 
          ? 'Nekonzistentno stanje - isRunning=true ali status=completed' 
          : null,
        healthStatus: isConsistent ? 'healthy' : 'unhealthy',
      };
    } catch (error) {
      this.logger.error('Error getting Smart Slow Sync health', error);
      throw error;
    }
  }

  /**
   * 🔴 FIX: Force reset endpoint za emergency situacije
   */
  @Post('smart-slow-sync/force-reset')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Force reset Smart Slow Sync sistema' })
  @ApiResponse({
    status: 200,
    description: 'Sistem je uspešno resetovan',
  })
  async forceResetSmartSlowSync(): Promise<any> {
    this.logger.warn('Force reset Smart Slow Sync requested');
    
    try {
      // Force reset sve - pristup privatnim properti-ima
      this.slowSyncService['isRunning'] = false;
      this.slowSyncService['isPaused'] = false;
      
      // Resetuj progress
      await this.slowSyncService.resetProgress();
      
      // Obriši isRunning iz baze
      await this.slowSyncService['setSetting']('smart_slow_sync.is_running', false);
      
      this.logger.log('Smart Slow Sync je force resetovan');
      
      return {
        success: true,
        message: 'Smart Slow Sync je uspešno force resetovan',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error during force reset', error);
      throw error;
    }
  }

  // ============= COPY METHOD CONFIGURATION ENDPOINTS =============

  @Get('config/copy')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Dobavi COPY konfiguraciju' })
  @ApiResponse({
    status: 200,
    description: 'COPY konfiguracija',
    type: CopyConfigResponseDto
  })
  async getCopyConfig(): Promise<CopyConfigResponseDto> {
    try {
      const config = await this.workerPoolService.getWorkerPoolConfig();
      
      // Proceni brzinu na osnovu metode
      const estimatedSpeed = config.insertMethod === 'copy' ? 8000 : 
                            config.insertMethod === 'auto' ? 5000 : 
                            2000;
      
      // Preporuči metodu na osnovu trenutnih podešavanja
      const recommendedMethod = (config.copyBatchSize || 10000) >= 10000 ? 'copy' : 'batch';
      
      return {
        insertMethod: config.insertMethod || 'batch',
        copyBatchSize: config.copyBatchSize || 10000,
        fallbackToBatch: config.fallbackToBatch !== false,
        estimatedSpeed,
        recommendedMethod
      };
    } catch (error) {
      this.logger.error('Error getting COPY config', error);
      throw error;
    }
  }

  @Patch('config/copy')
  @RequirePermissions('legacy.sync:configure')
  @ApiOperation({ summary: 'Ažuriraj COPY konfiguraciju' })
  @ApiBody({ type: CopyConfigDto })
  @ApiResponse({
    status: 200,
    description: 'Konfiguracija ažurirana',
    type: CopyConfigResponseDto
  })
  async updateCopyConfig(@Body() dto: CopyConfigDto): Promise<CopyConfigResponseDto> {
    try {
      // Sačuvaj u SystemSettings koristeći Prisma
      const prisma = (this.workerPoolService as any).prisma;
      
      await prisma.systemSettings.upsert({
        where: { key: 'legacy_sync.insert_method' },
        update: { value: dto.insertMethod },
        create: {
          key: 'legacy_sync.insert_method',
          value: dto.insertMethod,
          type: 'string',
          category: 'legacy_sync',
          description: 'Metoda za insert podataka (batch/copy/auto)'
        }
      });
      
      if (dto.copyBatchSize !== undefined) {
        await prisma.systemSettings.upsert({
          where: { key: 'legacy_sync.copy_batch_size' },
          update: { value: dto.copyBatchSize.toString() },
          create: {
            key: 'legacy_sync.copy_batch_size',
            value: dto.copyBatchSize.toString(),
            type: 'number',
            category: 'legacy_sync',
            description: 'Veličina batch-a za COPY metodu'
          }
        });
      }
      
      if (dto.fallbackToBatch !== undefined) {
        await prisma.systemSettings.upsert({
          where: { key: 'legacy_sync.fallback_to_batch' },
          update: { value: dto.fallbackToBatch.toString() },
          create: {
            key: 'legacy_sync.fallback_to_batch',
            value: dto.fallbackToBatch.toString(),
            type: 'boolean',
            category: 'legacy_sync',
            description: 'Fallback na batch ako COPY fail-uje'
          }
        });
      }
      
      // Reload konfiguraciju u servisu
      await (this.workerPoolService as any).loadConfiguration();
      
      this.logger.log('COPY konfiguracija ažurirana', dto);
      
      // Vrati ažuriranu konfiguraciju
      return this.getCopyConfig();
    } catch (error) {
      this.logger.error('Greška pri ažuriranju COPY konfiguracije', error);
      throw error;
    }
  }
}