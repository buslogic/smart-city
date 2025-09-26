import { Controller, Get, Post, UseGuards, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { MigrationService } from './migration.service';
import { MigrationParallelService } from './migration-parallel.service';

@ApiTags('Migration')
@Controller('migration')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class MigrationController {
  constructor(
    private readonly migrationService: MigrationService,
    private readonly parallelService: MigrationParallelService,
  ) {}

  @Get('status')
  @RequirePermissions('system:view')
  @ApiOperation({ summary: 'Proveri status timezone migracije' })
  @ApiResponse({
    status: 200,
    description: 'Status migracije',
    schema: {
      example: {
        status: 'running',
        progressPercent: 45.23,
        recordsMigrated: 137000000,
        estimatedTotal: 304000000,
        currentDate: '2025-08-15',
        runningTime: '12:34:56',
        recordsPerSecond: 3500,
        eta: '24:15:00',
        lastLogs: [],
      },
    },
  })
  async getStatus() {
    return this.migrationService.getMigrationStatus();
  }

  @Post('start')
  @RequirePermissions('system:manage')
  @ApiOperation({ summary: 'Pokreni timezone migraciju' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          format: 'date',
          example: '2025-06-16',
          description: 'Početni datum za migraciju (YYYY-MM-DD)',
        },
        endDate: {
          type: 'string',
          format: 'date',
          example: '2025-06-18',
          description: 'Krajnji datum za migraciju (YYYY-MM-DD)',
        },
        resume: {
          type: 'boolean',
          default: false,
          description:
            'Nastavi prekinutu migraciju od poslednjeg obrađenog datuma',
        },
        useParallel: {
          type: 'boolean',
          default: true,
          description:
            'Koristi paralelnu migraciju po vremenskim intervalima (4-6x brže)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Migracija pokrenuta',
    schema: {
      example: {
        success: true,
        message: 'Migration started successfully',
        startDate: '2025-06-16',
        endDate: '2025-09-16',
        mode: 'parallel',
      },
    },
  })
  async startMigration(
    @Body()
    body?: {
      startDate?: string;
      endDate?: string;
      resume?: boolean;
      useParallel?: boolean;
    },
  ) {
    console.log('=== CONTROLLER: Migration start endpoint called ===');
    console.log('Request body:', JSON.stringify(body));
    console.log('Start date:', body?.startDate);
    console.log('End date:', body?.endDate);
    console.log('Resume:', body?.resume);
    console.log('Use parallel:', body?.useParallel);

    try {
      const result = await this.migrationService.startMigration(
        body?.startDate,
        body?.endDate,
        body?.resume || false,
        body?.useParallel !== false, // Default true
      );
      console.log('Controller result:', result);
      return result;
    } catch (error) {
      console.error('Controller error:', error);
      throw error;
    }
  }

  @Post('abort')
  @RequirePermissions('system:manage')
  @ApiOperation({ summary: 'Prekini timezone migraciju' })
  @ApiResponse({
    status: 200,
    description: 'Migracija prekinuta',
    schema: {
      example: {
        success: true,
        message: 'Migration aborted',
      },
    },
  })
  async abortMigration() {
    return this.migrationService.abortMigration();
  }

  @Get('verify')
  @RequirePermissions('system:view')
  @ApiOperation({ summary: 'Verifikuj migriranu tabelu' })
  @ApiResponse({
    status: 200,
    description: 'Rezultati verifikacije',
    schema: {
      example: {
        checks: [
          {
            checkName: 'Record Count',
            originalValue: '304000000',
            fixedValue: '304000000',
            status: 'OK',
          },
        ],
      },
    },
  })
  async verifyMigration() {
    return this.migrationService.verifyMigration();
  }

  @Get('logs')
  @RequirePermissions('system:view')
  @ApiOperation({ summary: 'Dohvati poslednje logove migracije' })
  @ApiResponse({
    status: 200,
    description: 'Lista logova',
    schema: {
      example: {
        logs: [
          {
            id: 1,
            action: 'DAY_COMPLETED',
            message: 'Date 2025-08-01 migrated: 3500000 records',
            recordsAffected: 3500000,
            createdAt: '2025-09-16T10:30:00Z',
          },
        ],
      },
    },
  })
  async getLogs() {
    return this.migrationService.getMigrationLogs();
  }

  @Get('range-progress/:date')
  @RequirePermissions('system:view')
  @ApiOperation({
    summary:
      'Proveri napredak migracije po vremenskim intervalima za određeni dan',
  })
  @ApiParam({
    name: 'date',
    type: 'string',
    format: 'date',
    example: '2025-09-16',
    description: 'Datum za koji se proverava napredak (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Napredak po range-ovima',
    schema: {
      example: {
        ranges: [
          {
            rangeName: 'Part_1_00:00-06:00',
            startTime: '2025-09-16T00:00:00',
            endTime: '2025-09-16T06:00:00',
            estimatedRecords: 4250000,
            migratedRecords: 4250000,
            progressPercent: 100.0,
          },
          {
            rangeName: 'Part_2_06:00-12:00',
            startTime: '2025-09-16T06:00:00',
            endTime: '2025-09-16T12:00:00',
            estimatedRecords: 5100000,
            migratedRecords: 2500000,
            progressPercent: 49.02,
          },
        ],
      },
    },
  })
  async getRangeProgress(@Param('date') date: string) {
    const ranges = await this.parallelService.checkRangeProgress(date);
    return { date, ranges };
  }
}
