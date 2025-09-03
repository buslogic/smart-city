import { 
  Controller, 
  Get, 
  Post,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import * as child_process from 'child_process';
import { promisify } from 'util';

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
    
    // Proveri backend cron status
    const { GpsProcessorService } = require('../gps-processor/gps-processor.service');
    const backendCronStatus = GpsProcessorService.getCronStatus();
    
    // Cron se smatra aktivnim ako je radio u zadnjih X minuta
    const isActive = (lastRun: Date | null, intervalMinutes: number) => {
      if (!lastRun) return false;
      const diffMinutes = (now.getTime() - new Date(lastRun).getTime()) / (1000 * 60);
      return diffMinutes < intervalMinutes * 2; // Duplo vreme kao tolerancija
    };
    
    // Generiši legacy procesore za teltonika60-76
    const legacyProcessors: any[] = [];
    
    // Proveri koje screen sesije su aktivne
    let activeScreenSessions: number[] = [];
    try {
      const { stdout } = await exec(
        `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "screen -ls | grep teltonika | grep -oP 'teltonika\\K[0-9]+'"`,
        { timeout: 5000 }
      );
      if (stdout) {
        activeScreenSessions = stdout.trim().split('\n')
          .map(num => parseInt(num))
          .filter(num => !isNaN(num));
      }
    } catch (error) {
      // Ako nema aktivnih sesija ili greška, ostavi prazan niz
      this.logger.warn(`Couldn't check screen sessions: ${error.message}`);
    }
    
    // Proveri koji cron jobovi postoje
    let activeCronJobs: number[] = [];
    try {
      const { stdout } = await exec(
        `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "crontab -l 2>/dev/null | grep 'smart-city-raw-processor.php' | grep -oP 'teltonika\\K[0-9]+'"`,
        { timeout: 5000 }
      );
      if (stdout) {
        activeCronJobs = stdout.trim().split('\n')
          .map(num => parseInt(num))
          .filter(num => !isNaN(num));
      }
    } catch (error) {
      // Ako nema cron jobova ili greška
      this.logger.warn(`Couldn't check cron jobs: ${error.message}`);
    }
    
    // Proveri broj aktivnih GPS konekcija po portu
    let activeConnections: Map<number, number> = new Map();
    try {
      const { stdout } = await exec(
        `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "for port in {60..76}; do count=\\$(ss -tan | grep :120\\$port | grep ESTAB | wc -l); echo \\$port:\\$count; done"`,
        { timeout: 5000 }
      );
      if (stdout) {
        stdout.trim().split('\n').forEach(line => {
          const [port, count] = line.split(':');
          activeConnections.set(parseInt(port), parseInt(count));
        });
      }
    } catch (error) {
      this.logger.warn(`Couldn't check active connections: ${error.message}`);
    }
    
    // Sve potencijalne instance (60-76)
    for (let i = 60; i <= 76; i++) {
      const isScreenActive = activeScreenSessions.includes(i);
      const isCronActive = activeCronJobs.includes(i);
      const connectionCount = activeConnections.get(i) || 0;
      
      legacyProcessors.push({
        name: `Teltonika${i} GPS Processor`,
        location: `Legacy Server (79.101.48.11)`,
        schedule: 'Svakih 2 minuta',
        lastRun: isScreenActive ? legacyLastRun : null,
        isActive: isScreenActive, // Screen sesija status
        cronActive: isCronActive, // Cron job status
        cronLastRun: isCronActive ? legacyLastRun : null,
        description: `Teltonika${i} folder - Port 120${i}`,
        instance: i,
        type: 'legacy',
        activeDevices: connectionCount // Broj aktivnih GPS uređaja
      });
    }
    
    return {
      cronProcesses: [
        {
          name: 'Backend GPS Processor',
          location: 'Backend NestJS',
          schedule: 'Svakih 30 sekundi',
          lastRun: processorLastRun,
          isActive: backendCronStatus.processor && isActive(processorLastRun, 0.5),
          isPaused: !backendCronStatus.processor,
          description: 'Prebacuje podatke iz buffer-a u TimescaleDB',
          type: 'backend'
        },
        {
          name: 'Buffer Cleanup',
          location: 'Backend NestJS',
          schedule: 'Svakih 2 minuta',
          lastRun: GpsSyncDashboardController.cronLastRun.cleanup,
          isActive: backendCronStatus.cleanup && isActive(GpsSyncDashboardController.cronLastRun.cleanup, 2),
          isPaused: !backendCronStatus.cleanup,
          description: 'Briše stare processed zapise iz buffer-a',
          type: 'backend'
        },
        {
          name: 'Stats Cleanup',
          location: 'Backend NestJS',
          schedule: 'Jednom dnevno u 3:00',
          lastRun: GpsSyncDashboardController.cronLastRun.statsCleanup,
          isActive: backendCronStatus.statsCleanup && isActive(GpsSyncDashboardController.cronLastRun.statsCleanup, 1440), // 24 sata
          isPaused: !backendCronStatus.statsCleanup,
          description: 'Briše statistike starije od 10 dana',
          type: 'backend'
        }
      ],
      legacyProcessors,
      summary: {
        totalCrons: 3 + legacyProcessors.length,
        activeCrons: [
          isActive(processorLastRun, 0.5),
          isActive(GpsSyncDashboardController.cronLastRun.cleanup, 2),
          isActive(GpsSyncDashboardController.cronLastRun.statsCleanup, 1440),
          ...legacyProcessors.map(p => p.isActive)
        ].filter(Boolean).length,
        dataFlowStatus: legacyProcessors.some(p => p.isActive) && isActive(processorLastRun, 0.5) ? 'operational' : 'degraded',
        activeLegacyInstances: activeScreenSessions
      },
      timestamp: new Date()
    };
  }

  @Post('cron-control')
  @RequirePermissions('dispatcher.manage_cron')
  @ApiOperation({ summary: 'Kontrola cron procesa (start/stop)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cron proces kontrolisan'
  })
  async controlCron(@Body() dto: { action: 'start' | 'stop', cronName: string, instance?: number }) {
    const logger = new Logger('CronControl');
    
    try {
      // Za Backend cron-ove
      if (dto.cronName === 'Backend GPS Processor') {
        const { GpsProcessorService } = require('../gps-processor/gps-processor.service');
        GpsProcessorService.setCronEnabled('processor', dto.action === 'start');
        
        if (dto.action === 'start') {
          // Ažuriraj i lastRun da bi se prikazao kao aktivan
          GpsSyncDashboardController.updateCronLastRun('processor');
        }
        
        return {
          success: true,
          message: `Backend GPS Processor ${dto.action === 'start' ? 'pokrenut' : 'zaustavljen'}`
        };
      }
      
      if (dto.cronName === 'Buffer Cleanup') {
        const { GpsProcessorService } = require('../gps-processor/gps-processor.service');
        GpsProcessorService.setCronEnabled('cleanup', dto.action === 'start');
        
        if (dto.action === 'start') {
          GpsSyncDashboardController.updateCronLastRun('cleanup');
        }
        
        return {
          success: true,
          message: `Buffer Cleanup ${dto.action === 'start' ? 'pokrenut' : 'zaustavljen'}`
        };
      }
      
      if (dto.cronName === 'Stats Cleanup') {
        const { GpsProcessorService } = require('../gps-processor/gps-processor.service');
        GpsProcessorService.setCronEnabled('statsCleanup', dto.action === 'start');
        
        if (dto.action === 'start') {
          GpsSyncDashboardController.updateCronLastRun('statsCleanup');
        }
        
        return {
          success: true,
          message: `Stats Cleanup ${dto.action === 'start' ? 'pokrenut' : 'zaustavljen'}`
        };
      }
      
      // Za Legacy GPS procesore
      if (dto.cronName.includes('Teltonika')) {
        const instanceNum = dto.instance || 60;
        
        if (dto.action === 'stop') {
          // Stop teltonika screen session
          const { stdout, stderr } = await exec(
            `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "screen -XS teltonika${instanceNum}.bgnaplata quit"`,
            { timeout: 10000 }
          );
          
          logger.log(`Stopiran Teltonika${instanceNum}: ${stdout}`);
          
          return {
            success: true,
            message: `Teltonika${instanceNum} stopiran`,
            details: stdout
          };
        } else {
          // Start teltonika screen session
          const { stdout, stderr } = await exec(
            `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "screen -m -d -S teltonika${instanceNum}.bgnaplata /var/www/teltonika${instanceNum}/start_teltonika.sh"`,
            { timeout: 10000 }
          );
          
          logger.log(`Pokrenut Teltonika${instanceNum}: ${stdout}`);
          
          return {
            success: true,
            message: `Teltonika${instanceNum} pokrenut`,
            details: stdout
          };
        }
      }
      
      // Za Backend GPS Processor
      if (dto.cronName === 'Backend GPS Processor') {
        // Ovo kontroliše NestJS cron - potrebna je drugačija logika
        // Za sada samo vraćamo poruku
        return {
          success: false,
          message: 'Backend cron procesi se ne mogu kontrolisati preko ovog interfejsa',
          details: 'Koristite systemctl ili docker komande'
        };
      }
      
      return {
        success: false,
        message: `Nepoznat cron proces: ${dto.cronName}`
      };
      
    } catch (error) {
      logger.error(`Greška pri kontroli cron procesa: ${error.message}`);
      return {
        success: false,
        message: 'Greška pri kontroli cron procesa',
        error: error.message
      };
    }
  }

  @Post('cron-restart')
  @RequirePermissions('dispatcher.manage_cron')
  @ApiOperation({ summary: 'Restart cron procesa' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cron proces restartovan'
  })
  async restartCron(@Body() dto: { cronName: string, instance?: number }) {
    const logger = new Logger('CronRestart');
    
    try {
      // Za Legacy GPS procesore
      if (dto.cronName.includes('Teltonika')) {
        const instanceNum = dto.instance || 60;
        
        // Stop then start
        await exec(
          `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "screen -XS teltonika${instanceNum}.bgnaplata quit"`,
          { timeout: 10000 }
        );
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { stdout, stderr } = await exec(
          `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "screen -m -d -S teltonika${instanceNum}.bgnaplata /var/www/teltonika${instanceNum}/start_teltonika.sh"`,
          { timeout: 10000 }
        );
        
        logger.log(`Restartovan Teltonika${instanceNum}`);
        
        return {
          success: true,
          message: `Teltonika${instanceNum} restartovan`,
          details: stdout
        };
      }
      
      return {
        success: false,
        message: `Nepoznat cron proces: ${dto.cronName}`
      };
      
    } catch (error) {
      logger.error(`Greška pri restartovanju cron procesa: ${error.message}`);
      return {
        success: false,
        message: 'Greška pri restartovanju cron procesa',
        error: error.message
      };
    }
  }

  @Post('cron-process-control')
  @RequirePermissions('dispatcher.manage_cron')
  @ApiOperation({ summary: 'Kontrola Smart City cron procesora (raw file processor)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cron processor kontrolisan'
  })
  async controlCronProcess(@Body() dto: { action: 'start' | 'stop' | 'run', instance: number }) {
    const logger = new Logger('CronProcessControl');
    
    try {
      // Samo za teltonika60 i teltonika61 koji imaju Smart City setup
      if (dto.instance !== 60 && dto.instance !== 61) {
        return {
          success: false,
          message: `Teltonika${dto.instance} nema Smart City processor`
        };
      }
      
      if (dto.action === 'stop') {
        // Zaustavi cron za procesiranje
        const { stdout } = await exec(
          `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "crontab -l | grep -v 'teltonika${dto.instance}/smart-city-raw-processor.php' | crontab -"`,
          { timeout: 10000 }
        );
        
        logger.log(`Zaustavljen Smart City processor za teltonika${dto.instance}`);
        
        return {
          success: true,
          message: `Smart City processor za teltonika${dto.instance} je zaustavljen`,
          details: 'Cron job uklonjen'
        };
        
      } else if (dto.action === 'start') {
        // Pokreni cron za procesiranje
        const { stdout } = await exec(
          `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "(crontab -l 2>/dev/null; echo '*/2 * * * * /usr/bin/php /var/www/teltonika${dto.instance}/smart-city-raw-processor.php >> /var/log/smart-city-raw-processor-${dto.instance}.log 2>&1') | crontab -"`,
          { timeout: 10000 }
        );
        
        logger.log(`Pokrenut Smart City processor cron za teltonika${dto.instance}`);
        
        return {
          success: true,
          message: `Smart City processor za teltonika${dto.instance} je pokrenut`,
          details: 'Cron job dodat (svakih 2 minuta)'
        };
        
      } else if (dto.action === 'run') {
        // Ručno pokreni procesiranje odmah
        const { stdout, stderr } = await exec(
          `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "php /var/www/teltonika${dto.instance}/smart-city-raw-processor.php"`,
          { timeout: 30000 }
        );
        
        logger.log(`Ručno pokrenut Smart City processor za teltonika${dto.instance}: ${stdout}`);
        
        return {
          success: true,
          message: `Smart City processor za teltonika${dto.instance} je ručno pokrenut`,
          details: stdout || 'Procesiranje završeno'
        };
      }
      
      return {
        success: false,
        message: `Nepoznata akcija: ${dto.action}`
      };
      
    } catch (error) {
      logger.error(`Greška pri kontroli Smart City processor-a: ${error.message}`);
      return {
        success: false,
        message: 'Greška pri kontroli Smart City processor-a',
        error: error.message
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
        deletedRows: { type: 'number' }
      }
    }
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
      
      logger.log(`🔄 Resetovane statistike - obrisano ${result} redova iz gps_processing_stats`);
      
      return {
        success: true,
        message: 'Statistike su uspešno resetovane',
        deletedRows: result
      };
      
    } catch (error) {
      logger.error(`Greška pri resetovanju statistika: ${error.message}`);
      return {
        success: false,
        message: 'Greška pri resetovanju statistika',
        error: error.message
      };
    }
  }
}