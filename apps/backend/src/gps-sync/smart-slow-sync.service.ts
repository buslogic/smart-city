import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacySyncWorkerPoolService } from './legacy-sync-worker-pool.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export enum SlowSyncPreset {
  FAST = 'fast',
  BALANCED = 'balanced', 
  CONSERVATIVE = 'conservative'
}

export interface SlowSyncConfig {
  preset: SlowSyncPreset;
  vehiclesPerBatch: number;
  workersPerBatch: number;
  batchDelayMinutes: number;
  nightHoursStart: number;
  nightHoursEnd: number;
  maxDailyBatches: number;
  syncDaysBack: number;
  autoCleanup: boolean;
  compressAfterBatches: number;
  vacuumAfterBatches: number;
}

export interface SlowSyncProgress {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  startedAt?: Date;
  lastBatchAt?: Date;
  completedAt?: Date;
  totalVehicles: number;
  processedVehicles: number;
  currentBatch: number;
  totalBatches: number;
  vehiclesInCurrentBatch: string[];
  estimatedCompletion?: Date;
  errors: Array<{ vehicleId: number; error: string; timestamp: Date }>;
  stats: {
    totalPointsProcessed: number;
    averageTimePerBatch: number;
    successRate: number;
    diskSpaceUsed: string;
    compressionRatio: number;
  };
}

export interface SlowSyncCheckpoint {
  batchNumber: number;
  vehiclesProcessed: number[];
  lastProcessedTime: Date;
  totalPoints: number;
  createdAt: Date;
}

@Injectable()
export class SmartSlowSyncService {
  private readonly logger = new Logger(SmartSlowSyncService.name);
  private isRunning = false;
  private isPaused = false;
  private currentConfig: SlowSyncConfig;
  private progress: SlowSyncProgress;
  private vehicleQueue: number[] = [];
  private readonly SETTINGS_KEY = 'smart_slow_sync';

