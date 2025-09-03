import { 
  Controller, 
  Get, 
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('GPS Sync Dashboard')
@ApiBearerAuth()
@Controller('gps-sync-dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GpsSyncDashboardController {
  private readonly logger = new Logger(GpsSyncDashboardController.name);
  private static cronLastRun = {
    processor: null as Date | null,
    cleanup: null as Date | null,
    statsCleanup: null as Date | null
  };
  
  constructor(private readonly prisma: PrismaService) {}
  
  // Metoda koju će pozivati cron servisi da ažuriraju svoje vreme
  static updateCronLastRun(cronName: 'processor' | 'cleanup' | 'statsCleanup') {
    this.cronLastRun[cronName] = new Date();
  }

  @Get('buffer-status')
  @RequirePermissions('dispatcher:view_sync_dashboard')
  @ApiOperation({ summary: 'Status GPS buffer tabele' })
  @ApiResponse({ 
    status: 200, 
    description: 'Status buffer tabele',
    schema: {
      type: 'object',
      properties: {
        totalRecords: { type: 'number', description: 'Ukupan broj slogova u buffer tabeli' },
        pendingRecords: { type: 'number', description: 'Broj slogova za procesiranje' },
        processedRecords: { type: 'number', description: 'Broj procesiranih slogova' },
        errorRecords: { type: 'number', description: 'Broj slogova sa greškama' },
        oldestRecord: { type: 'string', format: 'date-time', description: 'Najstariji slog' },
        newestRecord: { type: 'string', format: 'date-time', description: 'Najnoviji slog' },
        lastProcessedAt: { type: 'string', format: 'date-time', description: 'Vreme poslednjeg procesiranja' },
        recordsByStatus: {
          type: 'object',
          properties: {
            pending: { type: 'number' },
            processing: { type: 'number' },
            processed: { type: 'number' },
            error: { type: 'number' }
          }
        },
        vehicleCount: { type: 'number', description: 'Broj jedinstvenih vozila' },
        averageProcessingTime: { type: 'number', description: 'Prosečno vreme procesiranja (ms)' }
      }
    }
  })
  async getBufferStatus() {
    // Dobijanje statistika iz gps_raw_buffer tabele
    const [
      totalCount,
      statusCounts,
      oldestRecord,
      newestRecord,
      vehicleCount,
      lastProcessed
    ] = await Promise.all([
      // Ukupan broj slogova
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM gps_raw_buffer
      `,
      
      // Broj slogova po statusu
      this.prisma.$queryRaw<Array<{ process_status: string; count: bigint }>>`
        SELECT process_status, COUNT(*) as count 
        FROM gps_raw_buffer 
        GROUP BY process_status
      `,
      
      // Najstariji slog
      this.prisma.$queryRaw<{ received_at: Date }[]>`
        SELECT received_at 
        FROM gps_raw_buffer 
        WHERE process_status = 'pending'
        ORDER BY received_at ASC 
        LIMIT 1
      `,
      
      // Najnoviji slog
      this.prisma.$queryRaw<{ received_at: Date }[]>`
        SELECT received_at 
        FROM gps_raw_buffer 
        ORDER BY received_at DESC 
        LIMIT 1
      `,
      
      // Broj jedinstvenih vozila
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT vehicle_id) as count 
        FROM gps_raw_buffer 
        WHERE process_status = 'pending'
      `,
      
      // Poslednje procesiranje
      this.prisma.$queryRaw<{ processed_at: Date }[]>`
        SELECT MAX(processed_at) as processed_at 
        FROM gps_raw_buffer 
        WHERE process_status = 'processed'
      `
    ]);

    // Organizovanje statusa
    const recordsByStatus = {
      pending: 0,
      processing: 0,
      processed: 0,
      error: 0
    };

    statusCounts.forEach((status) => {
      recordsByStatus[status.process_status] = Number(status.count);
    });

    // Računanje prosečnog vremena procesiranja (zadnjih 100 procesiranih)
    const avgProcessingTime = await this.prisma.$queryRaw<{ avg_time: number | null }[]>`
      SELECT AVG(TIMESTAMPDIFF(MICROSECOND, received_at, processed_at)) / 1000 as avg_time
      FROM (
        SELECT received_at, processed_at 
        FROM gps_raw_buffer 
        WHERE process_status = 'processed' 
        AND processed_at IS NOT NULL
        ORDER BY processed_at DESC 
        LIMIT 100
      ) as recent_processed
    `;

    // Konvertuj avg_time u broj
    let avgTime = 0;
    if (avgProcessingTime[0]?.avg_time !== null) {
      avgTime = parseFloat(avgProcessingTime[0].avg_time.toString());
      if (!isNaN(avgTime)) {
        avgTime = Math.round(avgTime);
      } else {
        avgTime = 0;
      }
    }

    return {
      totalRecords: Number(totalCount[0]?.count || 0),
      pendingRecords: recordsByStatus.pending,
      processedRecords: recordsByStatus.processed,
      errorRecords: recordsByStatus.error,
      oldestRecord: oldestRecord[0]?.received_at || null,
      newestRecord: newestRecord[0]?.received_at || null,
      lastProcessedAt: lastProcessed[0]?.processed_at || null,
      recordsByStatus,
      vehicleCount: Number(vehicleCount[0]?.count || 0),
      averageProcessingTime: avgTime,
      timestamp: new Date()
    };
  }

  @Get('processing-stats')
  @RequirePermissions('dispatcher:view_sync_dashboard')
  @ApiOperation({ summary: 'Statistike procesiranja GPS podataka' })
  @ApiResponse({ 
    status: 200, 
    description: 'Statistike procesiranja'
  })
  async getProcessingStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last1h = new Date(now.getTime() - 60 * 60 * 1000);

    // Dohvati statistike iz stats tabele za 24h
    const processedStats24h = await this.prisma.$queryRaw<{ 
      total_received: bigint;
      total_processed: bigint;
      avg_time: number;
    }[]>`
      SELECT 
        COALESCE(SUM(received_count), 0) as total_received,
        COALESCE(SUM(processed_count), 0) as total_processed,
        COALESCE(AVG(avg_processing_time_ms), 0) as avg_time
      FROM gps_processing_stats
      WHERE hour_slot >= ${last24h}
    `;
    
    // Dohvati trenutno pending i error iz buffer-a
    const currentBufferStats = await this.prisma.$queryRaw<{ 
      pending: bigint;
      errors: bigint;
    }[]>`
      SELECT 
        SUM(CASE WHEN process_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN process_status = 'error' THEN 1 ELSE 0 END) as errors
      FROM gps_raw_buffer
    `;
    
    // Za zadnji sat - gledaj samo buffer
    const lastHourStats = await this.prisma.$queryRaw<{ 
      total: bigint;
    }[]>`
      SELECT COUNT(*) as total
      FROM gps_raw_buffer
      WHERE received_at >= ${last1h}
    `;
    
    // Processed u zadnjem satu iz stats tabele
    const lastHourProcessed = await this.prisma.$queryRaw<{ 
      processed: bigint;
    }[]>`
      SELECT COALESCE(SUM(processed_count), 0) as processed
      FROM gps_processing_stats
      WHERE hour_slot >= ${last1h}
    `;
    
    // Koristi received_count kao total (koliko je stiglo sa legacy servera)
    const total24h = Number(processedStats24h[0]?.total_received || 0);
    const processed24h = Number(processedStats24h[0]?.total_processed || 0);
    const errors24h = Number(currentBufferStats[0]?.errors || 0);
    
    const totalLastHour = Number(lastHourStats[0]?.total || 0) + Number(lastHourProcessed[0]?.processed || 0);
    const processedLastHour = Number(lastHourProcessed[0]?.processed || 0);
    
    return {
      last24Hours: {
        total: total24h,
        processed: processed24h,
        errors: errors24h,
        successRate: total24h > 0 
          ? (processed24h / total24h * 100).toFixed(2)
          : '0'
      },
      lastHour: {
        total: totalLastHour,
        processed: processedLastHour,
        recordsPerMinute: (totalLastHour / 60).toFixed(2)
      },
      topErrors: [], // Za sada prazno, možemo dodati error tracking
      timestamp: new Date()
    };
  }

  @Get('timescale-status')
  @RequirePermissions('dispatcher:view_sync_dashboard')
  @ApiOperation({ summary: 'Status TimescaleDB sinhronizacije' })
  @ApiResponse({ 
    status: 200, 
    description: 'Status TimescaleDB'
  })
  async getTimescaleStatus() {
    // Ovde bi trebalo dodati logiku za proveru TimescaleDB statusa
    // Za sada vraćamo osnovne informacije
    const pendingTransfer = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count 
      FROM gps_raw_buffer 
      WHERE process_status = 'pending'
    `;

    return {
      pendingTransfer: Number(pendingTransfer[0]?.count || 0),
      timescaleConnected: true, // Ovo bi trebalo proveriti stvarnu konekciju
      lastTransferTime: new Date(), // Ovo bi trebalo čitati iz log tabele
      transferRate: "30 seconds", // Interval transfera
      timestamp: new Date()
    };
  }

  @Get('cron-status')
  @RequirePermissions('dispatcher:view_sync_dashboard')
  @ApiOperation({ summary: 'Status svih cron procesa' })
  @ApiResponse({ 
    status: 200, 
    description: 'Status cron procesa'
  })
  async getCronStatus() {
    const now = new Date();
    
    // Proveri poslednju obradu legacy processor-a
    // Gledamo poslednji zapis u buffer-u kao indikator rada legacy cron-a
    const lastLegacyActivity = await this.prisma.$queryRaw<[{ last_received: Date | null }]>`
      SELECT MAX(received_at) as last_received
      FROM gps_raw_buffer
    `;
    
    // Proveri poslednje procesiranje (backend cron)
    const lastProcessedActivity = await this.prisma.$queryRaw<[{ last_processed: Date | null }]>`
      SELECT MAX(processed_at) as last_processed
      FROM gps_raw_buffer
      WHERE process_status = 'processed'
    `;
    
    // Računaj da li su cron-ovi aktivni
    const legacyLastRun = lastLegacyActivity[0]?.last_received;
    const processorLastRun = lastProcessedActivity[0]?.last_processed;
    
    // Cron se smatra aktivnim ako je radio u zadnjih X minuta
    const isActive = (lastRun: Date | null, intervalMinutes: number) => {
      if (!lastRun) return false;
      const diffMinutes = (now.getTime() - new Date(lastRun).getTime()) / (1000 * 60);
      return diffMinutes < intervalMinutes * 2; // Duplo vreme kao tolerancija
    };
    
    return {
      cronProcesses: [
        {
          name: 'Legacy GPS Processor',
          location: 'Legacy Server (79.101.48.11)',
          schedule: 'Svakih 2 minuta',
          lastRun: legacyLastRun,
          isActive: isActive(legacyLastRun, 2),
          description: 'Filtrira i šalje GPS podatke u MySQL buffer'
        },
        {
          name: 'Backend GPS Processor',
          location: 'Backend NestJS',
          schedule: 'Svakih 30 sekundi',
          lastRun: processorLastRun,
          isActive: isActive(processorLastRun, 0.5),
          description: 'Prebacuje podatke iz buffer-a u TimescaleDB'
        },
        {
          name: 'Buffer Cleanup',
          location: 'Backend NestJS',
          schedule: 'Svakih 2 minuta',
          lastRun: GpsSyncDashboardController.cronLastRun.cleanup,
          isActive: isActive(GpsSyncDashboardController.cronLastRun.cleanup, 2),
          description: 'Briše stare processed zapise iz buffer-a'
        },
        {
          name: 'Stats Cleanup',
          location: 'Backend NestJS',
          schedule: 'Jednom dnevno u 3:00',
          lastRun: GpsSyncDashboardController.cronLastRun.statsCleanup,
          isActive: isActive(GpsSyncDashboardController.cronLastRun.statsCleanup, 1440), // 24 sata
          description: 'Briše statistike starije od 10 dana'
        }
      ],
      summary: {
        totalCrons: 4,
        activeCrons: 0, // Će se računati na frontu
        dataFlowStatus: 'operational', // ili 'degraded', 'down'
      },
      timestamp: new Date()
    };
  }
}