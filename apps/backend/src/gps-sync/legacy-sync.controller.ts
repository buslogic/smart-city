import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { LegacySyncService } from './legacy-sync.service';
import { LegacySyncWorkerPoolService } from './legacy-sync-worker-pool.service';
import { IsArray, IsDateString, IsNumber } from 'class-validator';

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

@ApiTags('Legacy GPS Sync')
@ApiBearerAuth()
@Controller('legacy-sync')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LegacySyncController {
  private readonly logger = new Logger(LegacySyncController.name);

  constructor(
    private readonly legacySyncService: LegacySyncService,
    private readonly workerPoolService: LegacySyncWorkerPoolService
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
}