  private readonly PRESETS: Record<SlowSyncPreset, Partial<SlowSyncConfig>> = {
    [SlowSyncPreset.FAST]: {
      vehiclesPerBatch: 30,
      workersPerBatch: 6,
      batchDelayMinutes: 15,
      nightHoursStart: 20,
      nightHoursEnd: 8,
      maxDailyBatches: 30,
    },
    [SlowSyncPreset.BALANCED]: {
      vehiclesPerBatch: 15,
      workersPerBatch: 3,
      batchDelayMinutes: 20,
      nightHoursStart: 22,
      nightHoursEnd: 6,
      maxDailyBatches: 15,
    },
    [SlowSyncPreset.CONSERVATIVE]: {
      vehiclesPerBatch: 10,
      workersPerBatch: 2,
      batchDelayMinutes: 30,
      nightHoursStart: 23,
      nightHoursEnd: 5,
      maxDailyBatches: 10,
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly workerPoolService: LegacySyncWorkerPoolService,
  ) {
    this.initializeProgress();
  }

  // Helper metode za rad sa system settings
  private async getSetting<T = any>(key: string): Promise<T | null> {
    const setting = await this.prisma.systemSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    try {
      return JSON.parse(setting.value) as T;
    } catch {
      return setting.value as unknown as T;
    }
  }

  private async setSetting<T = any>(key: string, value: T): Promise<void> {
    const stringValue = value === null ? null : (typeof value === 'string' ? value : JSON.stringify(value));

    if (stringValue === null) {
      await this.prisma.systemSettings.delete({
        where: { key }
      }).catch(() => {});
      return;
    }

    await this.prisma.systemSettings.upsert({
      where: { key },
      update: { 
        value: stringValue,
        updatedAt: new Date(),
      },
      create: {
        key,
        value: stringValue,
        type: typeof value === 'object' ? 'json' : typeof value,
        category: 'smart_slow_sync',
        description: 'Smart Slow Sync setting',
      },
    });
  }

  private async initializeProgress() {
    const savedProgress = await this.getSetting<SlowSyncProgress>(
      this.SETTINGS_KEY + '_progress'
    );
    
    if (savedProgress) {
      this.progress = savedProgress;
      this.logger.log(`Učitan postojeći progress: ${this.progress.processedVehicles}/${this.progress.totalVehicles} vozila`);
    } else {
      this.progress = {
        status: 'idle',
        totalVehicles: 0,
        processedVehicles: 0,
        currentBatch: 0,
        totalBatches: 0,
        vehiclesInCurrentBatch: [],
        errors: [],
        stats: {
          totalPointsProcessed: 0,
          averageTimePerBatch: 0,
          successRate: 100,
          diskSpaceUsed: '0GB',
          compressionRatio: 1,
        },
      };
    }

    const savedConfig = await this.getSetting<SlowSyncConfig>(
      this.SETTINGS_KEY + '_config'
    );
    
    if (savedConfig) {
      this.currentConfig = savedConfig;
    } else {
      this.currentConfig = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): SlowSyncConfig {
    return {
      preset: SlowSyncPreset.CONSERVATIVE,
      ...this.PRESETS[SlowSyncPreset.CONSERVATIVE],
      syncDaysBack: 120,
      autoCleanup: true,
      compressAfterBatches: 5,
      vacuumAfterBatches: 20,
    } as SlowSyncConfig;
  }

  async startSlowSync(config?: Partial<SlowSyncConfig>): Promise<SlowSyncProgress> {
    if (this.isRunning && !this.isPaused) {
      throw new Error('Slow sync je već pokrenut');
    }

    if (config) {
      if (config.preset) {
        this.currentConfig = {
          ...this.getDefaultConfig(),
          ...this.PRESETS[config.preset],
          ...config,
        };
      } else {
        this.currentConfig = { ...this.currentConfig, ...config };
      }
      
      await this.setSetting(
        this.SETTINGS_KEY + '_config',
        this.currentConfig
      );
    }

    if (this.isPaused) {
      this.logger.log('Nastavljam pauzirani slow sync...');
      this.isPaused = false;
      this.isRunning = true;
      this.progress.status = 'running';
      await this.saveProgress();
      return this.progress;
    }

    this.logger.log(`Pokrećem Smart Slow Sync sa preset: ${this.currentConfig.preset}`);
    this.logger.log(`Konfiguracija: ${this.currentConfig.vehiclesPerBatch} vozila po batch-u, ${this.currentConfig.workersPerBatch} worker-a`);

    await this.initializeVehicleQueue();
    
    this.isRunning = true;
    this.progress.status = 'running';
    this.progress.startedAt = new Date();
    this.progress.currentBatch = 0;
    this.progress.totalBatches = Math.ceil(
      this.vehicleQueue.length / this.currentConfig.vehiclesPerBatch
    );

    await this.saveProgress();
    
    this.logger.log(`Započinjem sinhronizaciju ${this.vehicleQueue.length} vozila u ${this.progress.totalBatches} batch-ova`);
    
    return this.progress;
  }

  async pauseSlowSync(): Promise<SlowSyncProgress> {
    if (!this.isRunning || this.isPaused) {
      throw new Error('Slow sync nije pokrenut ili je već pauziran');
    }

    this.logger.log('Pauziram slow sync...');
    this.isPaused = true;
    this.progress.status = 'paused';
    await this.saveProgress();
    
    return this.progress;
  }

  async resumeSlowSync(): Promise<SlowSyncProgress> {
    if (!this.isPaused) {
      throw new Error('Slow sync nije pauziran');
    }

    this.logger.log('Nastavljam slow sync...');
    this.isPaused = false;
    this.isRunning = true;
    this.progress.status = 'running';
    await this.saveProgress();
    
    return this.progress;
  }

  async stopSlowSync(): Promise<SlowSyncProgress> {
    if (!this.isRunning) {
      throw new Error('Slow sync nije pokrenut');
    }

    this.logger.log('Zaustavljam slow sync...');
    this.isRunning = false;
    this.isPaused = false;
    this.progress.status = 'idle';
    await this.saveProgress();
    
    return this.progress;
  }

  async getProgress(): Promise<SlowSyncProgress> {
    if (this.progress.status === 'running' && this.progress.totalBatches > 0) {
      const averageTimePerBatch = this.progress.stats.averageTimePerBatch || 45;
      const remainingBatches = this.progress.totalBatches - this.progress.currentBatch;
      const remainingMinutes = remainingBatches * averageTimePerBatch;
      
      const hoursPerDay = this.currentConfig.nightHoursEnd >= this.currentConfig.nightHoursStart 
        ? this.currentConfig.nightHoursEnd - this.currentConfig.nightHoursStart
        : (24 - this.currentConfig.nightHoursStart) + this.currentConfig.nightHoursEnd;
      
      const remainingDays = Math.ceil(remainingMinutes / (hoursPerDay * 60));
      
      this.progress.estimatedCompletion = new Date(
        Date.now() + remainingDays * 24 * 60 * 60 * 1000
      );
    }
    
    return this.progress;
  }

  async updateConfig(config: Partial<SlowSyncConfig>): Promise<SlowSyncConfig> {
    if (this.isRunning && !this.isPaused) {
      throw new Error('Ne možete menjati konfiguraciju dok je sync aktivan. Prvo pauzirajte.');
    }

    if (config.preset) {
      this.currentConfig = {
        ...this.getDefaultConfig(),
        ...this.PRESETS[config.preset],
        ...config,
      };
    } else {
      this.currentConfig = { ...this.currentConfig, ...config };
    }

    await this.setSetting(
      this.SETTINGS_KEY + '_config',
      this.currentConfig
    );

    this.logger.log(`Konfiguracija ažurirana: ${JSON.stringify(this.currentConfig)}`);
    
    return this.currentConfig;
  }

  @Cron('0 * * * *') // Svaki sat
  async processBatch() {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    const currentHour = new Date().getHours();
    const isNightTime = this.isInNightHours(currentHour);

    if (!isNightTime) {
      this.logger.log(`Trenutno je ${currentHour}h, čekam noćne sate (${this.currentConfig.nightHoursStart}h-${this.currentConfig.nightHoursEnd}h)`);
      return;
    }

    const dailyBatchesProcessed = await this.getDailyBatchCount();
    if (dailyBatchesProcessed >= this.currentConfig.maxDailyBatches) {
      this.logger.log(`Dostignut dnevni limit od ${this.currentConfig.maxDailyBatches} batch-ova`);
      return;
    }

    if (this.vehicleQueue.length === 0) {
      this.logger.log('Sva vozila su procesirana!');
      this.progress.status = 'completed';
      this.progress.completedAt = new Date();
      this.isRunning = false;
      await this.saveProgress();
      return;
    }

    try {
      await this.performHealthCheck();
      
      const batchVehicles = this.vehicleQueue.splice(0, this.currentConfig.vehiclesPerBatch);
      this.progress.currentBatch++;
      this.progress.vehiclesInCurrentBatch = batchVehicles.map(id => `ID:${id}`);
      this.progress.lastBatchAt = new Date();
      
      this.logger.log(`Započinjem batch ${this.progress.currentBatch}/${this.progress.totalBatches} sa ${batchVehicles.length} vozila`);
      
      const startTime = Date.now();
      
      // Koristi Worker Pool servis za batch sinhronizaciju
      const syncFrom = new Date();
      syncFrom.setDate(syncFrom.getDate() - this.currentConfig.syncDaysBack);
      const syncTo = new Date();
      
      const workerResults = await this.workerPoolService.startWorkerPoolSync(
        batchVehicles,
        syncFrom,
        syncTo,
        `slow-sync-batch-${this.progress.currentBatch}`,
        false // Slow Sync NIKAD ne osvežava aggregates odmah (štedi resurse)
      );
      
      // Konvertuj rezultate u format koji o\u010dekujemo
      let successCount = 0;
      let totalGpsPoints = 0;
      const failedVehicles: number[] = [];
      
      workerResults.forEach((result, vehicleId) => {
        if (result.status === 'completed') {
          successCount++;
          totalGpsPoints += result.processedRecords;
        } else {
          failedVehicles.push(vehicleId);
        }
      });
      
      const result = {
        successCount,
        totalGpsPoints,
        failedVehicles
      };

      const duration = (Date.now() - startTime) / 1000 / 60; // minuti
      
      this.progress.processedVehicles += result.successCount;
      this.progress.stats.totalPointsProcessed += result.totalGpsPoints || 0;
      
      const totalTime = this.progress.stats.averageTimePerBatch * (this.progress.currentBatch - 1);
      this.progress.stats.averageTimePerBatch = (totalTime + duration) / this.progress.currentBatch;
      
      this.progress.stats.successRate = (this.progress.processedVehicles / 
        (this.progress.processedVehicles + this.progress.errors.length)) * 100;

      if (result.failedVehicles && result.failedVehicles.length > 0) {
        for (const failed of result.failedVehicles) {
          this.progress.errors.push({
            vehicleId: failed,
            error: 'Sync failed',
            timestamp: new Date(),
          });
        }
      }

      await this.saveProgress();
      await this.createCheckpoint();

      if (this.progress.currentBatch % this.currentConfig.compressAfterBatches === 0) {
        await this.performCompression();
      }

      if (this.progress.currentBatch % this.currentConfig.vacuumAfterBatches === 0) {
        await this.performVacuum();
      }

      this.logger.log(`Batch ${this.progress.currentBatch} završen za ${duration.toFixed(1)} minuta`);
      
      this.logger.log(`Pauziram ${this.currentConfig.batchDelayMinutes} minuta pre sledećeg batch-a...`);
      
    } catch (error) {
      this.logger.error(`Greška u batch ${this.progress.currentBatch}: ${error.message}`);
      this.vehicleQueue.unshift(...this.progress.vehiclesInCurrentBatch.map(v => parseInt(v.split(':')[1])));
      this.progress.errors.push({
        vehicleId: 0,
        error: `Batch ${this.progress.currentBatch} failed: ${error.message}`,
        timestamp: new Date(),
      });
      await this.saveProgress();
    }
  }

  private async initializeVehicleQueue() {
    const vehicles = await this.prisma.busVehicle.findMany({
      where: {
        active: true,
        legacyId: { not: null },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    this.vehicleQueue = vehicles.map(v => v.id);
    this.progress.totalVehicles = this.vehicleQueue.length;
    
    this.logger.log(`Inicijalizovan queue sa ${this.vehicleQueue.length} vozila`);
  }

  private isInNightHours(hour: number): boolean {
    const { nightHoursStart, nightHoursEnd } = this.currentConfig;
    
    if (nightHoursStart < nightHoursEnd) {
      return hour >= nightHoursStart && hour < nightHoursEnd;
    } else {
      return hour >= nightHoursStart || hour < nightHoursEnd;
    }
  }

  private async getDailyBatchCount(): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const checkpoints = await this.getSetting<SlowSyncCheckpoint[]>(
      this.SETTINGS_KEY + '_checkpoints'
    ) || [];
    
    return checkpoints.filter(c => c.createdAt >= todayStart).length;
  }

  private async performHealthCheck() {
    try {
      // 1. Proveri database konekcije
      const pgConnections = await this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      
      const connectionCount = parseInt(pgConnections[0]?.count || '0');
      if (connectionCount > 90) {
        throw new Error(`Previše database konekcija: ${connectionCount}`);
      }

      // 2. Proveri disk prostor
      const diskSpace = await this.prisma.$queryRaw<any[]>`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          pg_database_size(current_database()) as db_size_bytes
      `;
      
      if (diskSpace[0]) {
        this.progress.stats.diskSpaceUsed = diskSpace[0].db_size;
      }

      // 3. Proveri table size
      const tableSize = await this.prisma.$queryRaw<any[]>`
        SELECT 
          pg_size_pretty(pg_total_relation_size('gps_data')) as table_size,
          pg_total_relation_size('gps_data') as table_size_bytes
      `;
      
      // Ako je tabela veća od 500GB, upozori
      const tableSizeGB = parseInt(tableSize[0]?.table_size_bytes || '0') / (1024 * 1024 * 1024);
      if (tableSizeGB > 500) {
        this.logger.warn(`GPS tabela je velika: ${tableSize[0].table_size}. Razmotrite arhiviranje starih podataka.`);
      }

      // 4. Proveri aktivne query-je
      const activeQueries = await this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count 
        FROM pg_stat_activity 
        WHERE state = 'active' 
          AND query NOT LIKE '%pg_stat_activity%'
      `;
      
      const activeCount = parseInt(activeQueries[0]?.count || '0');
      if (activeCount > 10) {
        this.logger.warn(`Previše aktivnih query-ja: ${activeCount}. Čekam da se završe...`);
        await new Promise(resolve => setTimeout(resolve, 30000)); // Čekaj 30 sekundi
      }

      this.logger.debug(`Health check passed - Connections: ${connectionCount}, DB Size: ${this.progress.stats.diskSpaceUsed}, Active queries: ${activeCount}`);
      
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      throw error;
    }
  }

  private async performCompression() {
    this.logger.log('Pokrećem kompresiju starih chunk-ova...');
    
    try {
      // Prvo proveri da li je kompresija omogućena na tabeli
      const compressionSettings = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM timescaledb_information.compression_settings 
        WHERE hypertable_name = 'gps_data'
      `;
      
      if (!compressionSettings || compressionSettings.length === 0) {
        this.logger.warn('Kompresija nije omogućena na gps_data tabeli. Preskačem...');
        return;
      }

      // Kompresuj chunk-ove starije od 7 dana
      const chunksToCompress = await this.prisma.$queryRaw<any[]>`
        SELECT 
          chunk_schema,
          chunk_name,
          range_start,
          range_end
        FROM timescaledb_information.chunks 
        WHERE hypertable_name = 'gps_data'
          AND range_end < NOW() - INTERVAL '7 days'
          AND is_compressed = false
        ORDER BY range_start
        LIMIT 5
      `;
      
      let compressedCount = 0;
      for (const chunk of chunksToCompress) {
        try {
          await this.prisma.$executeRaw`
            SELECT compress_chunk('${chunk.chunk_schema}.${chunk.chunk_name}'::regclass)
          `;
          compressedCount++;
          this.logger.debug(`Kompresovan chunk: ${chunk.chunk_name}`);
        } catch (error) {
          this.logger.warn(`Ne mogu kompresovati chunk ${chunk.chunk_name}: ${error.message}`);
        }
      }
      
      if (compressedCount > 0) {
        this.logger.log(`Kompresovano ${compressedCount} chunk-ova`);
        
        // Ažuriraj compression ratio
        const stats = await this.prisma.$queryRaw<any[]>`
          SELECT 
            COALESCE(
              SUM(before_compression_total_bytes)::float / 
              NULLIF(SUM(after_compression_total_bytes)::float, 0), 
              1
            ) AS ratio
          FROM timescaledb_information.compression_chunk_size
          WHERE hypertable_name = 'gps_data'
        `;
        
        if (stats && stats[0]) {
          this.progress.stats.compressionRatio = parseFloat(stats[0].ratio) || 1;
          this.logger.log(`Compression ratio: ${this.progress.stats.compressionRatio.toFixed(2)}x`);
        }
      } else {
        this.logger.debug('Nema chunk-ova za kompresiju');
      }
    } catch (error) {
      this.logger.error(`Greška pri kompresiji: ${error.message}`);
      // Ne prekidaj proces zbog greške u kompresiji
    }
  }

  private async performVacuum() {
    this.logger.log('Pokrećem VACUUM ANALYZE...');
    
    try {
      // VACUUM ANALYZE na glavnoj tabeli
      await this.prisma.$executeRaw`VACUUM ANALYZE gps_data`;
      this.logger.log('VACUUM ANALYZE na gps_data završen');
      
      // VACUUM ANALYZE na continuous aggregates
      const aggregates = [
        'vehicle_hourly_stats',
        'daily_vehicle_stats',
        'monthly_vehicle_raw_stats'
      ];
      
      for (const aggregate of aggregates) {
        try {
          await this.prisma.$executeRaw`VACUUM ANALYZE ${aggregate}`;
          this.logger.debug(`VACUUM ANALYZE na ${aggregate} završen`);
        } catch (error) {
          this.logger.warn(`Ne mogu vacuum-ovati ${aggregate}: ${error.message}`);
        }
      }
      
      // Proveri da li je potreban REINDEX
      const bloat = await this.prisma.$queryRaw<any[]>`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          ROUND(100 * pg_total_relation_size(schemaname||'.'||tablename) / 
                NULLIF(SUM(pg_total_relation_size(schemaname||'.'||tablename)) 
                OVER (), 0), 2) AS percentage
        FROM pg_tables
        WHERE tablename = 'gps_data'
        GROUP BY schemaname, tablename
      `;
      
      if (bloat && bloat[0]) {
        this.logger.log(`Table size nakon VACUUM: ${bloat[0].size}`);
      }
      
    } catch (error) {
      this.logger.error(`Greška pri VACUUM ANALYZE: ${error.message}`);
      // Ne prekidaj proces zbog greške u vacuum-u
    }
  }

  private async createCheckpoint() {
    const checkpoints = await this.getSetting<SlowSyncCheckpoint[]>(
      this.SETTINGS_KEY + '_checkpoints'
    ) || [];
    
    const newCheckpoint: SlowSyncCheckpoint = {
      batchNumber: this.progress.currentBatch,
      vehiclesProcessed: this.progress.vehiclesInCurrentBatch.map(v => parseInt(v.split(':')[1])),
      lastProcessedTime: new Date(),
      totalPoints: this.progress.stats.totalPointsProcessed,
      createdAt: new Date(),
    };
    
    checkpoints.push(newCheckpoint);
    
    // Čuvaj samo poslednjih 100 checkpoint-ova
    if (checkpoints.length > 100) {
      checkpoints.shift();
    }
    
    await this.setSetting(
      this.SETTINGS_KEY + '_checkpoints',
      checkpoints
    );
  }

  private async saveProgress() {
    await this.setSetting(
      this.SETTINGS_KEY + '_progress',
      this.progress
    );
  }

  async resetProgress(): Promise<void> {
    this.progress = {
      status: 'idle',
      totalVehicles: 0,
      processedVehicles: 0,
      currentBatch: 0,
      totalBatches: 0,
      vehiclesInCurrentBatch: [],
      errors: [],
      stats: {
        totalPointsProcessed: 0,
        averageTimePerBatch: 0,
        successRate: 100,
        diskSpaceUsed: '0GB',
        compressionRatio: 1,
      },
    };
    
    await this.setSetting(this.SETTINGS_KEY + '_progress', null);
    await this.setSetting(this.SETTINGS_KEY + '_checkpoints', null);
    
    this.logger.log('Progress resetovan');
  }
}