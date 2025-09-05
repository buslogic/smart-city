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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { LegacySyncService } from './legacy-sync.service';
import { LegacySyncWorkerPoolService } from './legacy-sync-worker-pool.service';
import { SmartSlowSyncService, SlowSyncPreset, SlowSyncConfig, SlowSyncProgress } from './smart-slow-sync.service';
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
  syncDaysBack?: number;

  @IsBoolean()
  @IsOptional()
  autoCleanup?: boolean;
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
  @RequirePermissions('legacy_sync.view')
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
  @RequirePermissions('legacy_sync.start')
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
        new Date(dto.sync_to)
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
  @RequirePermissions('legacy_sync.view')
  @ApiOperation({ summary: 'Dobavi status trenutnih sinhronizacija' })
  @ApiQuery({ name: 'job_id', required: false })
  @ApiResponse({
    status: 200,
    description: 'Status sinhronizacije po vozilu',
    type: [SyncProgressDto],
  })
  async getSyncProgress(@Query('job_id') jobId?: string): Promise<SyncProgressDto[]> {
    try {
      return await this.legacySyncService.getSyncProgress(jobId);
    } catch (error) {
      this.logger.error('Error fetching sync progress', error);
      throw error;
    }
  }

  @Post('stop')
  @RequirePermissions('legacy_sync.stop')
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

  @Get('test-connection')
  @RequirePermissions('legacy_sync.view')
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

  @Get('worker-status')
  @RequirePermissions('legacy_sync.view')
  @ApiOperation({ summary: 'Dobavi status Worker Pool-a' })
  @ApiResponse({
    status: 200,
    description: 'Status aktivnih worker-a',
  })
  async getWorkerStatus(): Promise<{ 
    enabled: boolean;
    activeWorkers: number;
    maxWorkers: number;
    workers: any[];
  }> {
    try {
      const isEnabled = await this.legacySyncService['shouldUseWorkerPool']();
      const workers = this.workerPoolService.getWorkerStatuses();
      const activeCount = this.workerPoolService.getActiveWorkerCount();
      
      return {
        enabled: isEnabled,
        activeWorkers: activeCount,
        maxWorkers: 3, // TODO: Učitati iz konfiguracije
        workers: workers
      };
    } catch (error) {
      this.logger.error('Error getting worker status', error);
      return {
        enabled: false,
        activeWorkers: 0,
        maxWorkers: 0,
        workers: []
      };
    }
  }

  @Post('worker-pool/toggle')
  @RequirePermissions('legacy_sync.manage')
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
  @RequirePermissions('legacy_sync.manage')
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
  @RequirePermissions('legacy_sync.manage')
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
  @RequirePermissions('legacy_sync.manage')
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
  @RequirePermissions('legacy_sync.manage')
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
  @RequirePermissions('legacy_sync.view')
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
  @RequirePermissions('legacy_sync.view')
  @ApiOperation({ summary: 'Dobavi trenutnu konfiguraciju Smart Slow Sync-a' })
  @ApiResponse({
    status: 200,
    description: 'Konfiguracija Smart Slow Sync-a',
  })
  async getSlowSyncConfig(): Promise<SlowSyncConfig> {
    try {
      return await this.slowSyncService['currentConfig'];
    } catch (error) {
      this.logger.error('Error getting slow sync config', error);
      throw error;
    }
  }

  @Patch('slow-sync/config')
  @RequirePermissions('legacy_sync.manage')
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
  @RequirePermissions('legacy_sync.manage')
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
  @RequirePermissions('legacy_sync.manage')
  @ApiOperation({ summary: 'Ručno pokreni jedan batch (za testiranje)' })
  @ApiResponse({
    status: 200,
    description: 'Batch procesiran',
  })
  async processSlowSyncBatch(): Promise<{ message: string }> {
    try {
      this.logger.log('Manually triggering batch processing');
      await this.slowSyncService.processBatch();
      return { message: 'Batch je procesiran' };
    } catch (error) {
      this.logger.error('Error processing batch', error);
      throw error;
    }
  }
}