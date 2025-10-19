import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import * as child_process from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const exec = promisify(child_process.exec);
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
    statsCleanup: null as Date | null,
  };

  constructor(private readonly prisma: PrismaService) {}

  // Helper metoda za SSH komandu
  private getSSHCommand(): string {
    const legacyHost = process.env.LEGACY_SERVER_HOST || '79.101.48.11';
    const sshKeyPath =
      process.env.LEGACY_SSH_KEY_PATH || '~/.ssh/hp-notebook-2025-buslogic';
    return `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i ${sshKeyPath} root@${legacyHost}`;
  }

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
        totalRecords: {
          type: 'number',
          description: 'Ukupan broj slogova u buffer tabeli',
        },
        pendingRecords: {
          type: 'number',
          description: 'Broj slogova za procesiranje',
        },
        processedRecords: {
          type: 'number',
          description: 'Broj procesiranih slogova',
        },
        errorRecords: {
          type: 'number',
          description: 'Broj slogova sa greškama',
        },
        oldestRecord: {
          type: 'string',
          format: 'date-time',
          description: 'Najstariji slog',
        },
        newestRecord: {
          type: 'string',
          format: 'date-time',
          description: 'Najnoviji slog',
        },
        lastProcessedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Vreme poslednjeg procesiranja',
        },
        recordsByStatus: {
          type: 'object',
          properties: {
            pending: { type: 'number' },
            processing: { type: 'number' },
            processed: { type: 'number' },
            error: { type: 'number' },
          },
        },
        vehicleCount: {
          type: 'number',
          description: 'Broj jedinstvenih vozila',
        },
        averageProcessingTime: {
          type: 'number',
          description: 'Prosečno vreme procesiranja (ms)',
        },
        stuckProcessingRecords: {
          type: 'number',
          description: 'Broj processing slogova koji su stuck (stariji od 10 min)',
        },
        stuckProcessingOldest: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Datum najstarijeg stuck processing sloga',
        },
      },
    },
  })
  async getBufferStatus() {
    // Dobijanje statistika iz gps_raw_buffer tabele
    const [
      statusCounts,
      oldestRecord,
      newestRecord,
      vehicleCount,
      lastProcessed,
    ] = await Promise.all([
      // OPTIMIZOVANO: Samo jedan query za status count (koristi idx_status_only)
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

      // OPTIMIZOVANO: Broj jedinstvenih vozila - samo prvih 1000 za brzinu
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT vehicle_id) as count 
        FROM (
          SELECT vehicle_id 
          FROM gps_raw_buffer 
          WHERE process_status = 'pending'
          LIMIT 10000
        ) as subquery
      `,

      // Poslednje procesiranje
      this.prisma.$queryRaw<{ processed_at: Date }[]>`
        SELECT MAX(processed_at) as processed_at 
        FROM gps_raw_buffer 
        WHERE process_status = 'processed'
      `,
    ]);

    // Organizovanje statusa iz prvog query-ja
    const recordsByStatus = {
      pending: 0,
      processing: 0,
      processed: 0,
      error: 0,
    };

    // Računaj ukupan broj iz statusCounts
    let totalRecords = 0;
    statusCounts.forEach((status) => {
      const statusKey = status.process_status;
      const count = Number(status.count);

      // Mapiraj 'failed' status u 'error' za frontend
      if (statusKey === 'failed') {
        recordsByStatus.error += count;
      } else if (recordsByStatus[statusKey] !== undefined) {
        recordsByStatus[statusKey] += count;
      }

      totalRecords += count;
    });

    // OPTIMIZOVANO: Prosečno vreme - samo poslednji 100 zapisa za brzinu
    const avgProcessingTime = await this.prisma.$queryRaw<
      { avg_time: number | null }[]
    >`
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

    // Dodaj statistike procesiranja za procentualni prikaz
    // Gledamo poslednji sat za realističnije brojeve
    const lastHour = new Date(new Date().getTime() - 60 * 60 * 1000);
    const hourStats = await this.prisma.$queryRaw<
      {
        total_processed: bigint;
        avg_timescale_time: number;
      }[]
    >`
      SELECT 
        COALESCE(SUM(processed_count), 0) as total_processed,
        COALESCE(AVG(avg_processing_time_ms), 0) as avg_timescale_time
      FROM gps_processing_stats
      WHERE hour_slot >= ${lastHour}
    `;

    const totalProcessedHour = Number(hourStats[0]?.total_processed || 0);
    const avgTimescaleTime = Math.round(hourStats[0]?.avg_timescale_time || 0);

    // Detektuj stuck processing slogove (starije od 10 minuta)
    const stuckThresholdMinutes = 10;
    const stuckThreshold = new Date(
      new Date().getTime() - stuckThresholdMinutes * 60 * 1000,
    );

    const stuckProcessing = await this.prisma.$queryRaw<
      { count: bigint; oldest: Date | null }[]
    >`
      SELECT
        COUNT(*) as count,
        MIN(processed_at) as oldest
      FROM gps_raw_buffer
      WHERE process_status = 'processing'
        AND processed_at < ${stuckThreshold}
    `;

    const stuckProcessingRecords = Number(stuckProcessing[0]?.count || 0);
    const stuckProcessingOldest = stuckProcessing[0]?.oldest || null;

    // Dodaj stuck processing u error count
    const totalErrorRecords = recordsByStatus.error + stuckProcessingRecords;

    // Računaj procenat procesiranja (pendingRecords vs processed u zadnjem satu)
    let processingPercent = 0;
    if (totalRecords > 0) {
      // Ako imamo pending, pokazujemo koliko je ostalo za procesiranje
      if (recordsByStatus.pending > 0) {
        processingPercent = Math.round(
          ((totalRecords - recordsByStatus.pending) / totalRecords) * 100,
        );
      } else {
        // Ako nema pending, sve je procesirano
        processingPercent = 100;
      }
    }

    return {
      totalRecords: totalRecords,
      pendingRecords: recordsByStatus.pending,
      processedRecords: recordsByStatus.processed,
      errorRecords: totalErrorRecords, // Uključuje failed + stuck processing
      oldestRecord: oldestRecord[0]?.received_at || null,
      newestRecord: newestRecord[0]?.received_at || null,
      lastProcessedAt: lastProcessed[0]?.processed_at || null,
      recordsByStatus,
      vehicleCount: Number(vehicleCount[0]?.count || 0),
      averageProcessingTime: avgTime,
      totalProcessedLastHour: totalProcessedHour,
      averageTimescaleInsertTime: avgTimescaleTime,
      processingPercent: processingPercent,
      stuckProcessingRecords, // Novi field
      stuckProcessingOldest, // Novi field
      timestamp: new Date(),
    };
  }

  @Get('processing-stats')
  @RequirePermissions('dispatcher:view_sync_dashboard')
  @ApiOperation({ summary: 'Statistike procesiranja GPS podataka' })
  @ApiResponse({
    status: 200,
    description: 'Statistike procesiranja',
  })
  async getProcessingStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last1h = new Date(now.getTime() - 60 * 60 * 1000);

    // Dohvati statistike iz stats tabele za 24h
    const processedStats24h = await this.prisma.$queryRaw<
      {
        total_received: bigint;
        total_processed: bigint;
        avg_time: number;
      }[]
    >`
      SELECT 
        COALESCE(SUM(received_count), 0) as total_received,
        COALESCE(SUM(processed_count), 0) as total_processed,
        COALESCE(AVG(avg_processing_time_ms), 0) as avg_time
      FROM gps_processing_stats
      WHERE hour_slot >= ${last24h}
    `;

    // Dohvati trenutno pending i error iz buffer-a
    const currentBufferStats = await this.prisma.$queryRaw<
      {
        pending: bigint;
        errors: bigint;
      }[]
    >`
      SELECT 
        SUM(CASE WHEN process_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN process_status = 'error' THEN 1 ELSE 0 END) as errors
      FROM gps_raw_buffer
    `;

    // Za zadnji sat - gledaj samo buffer
    const lastHourStats = await this.prisma.$queryRaw<
      {
        total: bigint;
      }[]
    >`
      SELECT COUNT(*) as total
      FROM gps_raw_buffer
      WHERE received_at >= ${last1h}
    `;

    // Processed u zadnjem satu iz stats tabele
    const lastHourProcessed = await this.prisma.$queryRaw<
      {
        processed: bigint;
      }[]
    >`
      SELECT COALESCE(SUM(processed_count), 0) as processed
      FROM gps_processing_stats
      WHERE hour_slot >= ${last1h}
    `;

    // Koristi received_count kao total (koliko je stiglo sa legacy servera)
    const total24h = Number(processedStats24h[0]?.total_received || 0);
    const processed24h = Number(processedStats24h[0]?.total_processed || 0);
    const errors24h = Number(currentBufferStats[0]?.errors || 0);

    const totalLastHour =
      Number(lastHourStats[0]?.total || 0) +
      Number(lastHourProcessed[0]?.processed || 0);
    const processedLastHour = Number(lastHourProcessed[0]?.processed || 0);

    return {
      last24Hours: {
        total: total24h,
        processed: processed24h,
        errors: errors24h,
        successRate:
          total24h > 0 ? ((processed24h / total24h) * 100).toFixed(2) : '0',
      },
      lastHour: {
        total: totalLastHour,
        processed: processedLastHour,
        recordsPerMinute: (totalLastHour / 60).toFixed(2),
      },
      topErrors: [], // Za sada prazno, možemo dodati error tracking
      timestamp: new Date(),
    };
  }

  @Get('timescale-status')
  @RequirePermissions('dispatcher:view_sync_dashboard')
  @ApiOperation({ summary: 'Status TimescaleDB sinhronizacije' })
  @ApiResponse({
    status: 200,
    description: 'Status TimescaleDB',
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
      transferRate: '30 seconds', // Interval transfera
      timestamp: new Date(),
    };
  }

  @Get('cron-status')
  @RequirePermissions('dispatcher:view_sync_dashboard')
  @ApiOperation({ summary: 'Status svih cron procesa' })
  @ApiResponse({
    status: 200,
    description: 'Status cron procesa',
  })
  async getCronStatus() {
    const now = new Date();

    // Proveri poslednju obradu legacy processor-a
    // Gledamo poslednji zapis u buffer-u kao indikator rada legacy cron-a
    const lastLegacyActivity = await this.prisma.$queryRaw<
      [{ last_received: Date | null }]
    >`
      SELECT MAX(received_at) as last_received
      FROM gps_raw_buffer
    `;

    // Proveri poslednje procesiranje (backend cron)
    const lastProcessedActivity = await this.prisma.$queryRaw<
      [{ last_processed: Date | null }]
    >`
      SELECT MAX(processed_at) as last_processed
      FROM gps_raw_buffer
      WHERE process_status = 'processed'
    `;

    // Računaj da li su cron-ovi aktivni
    const legacyLastRun = lastLegacyActivity[0]?.last_received;
    const processorLastRun = lastProcessedActivity[0]?.last_processed;

    // Proveri backend cron status
    const {
      GpsProcessorService,
    } = require('../gps-processor/gps-processor.service');
    const backendCronStatus = GpsProcessorService.getCronStatus();

    // Cron se smatra aktivnim ako je radio u zadnjih X minuta
    const isActive = (lastRun: Date | null, intervalMinutes: number) => {
      if (!lastRun) return false;
      const diffMinutes =
        (now.getTime() - new Date(lastRun).getTime()) / (1000 * 60);
      return diffMinutes < intervalMinutes * 2; // Duplo vreme kao tolerancija
    };

    // Generiši legacy procesore za teltonika60-76
    const legacyProcessors: any[] = [];

    // SSH komande za dobijanje podataka sa legacy servera
    let activeScreenSessions: number[] = [];
    let activeCronJobs: number[] = [];
    const activeConnections: Map<number, number> = new Map();
    const rawLogSizes: Map<number, string> = new Map();
    const lastCronRuns: Map<number, Date | null> = new Map();

    // Proveri da li su SSH komande omogućene (disabled u Docker kontejnerima)
    const sshEnabled = process.env.ENABLE_SSH_COMMANDS !== 'false';

    if (!sshEnabled) {
      this.logger.warn('SSH commands are disabled in this environment');
      // Vrati prazne podatke za SSH-based info
      for (let i = 60; i <= 76; i++) {
        legacyProcessors.push({
          name: `Teltonika${i} GPS Processor`,
          location: `Legacy Server (79.101.48.11)`,
          schedule: 'Svakih 2 minuta',
          lastRun: null,
          isActive: false,
          cronActive: false,
          cronLastRun: null,
          description: `Teltonika${i} folder - Port 120${i}`,
          instance: i,
          type: 'legacy',
          activeDevices: 0,
          rawLogSize: 'N/A',
        });
      }

      return {
        cronProcesses: [
          {
            name: 'Backend GPS Processor',
            location: 'Backend NestJS',
            schedule: 'Svakih 30 sekundi',
            lastRun: processorLastRun,
            isActive:
              backendCronStatus.processor && isActive(processorLastRun, 0.5),
            isPaused: !backendCronStatus.processor,
            description: 'Prebacuje podatke iz buffer-a u TimescaleDB',
            type: 'backend',
          },
          {
            name: 'Buffer Cleanup',
            location: 'Backend NestJS',
            schedule: 'Svakih 2 minuta',
            lastRun: GpsSyncDashboardController.cronLastRun.cleanup,
            isActive:
              backendCronStatus.cleanup &&
              isActive(GpsSyncDashboardController.cronLastRun.cleanup, 2),
            isPaused: !backendCronStatus.cleanup,
            description: 'Briše stare processed zapise iz buffer-a',
            type: 'backend',
          },
          {
            name: 'Stats Cleanup',
            location: 'Backend NestJS',
            schedule: 'Jednom dnevno u 3:00',
            lastRun: GpsSyncDashboardController.cronLastRun.statsCleanup,
            isActive:
              backendCronStatus.statsCleanup &&
              isActive(
                GpsSyncDashboardController.cronLastRun.statsCleanup,
                1440,
              ),
            isPaused: !backendCronStatus.statsCleanup,
            description: 'Briše statistike starije od 10 dana',
            type: 'backend',
          },
        ],
        legacyProcessors,
        summary: {
          totalCrons: 3 + legacyProcessors.length,
          activeCrons: [
            isActive(processorLastRun, 0.5),
            isActive(GpsSyncDashboardController.cronLastRun.cleanup, 2),
            isActive(GpsSyncDashboardController.cronLastRun.statsCleanup, 1440),
            ...legacyProcessors.map((p) => p.isActive),
          ].filter(Boolean).length,
          dataFlowStatus: isActive(processorLastRun, 0.5)
            ? 'operational'
            : 'degraded',
          activeLegacyInstances: [],
        },
        timestamp: new Date(),
      };
    }

    // Koristi helper metodu za SSH komandu
    const sshBaseCommand = this.getSSHCommand();
    this.logger.debug(`🔑 SSH komanda: ${sshBaseCommand}`);

    try {
      // 1. Proveri screen sesije
      const { stdout: screenOutput } = await exec(
        `${sshBaseCommand} "screen -ls 2>/dev/null | grep teltonika"`,
        { timeout: 10000 },
      );

      if (screenOutput) {
        const screenMatches = screenOutput.match(/teltonika(\d+)/g);
        if (screenMatches) {
          activeScreenSessions = screenMatches.map((m) =>
            parseInt(m.replace('teltonika', '')),
          );
        }
      }

      // 2. Proveri cron jobove
      const { stdout: cronOutput } = await exec(
        `${sshBaseCommand} "crontab -l 2>/dev/null | grep smart-city-raw-processor.php"`,
        { timeout: 10000 },
      );

      if (cronOutput) {
        const cronMatches = cronOutput.match(/teltonika(\d+)/g);
        if (cronMatches) {
          activeCronJobs = cronMatches.map((m) =>
            parseInt(m.replace('teltonika', '')),
          );
        }
      }

      // 3. Proveri aktivne konekcije za svaki port
      for (let port = 60; port <= 76; port++) {
        try {
          const { stdout: connCount } = await exec(
            `${sshBaseCommand} "ss -tan 2>/dev/null | grep :120${port} | grep ESTAB | wc -l"`,
            { timeout: 5000 },
          );
          const count = parseInt(connCount.trim()) || 0;
          if (count > 0) {
            activeConnections.set(port, count);
          }
        } catch (err) {
          // Ignoriši grešku za pojedinačni port
        }
      }

      // 4. Proveri veličine raw log fajlova za Smart City instance
      const folders = [
        'teltonika60',
        'teltonika61',
        'teltonika62',
        'teltonika63',
        'teltonika64',
        'teltonika65',
        'teltonika66',
        'teltonika67',
        'teltonika68',
        'teltonika69',
        'teltonika70',
        'teltonika71',
        'teltonika72',
        'teltonika73',
        'teltonika74',
        'teltonika75',
        'teltonika76',
      ];
      for (const folder of folders) {
        try {
          const { stdout: sizeOutput } = await exec(
            `${sshBaseCommand} "ls -lh /var/www/${folder}/smart-city-gps-raw-log.txt 2>/dev/null | awk '{print \\$5}'"`,
            { timeout: 5000 },
          );
          if (sizeOutput && sizeOutput.trim()) {
            const instance = parseInt(folder.replace('teltonika', ''));
            rawLogSizes.set(instance, sizeOutput.trim());
          }
        } catch (err) {
          // Ignoriši grešku za pojedinačni folder
        }
      }

      // 5. Proveri poslednje izvršavanje cron job-a za svaki processor
      for (const folder of folders) {
        try {
          const instance = parseInt(folder.replace('teltonika', ''));
          const { stdout: lastRunOutput } = await exec(
            `${sshBaseCommand} "tail -1 /var/log/smart-city-raw-processor-${instance}.log 2>/dev/null"`,
            { timeout: 5000 },
          );
          if (lastRunOutput && lastRunOutput.trim()) {
            // Pokušaj da izvučemo vreme iz log linije
            // Format: [2025-09-04 19:10:01] Processing...
            const timeMatch = lastRunOutput.match(
              /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/,
            );
            if (timeMatch) {
              const lastRunDate = new Date(timeMatch[1]);
              if (!isNaN(lastRunDate.getTime())) {
                lastCronRuns.set(instance, lastRunDate);
              }
            }
          }
        } catch (err) {
          // Ignoriši grešku za pojedinačni log
        }
      }

      this.logger.debug(
        `✅ SSH komande uspešne: ${activeScreenSessions.length} screen sesija, ${activeCronJobs.length} cron jobova`,
      );
    } catch (error) {
      this.logger.warn(
        `Couldn't fetch legacy server data via SSH: ${error.message}`,
      );
    }

    // Sve potencijalne instance (60-76)
    for (let i = 60; i <= 76; i++) {
      const isScreenActive = activeScreenSessions.includes(i);
      const isCronActive = activeCronJobs.includes(i);
      const connectionCount = activeConnections.get(i) || 0;
      const rawLogSize = rawLogSizes.get(i) || null;
      const cronLastRun = lastCronRuns.get(i) || null;

      legacyProcessors.push({
        name: `Teltonika${i} GPS Processor`,
        location: `Legacy Server (79.101.48.11)`,
        schedule: 'Svakih 2 minuta',
        lastRun: cronLastRun || (isScreenActive ? legacyLastRun : null),
        isActive: isScreenActive, // Screen sesija status
        cronActive: isCronActive, // Cron job status
        cronLastRun: cronLastRun, // Stvarno vreme poslednjeg cron izvršavanja
        description: `Teltonika${i} folder - Port 120${i}`,
        instance: i,
        type: 'legacy',
        activeDevices: connectionCount, // Broj aktivnih GPS uređaja
        rawLogSize: rawLogSize, // Veličina raw log fajla
      });
    }

    return {
      cronProcesses: [
        {
          name: 'Backend GPS Processor',
          location: 'Backend NestJS',
          schedule: 'Svakih 30 sekundi',
          lastRun: processorLastRun,
          isActive:
            backendCronStatus.processor && isActive(processorLastRun, 0.5),
          isPaused: !backendCronStatus.processor,
          description: 'Prebacuje podatke iz buffer-a u TimescaleDB',
          type: 'backend',
        },
        {
          name: 'Buffer Cleanup',
          location: 'Backend NestJS',
          schedule: 'Svakih 2 minuta',
          lastRun: GpsSyncDashboardController.cronLastRun.cleanup,
          isActive:
            backendCronStatus.cleanup &&
            isActive(GpsSyncDashboardController.cronLastRun.cleanup, 2),
          isPaused: !backendCronStatus.cleanup,
          description: 'Briše stare processed zapise iz buffer-a',
          type: 'backend',
        },
        {
          name: 'Stats Cleanup',
          location: 'Backend NestJS',
          schedule: 'Jednom dnevno u 3:00',
          lastRun: GpsSyncDashboardController.cronLastRun.statsCleanup,
          isActive:
            backendCronStatus.statsCleanup &&
            isActive(GpsSyncDashboardController.cronLastRun.statsCleanup, 1440), // 24 sata
          isPaused: !backendCronStatus.statsCleanup,
          description: 'Briše statistike starije od 10 dana',
          type: 'backend',
        },
      ],
      legacyProcessors,
      summary: {
        totalCrons: 3 + legacyProcessors.length,
        activeCrons: [
          isActive(processorLastRun, 0.5),
          isActive(GpsSyncDashboardController.cronLastRun.cleanup, 2),
          isActive(GpsSyncDashboardController.cronLastRun.statsCleanup, 1440),
          ...legacyProcessors.map((p) => p.isActive),
        ].filter(Boolean).length,
        dataFlowStatus:
          legacyProcessors.some((p) => p.isActive) &&
          isActive(processorLastRun, 0.5)
            ? 'operational'
            : 'degraded',
        activeLegacyInstances: activeScreenSessions,
      },
      timestamp: new Date(),
    };
  }

  @Get('batch-history')
  @RequirePermissions('dispatcher:view_sync_dashboard')
  @ApiOperation({ summary: 'Istorija batch procesiranja' })
  @ApiResponse({
    status: 200,
    description: 'Batch history',
  })
  async getBatchHistory() {
    try {
      // Čitaj iz nove gps_batch_history tabele sa worker logovima
      const batches = await this.prisma.gpsBatchHistory.findMany({
        where: {
          status: { in: ['completed', 'failed'] },
        },
        orderBy: { startedAt: 'desc' },
        take: 3,
        include: {
          workerLogs: {
            orderBy: { workerId: 'asc' },
          },
        },
      });

      // Mapiraj podatke za frontend
      const batchHistory = batches.map((batch, index) => {
        // Koristi stvarne worker logove ako postoje
        const workers =
          batch.workerLogs && batch.workerLogs.length > 0
            ? batch.workerLogs.map((log) => ({
                workerId: log.workerId,
                processed: log.recordsProcessed,
                failed: log.recordsFailed,
                duration: log.durationMs || 0,
                status: log.status,
                recordsPerSecond: log.recordsPerSecond || 0,
                startedAt: log.startedAt,
                completedAt: log.completedAt,
                recordsAssigned: log.recordsAssigned,
                processingSteps: log.processingSteps,
                errorMessage: log.errorMessage,
              }))
            : // Fallback na stari način ako nema logova
              ((batch.workerDetails as any[]) || []).map((w) => ({
                workerId: w.workerId,
                processed: w.processed || 0,
                failed: w.failed || 0,
                duration: w.duration || 0,
                status: w.status || 'unknown',
                recordsPerSecond:
                  w.duration > 0
                    ? Math.round(w.processed / (w.duration / 1000))
                    : 0,
                startedAt: w.startedAt || null,
                completedAt: w.completedAt || null,
                recordsAssigned: w.processed || 0,
                processingSteps: null,
                errorMessage: null,
              }));

        return {
          id: batch.id,
          batchNumber: batch.batchNumber,
          startedAt: batch.startedAt,
          completedAt: batch.completedAt,
          totalRecords: batch.actualProcessed + batch.failedRecords, // Ukupno pokušano
          processedRecords: batch.actualProcessed,
          failedRecords: batch.failedRecords,
          batchSize: batch.batchSize,
          workerCount: batch.workerCount,
          totalDuration: batch.totalDurationMs,
          avgRecordsPerSecond: batch.avgRecordsPerSecond,
          workers: workers,
          status: batch.status,
          errorMessage: batch.errorMessage,
        };
      });

      return {
        success: true,
        batches: batchHistory,
      };
    } catch (error) {
      this.logger.error('Error fetching batch history:', error);
      return {
        success: false,
        batches: [],
      };
    }
  }

  @Post('cron-control')
  @RequirePermissions('dispatcher.manage_cron')
  @ApiOperation({ summary: 'Kontrola cron procesa (start/stop)' })
  @ApiResponse({
    status: 200,
    description: 'Cron proces kontrolisan',
  })
  async controlCron(
    @Body()
    dto: {
      action: 'start' | 'stop';
      cronName: string;
      instance?: number;
    },
  ) {
    const logger = new Logger('CronControl');

    try {
      // Za Backend cron-ove
      if (dto.cronName === 'Backend GPS Processor') {
        const {
          GpsProcessorService,
        } = require('../gps-processor/gps-processor.service');
        GpsProcessorService.setCronEnabled('processor', dto.action === 'start');

        if (dto.action === 'start') {
          // Ažuriraj i lastRun da bi se prikazao kao aktivan
          GpsSyncDashboardController.updateCronLastRun('processor');
        }

        return {
          success: true,
          message: `Backend GPS Processor ${dto.action === 'start' ? 'pokrenut' : 'zaustavljen'}`,
        };
      }

      if (dto.cronName === 'Buffer Cleanup') {
        const {
          GpsProcessorService,
        } = require('../gps-processor/gps-processor.service');
        GpsProcessorService.setCronEnabled('cleanup', dto.action === 'start');

        if (dto.action === 'start') {
          GpsSyncDashboardController.updateCronLastRun('cleanup');
        }

        return {
          success: true,
          message: `Buffer Cleanup ${dto.action === 'start' ? 'pokrenut' : 'zaustavljen'}`,
        };
      }

      if (dto.cronName === 'Stats Cleanup') {
        const {
          GpsProcessorService,
        } = require('../gps-processor/gps-processor.service');
        GpsProcessorService.setCronEnabled(
          'statsCleanup',
          dto.action === 'start',
        );

        if (dto.action === 'start') {
          GpsSyncDashboardController.updateCronLastRun('statsCleanup');
        }

        return {
          success: true,
          message: `Stats Cleanup ${dto.action === 'start' ? 'pokrenut' : 'zaustavljen'}`,
        };
      }

      // Za Legacy GPS procesore
      if (dto.cronName.includes('Teltonika')) {
        const instanceNum = dto.instance || 60;

        if (dto.action === 'stop') {
          // Stop teltonika screen session
          const { stdout, stderr } = await exec(
            `${this.getSSHCommand()} "screen -XS teltonika${instanceNum}.bgnaplata quit"`,
            { timeout: 10000 },
          );

          logger.log(`Stopiran Teltonika${instanceNum}: ${stdout}`);

          return {
            success: true,
            message: `Teltonika${instanceNum} stopiran`,
            details: stdout,
          };
        } else {
          // Start teltonika screen session
          const { stdout, stderr } = await exec(
            `${this.getSSHCommand()} "screen -m -d -S teltonika${instanceNum}.bgnaplata /var/www/teltonika${instanceNum}/start_teltonika.sh"`,
            { timeout: 10000 },
          );

          logger.log(`Pokrenut Teltonika${instanceNum}: ${stdout}`);

          return {
            success: true,
            message: `Teltonika${instanceNum} pokrenut`,
            details: stdout,
          };
        }
      }

      // Za Backend GPS Processor
      if (dto.cronName === 'Backend GPS Processor') {
        // Ovo kontroliše NestJS cron - potrebna je drugačija logika
        // Za sada samo vraćamo poruku
        return {
          success: false,
          message:
            'Backend cron procesi se ne mogu kontrolisati preko ovog interfejsa',
          details: 'Koristite systemctl ili docker komande',
        };
      }

      return {
        success: false,
        message: `Nepoznat cron proces: ${dto.cronName}`,
      };
    } catch (error) {
      logger.error(`Greška pri kontroli cron procesa: ${error.message}`);
      return {
        success: false,
        message: 'Greška pri kontroli cron procesa',
        error: error.message,
      };
    }
  }

  @Post('cron-restart')
  @RequirePermissions('dispatcher.manage_cron')
  @ApiOperation({ summary: 'Restart cron procesa' })
  @ApiResponse({
    status: 200,
    description: 'Cron proces restartovan',
  })
  async restartCron(@Body() dto: { cronName: string; instance?: number }) {
    const logger = new Logger('CronRestart');

    try {
      // Za Legacy GPS procesore
      if (dto.cronName.includes('Teltonika')) {
        const instanceNum = dto.instance || 60;

        // Stop then start
        await exec(
          `${this.getSSHCommand()} "screen -XS teltonika${instanceNum}.bgnaplata quit"`,
          { timeout: 10000 },
        );

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const { stdout, stderr } = await exec(
          `${this.getSSHCommand()} "screen -m -d -S teltonika${instanceNum}.bgnaplata /var/www/teltonika${instanceNum}/start_teltonika.sh"`,
          { timeout: 10000 },
        );

        logger.log(`Restartovan Teltonika${instanceNum}`);

        return {
          success: true,
          message: `Teltonika${instanceNum} restartovan`,
          details: stdout,
        };
      }

      return {
        success: false,
        message: `Nepoznat cron proces: ${dto.cronName}`,
      };
    } catch (error) {
      logger.error(`Greška pri restartovanju cron procesa: ${error.message}`);
      return {
        success: false,
        message: 'Greška pri restartovanju cron procesa',
        error: error.message,
      };
    }
  }

  @Post('cron-process-control')
  @RequirePermissions('dispatcher.manage_cron')
  @ApiOperation({
    summary: 'Kontrola Smart City cron procesora (raw file processor)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron processor kontrolisan',
  })
  async controlCronProcess(
    @Body() dto: { action: 'start' | 'stop' | 'run'; instance: number },
  ) {
    const logger = new Logger('CronProcessControl');

    try {
      // Samo za teltonika60-76 koji imaju Smart City setup
      if (dto.instance < 60 || dto.instance > 76) {
        return {
          success: false,
          message: `Teltonika${dto.instance} nema Smart City processor`,
        };
      }

      if (dto.action === 'stop') {
        // Zaustavi cron za procesiranje
        const { stdout } = await exec(
          `${this.getSSHCommand()} "crontab -l | grep -v 'teltonika${dto.instance}/smart-city-raw-processor.php' | crontab -"`,
          { timeout: 10000 },
        );

        logger.log(
          `Zaustavljen Smart City processor za teltonika${dto.instance}`,
        );

        return {
          success: true,
          message: `Smart City processor za teltonika${dto.instance} je zaustavljen`,
          details: 'Cron job uklonjen',
        };
      } else if (dto.action === 'start') {
        // Pokreni cron za procesiranje
        const { stdout } = await exec(
          `${this.getSSHCommand()} "(crontab -l 2>/dev/null; echo '*/2 * * * * /usr/bin/php /var/www/teltonika${dto.instance}/smart-city-raw-processor.php >> /var/log/smart-city-raw-processor-${dto.instance}.log 2>&1') | crontab -"`,
          { timeout: 10000 },
        );

        logger.log(
          `Pokrenut Smart City processor cron za teltonika${dto.instance}`,
        );

        return {
          success: true,
          message: `Smart City processor za teltonika${dto.instance} je pokrenut`,
          details: 'Cron job dodat (svakih 2 minuta)',
        };
      } else if (dto.action === 'run') {
        // Ručno pokreni procesiranje odmah
        const { stdout, stderr } = await exec(
          `${this.getSSHCommand()} "php /var/www/teltonika${dto.instance}/smart-city-raw-processor.php"`,
          { timeout: 30000 },
        );

        logger.log(
          `Ručno pokrenut Smart City processor za teltonika${dto.instance}: ${stdout}`,
        );

        return {
          success: true,
          message: `Smart City processor za teltonika${dto.instance} je ručno pokrenut`,
          details: stdout || 'Procesiranje završeno',
        };
      }

      return {
        success: false,
        message: `Nepoznata akcija: ${dto.action}`,
      };
    } catch (error) {
      logger.error(
        `Greška pri kontroli Smart City processor-a: ${error.message}`,
      );
      return {
        success: false,
        message: 'Greška pri kontroli Smart City processor-a',
        error: error.message,
      };
    }
  }

  @Get('settings')
  @RequirePermissions('dispatcher.manage_gps')
  @ApiOperation({ summary: 'Dohvati GPS processor podešavanja' })
  @ApiResponse({
    status: 200,
    description: 'GPS processor podešavanja',
  })
  async getSettings() {
    try {
      const settings = await this.prisma.systemSettings.findMany({
        where: { category: 'gps' },
      });

      return {
        success: true,
        data: settings.reduce((acc, setting) => {
          acc[setting.key] = {
            value:
              setting.type === 'number'
                ? parseInt(setting.value)
                : setting.value,
            type: setting.type,
            description: setting.description,
          };
          return acc;
        }, {} as any),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Greška pri dohvatanju podešavanja',
        error: error.message,
      };
    }
  }

  @Post('settings')
  @RequirePermissions('dispatcher.manage_gps')
  @ApiOperation({ summary: 'Ažuriraj GPS processor podešavanja' })
  @ApiResponse({
    status: 200,
    description: 'Podešavanja ažurirana',
  })
  async updateSettings(@Body() dto: { key: string; value: string | number }) {
    try {
      const existing = await this.prisma.systemSettings.findUnique({
        where: { key: dto.key },
      });

      if (!existing) {
        return {
          success: false,
          message: `Podešavanje ${dto.key} ne postoji`,
        };
      }

      await this.prisma.systemSettings.update({
        where: { key: dto.key },
        data: {
          value: dto.value.toString(),
          updatedAt: new Date(),
        },
      });

      this.logger.log(`⚙️ Ažurirano podešavanje ${dto.key} = ${dto.value}`);

      return {
        success: true,
        message: 'Podešavanje uspešno ažurirano',
      };
    } catch (error) {
      this.logger.error(`Greška pri ažuriranju podešavanja: ${error.message}`);
      return {
        success: false,
        message: 'Greška pri ažuriranju podešavanja',
        error: error.message,
      };
    }
  }

  /**
   * Dobavi status MySQL konekcija
   */
  @Get('connection-status')
  @RequirePermissions('dispatcher:view_sync_dashboard')
  @ApiOperation({ summary: 'Dobavi status MySQL connection pool-a' })
  async getConnectionStatus() {
    try {
      // Dobavi PROCESSLIST iz MySQL-a
      // Prisma vraća kolone kao f0, f1, f2... umesto pravih imena
      const processList = await this.prisma.$queryRaw<
        Array<{
          f0: bigint; // Id
          f1: string; // User
          f2: string; // Host
          f3: string | null; // db
          f4: string; // Command
          f5: number; // Time
          f6: string | null; // State
          f7: string | null; // Info
        }>
      >`SHOW PROCESSLIST`;

      // Mapiraj na prava imena polja
      const mappedProcessList = processList.map((p) => ({
        Id: Number(p.f0),
        User: p.f1,
        Host: p.f2,
        db: p.f3,
        Command: p.f4,
        Time: p.f5,
        State: p.f6,
        Info: p.f7,
      }));

      // Filtriraj samo naše konekcije (Host format je IP:port)
      const ourConnections = mappedProcessList.filter(
        (p) => p.User === 'gsp-user' && p.Host?.startsWith('157.230.119.11'),
      );

      // Analiziraj stanje konekcija
      const connectionStats = {
        total: ourConnections.length,
        active: ourConnections.filter((c) => c.Command !== 'Sleep').length,
        sleeping: ourConnections.filter((c) => c.Command === 'Sleep').length,
        executing: ourConnections.filter((c) => c.Command === 'Execute').length,
        longRunning: ourConnections.filter((c) => c.Time > 60).length,
      };

      // Grupiši po tipu komande
      const byCommand = ourConnections.reduce(
        (acc, conn) => {
          acc[conn.Command] = (acc[conn.Command] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Top 5 najdužih konekcija
      const longestConnections = ourConnections
        .sort((a, b) => b.Time - a.Time)
        .slice(0, 5)
        .map((c) => ({
          id: c.Id,
          command: c.Command,
          time: c.Time,
          state: c.State,
          query: c.Info ? c.Info.substring(0, 100) + '...' : null,
        }));

      // Connection pool info iz environment-a
      const dbUrl = process.env.DATABASE_URL || '';
      const connectionLimit = dbUrl.match(/connection_limit=(\d+)/)?.[1] || '3';
      const poolTimeout = dbUrl.match(/pool_timeout=(\d+)/)?.[1] || '10';

      return {
        pool: {
          maxConnections: parseInt(connectionLimit),
          currentConnections: connectionStats.total,
          availableConnections:
            parseInt(connectionLimit) - connectionStats.total,
          utilizationPercent: Math.round(
            (connectionStats.total / parseInt(connectionLimit)) * 100,
          ),
          poolTimeout: parseInt(poolTimeout),
        },
        connections: connectionStats,
        byCommand,
        longestConnections,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error getting connection status:', error);
      return {
        error: 'Failed to get connection status',
        timestamp: new Date(),
      };
    }
  }

  @Post('reset-statistics')
  @RequirePermissions('dispatcher.manage_gps')
  @ApiOperation({ summary: 'Reset GPS processing statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistike su resetovane',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        deletedRows: { type: 'number' },
      },
    },
  })
  async resetStatistics() {
    const logger = this.logger;

    try {
      // Obriši sve statistike iz tabele gps_processing_stats
      const result = await this.prisma.$executeRaw`
        DELETE FROM gps_processing_stats
      `;

      // Resetuj i buffer statistike na 0
      await this.prisma.$executeRaw`
        UPDATE gps_raw_buffer
        SET process_status = 'processed'
        WHERE process_status IN ('pending', 'error')
      `;

      logger.log(
        `🔄 Resetovane statistike - obrisano ${result} redova iz gps_processing_stats`,
      );

      return {
        success: true,
        message: 'Statistike su uspešno resetovane',
        deletedRows: result,
      };
    } catch (error) {
      logger.error(`Greška pri resetovanju statistika: ${error.message}`);
      return {
        success: false,
        message: 'Greška pri resetovanju statistika',
        error: error.message,
      };
    }
  }

  @Get('stuck-records')
  @RequirePermissions('dispatcher:view_sync_dashboard')
  @ApiOperation({ summary: 'Dobavi informacije o stuck processing zapisima' })
  @ApiResponse({
    status: 200,
    description: 'Stuck records info',
  })
  async getStuckRecords() {
    try {
      const stuckThresholdMinutes = 5;
      const stuckThreshold = new Date();
      stuckThreshold.setMinutes(
        stuckThreshold.getMinutes() - stuckThresholdMinutes,
      );

      // Brojanje stuck zapisa po worker grupama
      const stuckByGroup = await this.prisma.$queryRaw<
        {
          worker_group: number;
          count: bigint;
          retry_0: bigint;
          retry_1: bigint;
          retry_2: bigint;
          retry_3_plus: bigint;
          oldest_stuck: Date;
        }[]
      >`
        SELECT
          worker_group,
          COUNT(*) as count,
          SUM(CASE WHEN retry_count = 0 THEN 1 ELSE 0 END) as retry_0,
          SUM(CASE WHEN retry_count = 1 THEN 1 ELSE 0 END) as retry_1,
          SUM(CASE WHEN retry_count = 2 THEN 1 ELSE 0 END) as retry_2,
          SUM(CASE WHEN retry_count >= 3 THEN 1 ELSE 0 END) as retry_3_plus,
          MIN(processed_at) as oldest_stuck
        FROM gps_raw_buffer
        WHERE process_status = 'processing'
        AND processed_at < ${stuckThreshold}
        GROUP BY worker_group
        ORDER BY worker_group
      `;

      // Ukupno stuck zapisa
      const totalStuck = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM gps_raw_buffer
        WHERE process_status = 'processing'
        AND processed_at < ${stuckThreshold}
      `;

      // Najstariji stuck zapisi (primeri)
      const oldestStuck = await this.prisma.$queryRaw<
        {
          id: bigint;
          vehicle_id: number;
          garage_no: string;
          processed_at: Date;
          retry_count: number;
          worker_group: number;
        }[]
      >`
        SELECT id, vehicle_id, garage_no, processed_at, retry_count, worker_group
        FROM gps_raw_buffer
        WHERE process_status = 'processing'
        AND processed_at < ${stuckThreshold}
        ORDER BY processed_at ASC
        LIMIT 10
      `;

      return {
        success: true,
        stuckThresholdMinutes,
        totalStuck: Number(totalStuck[0]?.count || 0),
        byWorkerGroup: stuckByGroup.map((g) => ({
          workerGroup: g.worker_group,
          count: Number(g.count),
          retry0: Number(g.retry_0),
          retry1: Number(g.retry_1),
          retry2: Number(g.retry_2),
          retry3Plus: Number(g.retry_3_plus),
          oldestStuck: g.oldest_stuck,
        })),
        oldestExamples: oldestStuck.map((r) => ({
          id: Number(r.id),
          vehicleId: r.vehicle_id,
          garageNo: r.garage_no,
          processedAt: r.processed_at,
          retryCount: r.retry_count,
          workerGroup: r.worker_group,
          stuckMinutes: Math.floor(
            (new Date().getTime() - new Date(r.processed_at).getTime()) /
              (1000 * 60),
          ),
        })),
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Greška pri dohvatanju stuck zapisa:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  @Post('recover-stuck-records')
  @RequirePermissions('dispatcher.manage_gps')
  @ApiOperation({ summary: 'Ručno pokreni recovery stuck processing zapisa' })
  @ApiResponse({
    status: 200,
    description: 'Recovery rezultat',
  })
  async recoverStuckRecords() {
    try {
      // Pozovi recovery metodu iz GpsProcessorService
      const { GpsProcessorService } = require('../gps-processor/gps-processor.service');

      // Kreiraj privremenu instancu da pozovemo metodu
      const processorService = new GpsProcessorService(this.prisma, null);
      const result = await processorService.recoverStuckRecords();

      this.logger.log(
        `🔧 Ručni recovery: ${result.recovered} recovered, ${result.failed} failed`,
      );

      return {
        success: true,
        message: 'Recovery uspešno završen',
        recovered: result.recovered,
        failed: result.failed,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Greška pri ručnom recovery-ju:', error);
      return {
        success: false,
        message: 'Greška pri recovery-ju',
        error: error.message,
        timestamp: new Date(),
      };
    }
  }
}
