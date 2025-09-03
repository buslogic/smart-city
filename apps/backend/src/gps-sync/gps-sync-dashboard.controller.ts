import { 
  Controller, 
  Get, 
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('GPS Sync Dashboard')
@ApiBearerAuth()
@Controller('gps-sync-dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GpsSyncDashboardController {
  constructor(private readonly prisma: PrismaService) {}

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
    const avgProcessingTime = await this.prisma.$queryRaw<{ avg_time: number }[]>`
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
      averageProcessingTime: avgProcessingTime[0]?.avg_time || 0,
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

    const [
      last24hStats,
      lastHourStats,
      errorStats
    ] = await Promise.all([
      // Statistike za zadnjih 24 sata
      this.prisma.$queryRaw<{ 
        total: bigint;
        processed: bigint;
        errors: bigint;
      }[]>`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN process_status = 'processed' THEN 1 ELSE 0 END) as processed,
          SUM(CASE WHEN process_status = 'error' THEN 1 ELSE 0 END) as errors
        FROM gps_raw_buffer
        WHERE received_at >= ${last24h}
      `,
      
      // Statistike za zadnji sat
      this.prisma.$queryRaw<{ 
        total: bigint;
        processed: bigint;
        rate: number;
      }[]>`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN process_status = 'processed' THEN 1 ELSE 0 END) as processed,
          COUNT(*) / 60.0 as rate
        FROM gps_raw_buffer
        WHERE received_at >= ${last1h}
      `,
      
      // Top greške
      this.prisma.$queryRaw<Array<{ 
        error_message: string;
        count: bigint;
      }>>`
        SELECT 
          error_message,
          COUNT(*) as count
        FROM gps_raw_buffer
        WHERE process_status = 'error'
        AND received_at >= ${last24h}
        AND error_message IS NOT NULL
        GROUP BY error_message
        ORDER BY count DESC
        LIMIT 5
      `
    ]);

    return {
      last24Hours: {
        total: Number(last24hStats[0]?.total || 0),
        processed: Number(last24hStats[0]?.processed || 0),
        errors: Number(last24hStats[0]?.errors || 0),
        successRate: last24hStats[0]?.total > 0 
          ? (Number(last24hStats[0]?.processed) / Number(last24hStats[0]?.total) * 100).toFixed(2)
          : 0
      },
      lastHour: {
        total: Number(lastHourStats[0]?.total || 0),
        processed: Number(lastHourStats[0]?.processed || 0),
        recordsPerMinute: Number(lastHourStats[0]?.rate || 0).toFixed(2)
      },
      topErrors: errorStats.map(e => ({
        message: e.error_message,
        count: Number(e.count)
      })),
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
}