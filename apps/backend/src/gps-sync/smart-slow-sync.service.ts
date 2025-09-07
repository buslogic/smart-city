import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacySyncWorkerPoolService, WorkerResult } from './legacy-sync-worker-pool.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export enum SlowSyncPreset {
  FAST = 'fast',
  BALANCED = 'balanced', 
  CONSERVATIVE = 'conservative',
  CUSTOM = 'custom'
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
  forceProcess: boolean;
}

export interface SlowSyncProgress {
  status: 'idle' | 'running' | 'paused' | 'waiting_for_next_batch' | 'completed' | 'error';
  startedAt?: Date;
  lastBatchAt?: Date;
  nextBatchStartTime?: Date;  // Novo: vreme kada će početi sledeći batch
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
export class SmartSlowSyncService implements OnModuleInit {
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
    [SlowSyncPreset.CUSTOM]: {
      // Custom nema predefinisane vrednosti - korisnik sam podešava
      // Koristi default vrednosti iz getDefaultConfig()
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly workerPoolService: LegacySyncWorkerPoolService,
  ) {
    // Inicijalizacija će se obaviti u onModuleInit
  }

  async onModuleInit() {
    await this.initializeProgress();
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
    
    this.logger.debug(`Saved config from DB:`, JSON.stringify(savedConfig, null, 2));
    
    if (savedConfig && savedConfig.preset && savedConfig.vehiclesPerBatch && savedConfig.workersPerBatch) {
      this.logger.log(`Koristim saved config sa preset: ${savedConfig.preset}`);
      this.currentConfig = savedConfig;
    } else {
      this.logger.log('Saved config je prazan ili neispravan, koristim default config');
      this.currentConfig = this.getDefaultConfig();
    }
    
    // Učitaj forceProcess kao separan setting
    const forceProcessSetting = await this.getSetting<boolean>('smart_slow_sync.force_process');
    
    if (forceProcessSetting !== null && forceProcessSetting !== undefined) {
      this.currentConfig.forceProcess = forceProcessSetting;
      this.logger.log(`Učitan forceProcess iz baze: ${forceProcessSetting}`);
    } else {
      // Prvi put - postavi default false (UNCHECKED - poštuje noćne sate)
      this.currentConfig.forceProcess = false;
      await this.setSetting('smart_slow_sync.force_process', false);
      this.logger.log(`Postavljen default forceProcess: false (UNCHECKED - poštuje noćne sate)`);
    }
    
    this.logger.debug(`Final currentConfig:`, JSON.stringify(this.currentConfig, null, 2));
  }

  private getDefaultConfig(): SlowSyncConfig {
    return {
      preset: SlowSyncPreset.CONSERVATIVE,
      ...this.PRESETS[SlowSyncPreset.CONSERVATIVE],
      syncDaysBack: 120,
      autoCleanup: true,
      compressAfterBatches: 5,
      vacuumAfterBatches: 20,
      forceProcess: false,
    } as SlowSyncConfig;
  }

  async startSlowSync(config?: Partial<SlowSyncConfig>): Promise<SlowSyncProgress> {
    // Osiguraj da je config inicijalizovan
    if (!this.currentConfig) {
      this.logger.log('Config nije inicijalizovan, inicijalizujem...');
      await this.initializeProgress();
    }

    if (this.isRunning && !this.isPaused) {
      this.logger.warn('Slow sync je već pokrenut');
      return this.progress;
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
      this.logger.warn('Pokušaj zaustavljanja slow sync koji nije pokrenut');
      // Samo vrati trenutni progress bez greške
      return this.progress;
    }

    this.logger.log('Zaustavljam slow sync...');
    this.isRunning = false;
    this.isPaused = false;
    this.progress.status = 'idle';
    this.progress.vehiclesInCurrentBatch = [];
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

  async getConfig(): Promise<SlowSyncConfig> {
    return this.currentConfig;
  }

  async updateConfig(config: Partial<SlowSyncConfig>): Promise<SlowSyncConfig> {
    // Dozvoliti ažuriranje konfiguracije ako je status completed, idle, ili pauziran
    const canUpdate = !this.isRunning || this.isPaused || this.progress?.status === 'completed' || this.progress?.status === 'idle';
    
    if (!canUpdate) {
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

    // Sačuvaj forceProcess kao poseban setting
    if (config.forceProcess !== undefined) {
      await this.setSetting('smart_slow_sync.force_process', config.forceProcess);
      this.logger.log(`forceProcess ažuriran u bazi: ${config.forceProcess}`);
    }
    
    // Sačuvaj ostatak konfiguracije (bez forceProcess da ne bude duplo)
    const configToSave = { ...this.currentConfig };
    delete (configToSave as any).forceProcess; // Ukloni da ne bude duplo
    
    await this.setSetting(
      this.SETTINGS_KEY + '_config',
      configToSave
    );

    this.logger.log(`Konfiguracija ažurirana: ${JSON.stringify(this.currentConfig)}`);
    
    return this.currentConfig;
  }

  @Cron('*/2 * * * *') // Svake 2 minuta proveri da li treba pokrenuti sledeći batch
  async checkBatchSchedule() {
    if (!this.isRunning || this.isPaused) {
      return;
    }
    
    // Posebno rukuj waiting_for_next_batch stanjem
    if (this.progress && this.progress.status === 'waiting_for_next_batch') {
      const now = new Date();
      
      if (this.progress.nextBatchStartTime) {
        const nextBatchTime = new Date(this.progress.nextBatchStartTime);
        
        if (now >= nextBatchTime) {
          this.logger.log(`⏰ CRON: Vreme je za sledeći batch! Prebacujem iz waiting u running...`);
          this.progress.status = 'running';
          await this.saveProgress();
          await this.processBatch(true);
        } else {
          const remainingMinutes = Math.ceil((nextBatchTime.getTime() - now.getTime()) / 60000);
          this.logger.log(`⏱️ CRON: Još ${remainingMinutes} minuta do sledećeg batch-a (waiting stanje)`);
        }
      }
      return;
    }
    
    // Originalna logika za running stanje
    if (this.vehicleQueue && this.vehicleQueue.length > 0) {
      // Ako nije pokrenut nijedan batch još uvek, pokreni prvi
      if (!this.progress.lastBatchAt && this.progress.currentBatch === 0) {
        this.logger.log(`⏰ CRON: Pokrećem prvi batch (forceProcess: ${this.currentConfig.forceProcess})...`);
        await this.processBatch(this.currentConfig.forceProcess);
      } 
      // Inače proveri da li je vreme za sledeći batch
      else if (this.progress.lastBatchAt) {
        const lastBatch = new Date(this.progress.lastBatchAt);
        const now = new Date();
        const delayMs = this.currentConfig.batchDelayMinutes * 60 * 1000;
        const nextRunTime = new Date(lastBatch.getTime() + delayMs);
        
        if (now >= nextRunTime) {
          this.logger.log(`⏰ CRON: Vreme je za sledeći batch (forceProcess: ${this.currentConfig.forceProcess})!`);
          await this.processBatch(this.currentConfig.forceProcess);
        } else {
          const remainingMinutes = Math.ceil((nextRunTime.getTime() - now.getTime()) / 60000);
          this.logger.log(`⏱️ CRON: Još ${remainingMinutes} minuta do sledećeg batch-a`);
        }
      }
    }
  }

  async processBatch(forceProcess: boolean = false) {
    const now = new Date();
    // Pouzdanije dobijanje Belgrade sata
    const belgradeDateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Belgrade',
      hour: 'numeric',
      hour12: false
    });
    const belgradeHour = parseInt(belgradeDateFormatter.format(now));
    
    this.logger.log(`ProcessBatch pokrenut - isRunning: ${this.isRunning}, isPaused: ${this.isPaused}, vehicleQueue.length: ${this.vehicleQueue?.length || 0}`);
    this.logger.log(`Vreme - Server UTC: ${now.toISOString()}, Belgrade hour: ${belgradeHour}, forceProcess: ${forceProcess}`);
    
    if (!this.isRunning || this.isPaused) {
      this.logger.log(`Batch processing preskočen - isRunning: ${this.isRunning}, isPaused: ${this.isPaused}`);
      return;
    }

    // Koristi Belgrade vreme za proveru noćnih sati
    const isNightTime = this.isInNightHours(belgradeHour);
    this.logger.log(`Vremenska provera - Belgrade hour: ${belgradeHour}, nightHoursStart: ${this.currentConfig.nightHoursStart}, nightHoursEnd: ${this.currentConfig.nightHoursEnd}, isNightTime: ${isNightTime}`);

    if (!forceProcess && !isNightTime) {
      this.logger.log(`Trenutno je ${belgradeHour}h po Belgrade vremenu, čekam noćne sate (${this.currentConfig.nightHoursStart}h-${this.currentConfig.nightHoursEnd}h). Koristi forceProcess=true za prinudno pokretanje.`);
      return;
    }

    const dailyBatchesProcessed = await this.getDailyBatchCount();
    if (dailyBatchesProcessed >= this.currentConfig.maxDailyBatches) {
      this.logger.log(`Dostignut dnevni limit od ${this.currentConfig.maxDailyBatches} batch-ova`);
      return;
    }

    if (!this.vehicleQueue || this.vehicleQueue.length === 0) {
      this.logger.log('Sva vozila su procesirana ili vehicleQueue nije inicijalizovan!');
      
      // Pokušaj da reinicijalizuješ queue ako je prazan
      await this.initializeVehicleQueue();
      
      if (this.vehicleQueue.length === 0) {
        this.progress.status = 'completed';
        this.progress.completedAt = new Date();
        this.isRunning = false;
        await this.saveProgress();
        return;
      }
    }

    try {
      await this.performHealthCheck();
      
      const batchVehicles = this.vehicleQueue.splice(0, this.currentConfig.vehiclesPerBatch);
      
      // Proveri da batch nije prazan
      if (batchVehicles.length === 0) {
        this.logger.warn(`Batch ${this.progress.currentBatch + 1} je prazan - završavam Smart Slow Sync`);
        this.progress.status = 'completed';
        this.progress.completedAt = new Date();
        this.isRunning = false;
        await this.saveProgress();
        return;
      }
      
      // Dobavi garažne brojeve za vozila u batch-u
      const vehicles = await this.prisma.busVehicle.findMany({
        where: { id: { in: batchVehicles } },
        select: { id: true, garageNumber: true }
      });
      
      // Kreiraj mapu ID -> garažni broj
      const vehicleMap = new Map(vehicles.map(v => [v.id, v.garageNumber]));
      
      this.progress.currentBatch++;
      // Koristi garažne brojeve umesto ID-eva
      this.progress.vehiclesInCurrentBatch = batchVehicles.map(id => {
        const garageNumber = vehicleMap.get(id);
        return garageNumber || `ID:${id}`; // Fallback na ID ako nema garažnog broja
      });
      this.progress.lastBatchAt = new Date();
      
      this.logger.log(`Rozpoczinjem batch ${this.progress.currentBatch}/${this.progress.totalBatches} sa ${batchVehicles.length} vozila`);
      
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
        false, // Slow Sync NIKAD ne osvežava aggregates odmah (štedi resurse)
        this.progress.currentBatch > 1 // Zadrži completed statuse ako nije prvi batch
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
      
      // Ažuriraj statistike za svako vozilo
      for (const vehicleId of batchVehicles) {
        const wasSuccessful = !failedVehicles.includes(vehicleId);
        const vehicleResult = workerResults.get(vehicleId);
        
        // Snimi istoriju sync-a
        await this.prisma.smartSlowSyncHistory.create({
          data: {
            vehicleId,
            batchNumber: this.progress.currentBatch,
            syncStartDate: syncFrom,
            syncEndDate: syncTo,
            status: wasSuccessful ? 'completed' : 'failed',
            pointsProcessed: vehicleResult?.processedRecords || 0,
            processingTimeMs: Math.round(duration * 60 * 1000 / batchVehicles.length),
            startedAt: new Date(startTime),
            completedAt: new Date(),
            error: wasSuccessful ? null : vehicleResult?.error || null,
          },
        });
        
        // Ažuriraj glavnu tabelu vozila
        await this.prisma.smartSlowSyncVehicle.update({
          where: { vehicleId },
          data: {
            lastSyncAt: new Date(),
            lastSuccessfulSyncAt: wasSuccessful ? new Date() : undefined,
            totalSyncCount: { increment: 1 },
            successfulSyncCount: wasSuccessful ? { increment: 1 } : undefined,
            failedSyncCount: !wasSuccessful ? { increment: 1 } : undefined,
            totalPointsProcessed: { increment: vehicleResult?.processedRecords || 0 },
            lastError: wasSuccessful ? null : vehicleResult?.error || null,
          },
        });
      }
      
      // Snimi batch informacije - koristi upsert da izbegne duplicate key error
      await this.prisma.smartSlowSyncBatch.upsert({
        where: {
          batchNumber: this.progress.currentBatch,
        },
        update: {
          vehicleIds: batchVehicles,
          totalVehicles: batchVehicles.length,
          processedVehicles: result.successCount,
          status: 'completed',
          totalPointsProcessed: BigInt(result.totalGpsPoints || 0),
          completedAt: new Date(),
          processingTimeMs: Math.round(duration * 60 * 1000),
        },
        create: {
          batchNumber: this.progress.currentBatch,
          vehicleIds: batchVehicles,
          totalVehicles: batchVehicles.length,
          processedVehicles: result.successCount,
          status: 'completed',
          totalPointsProcessed: BigInt(result.totalGpsPoints || 0),
          startedAt: new Date(startTime),
          completedAt: new Date(),
          processingTimeMs: Math.round(duration * 60 * 1000),
        },
      });
      
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
      
      // Ako ima još vozila, prebaci u waiting stanje
      if (this.vehicleQueue && this.vehicleQueue.length > 0) {
        this.logger.log(`⏸️ Pauziram ${this.currentConfig.batchDelayMinutes} minuta pre sledećeg batch-a...`);
        this.logger.log(`📊 Preostalo vozila u queue: ${this.vehicleQueue.length}`);
        this.logger.log(`🔄 CRON će automatski pokrenuti sledeći batch nakon pauze (proverava svake 2 minuta)`);
        
        // Prebaci u waiting stanje i očisti trenutne vozila
        this.progress.status = 'waiting_for_next_batch';
        this.progress.vehiclesInCurrentBatch = []; // Očisti kartice vozila
        this.progress.lastBatchAt = new Date();
        
        // Izračunaj kada će početi sledeći batch
        const nextBatchTime = new Date();
        nextBatchTime.setMinutes(nextBatchTime.getMinutes() + this.currentConfig.batchDelayMinutes);
        this.progress.nextBatchStartTime = nextBatchTime;
        
        await this.saveProgress();
      } else {
        this.logger.log(`✅ Svi batch-ovi završeni! Ukupno procesiranih vozila: ${this.progress.processedVehicles}`);
        this.progress.status = 'completed';
        this.progress.completedAt = new Date();
        this.progress.vehiclesInCurrentBatch = []; // Očisti i za completed
        await this.saveProgress();
      }
      
    } catch (error) {
      this.logger.error(`Greška u batch ${this.progress.currentBatch}: ${error.message}`);
      // Vraćamo originalne vehicle ID-eve nazad u queue
      // Već imamo batchVehicles koji sadrži ID-eve, ali moramo ga ponovo dobiti iz vehiclesInCurrentBatch
      // ako je error nastao nakon što smo izgubili batchVehicles scope
      const vehiclesToReturn: number[] = [];
      for (const vehicleInfo of this.progress.vehiclesInCurrentBatch) {
        if (vehicleInfo.startsWith('ID:')) {
          // Ako je još uvek u ID formatu
          vehiclesToReturn.push(parseInt(vehicleInfo.split(':')[1]));
        } else {
          // Ako je garažni broj, moramo pronaći ID
          const vehicle = await this.prisma.busVehicle.findUnique({
            where: { garageNumber: vehicleInfo },
            select: { id: true }
          });
          if (vehicle) {
            vehiclesToReturn.push(vehicle.id);
          }
        }
      }
      this.vehicleQueue.unshift(...vehiclesToReturn);
      this.progress.errors.push({
        vehicleId: 0,
        error: `Batch ${this.progress.currentBatch} failed: ${error.message}`,
        timestamp: new Date(),
      });
      await this.saveProgress();
    }
  }

  private async initializeVehicleQueue() {
    // Uzmi samo vozila koja su označena za Smart Slow Sync
    const syncVehicles = await this.prisma.smartSlowSyncVehicle.findMany({
      where: {
        enabled: true,
      },
      orderBy: [
        { priority: 'desc' },  // Viši prioritet prvi
        { lastSyncAt: 'asc' },  // Najstariji sync prvi
      ],
      select: { 
        vehicleId: true,
        priority: true,
      },
    });

    this.vehicleQueue = syncVehicles.map(v => v.vehicleId);
    this.progress.totalVehicles = this.vehicleQueue.length;
    
    this.logger.log(`Inicijalizovan queue sa ${this.vehicleQueue.length} vozila označenih za Smart Slow Sync`);
    
    if (this.vehicleQueue.length === 0) {
      this.logger.warn('Nema vozila označenih za Smart Slow Sync! Dodajte vozila u smart_slow_sync_vehicles tabelu.');
    }
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
      // 1. Proveri database konekcije (MySQL)
      const connections = await this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count 
        FROM information_schema.PROCESSLIST 
        WHERE DB = DATABASE()
      `;
      
      const connectionCount = parseInt(connections[0]?.count || '0');
      if (connectionCount > 90) {
        throw new Error(`Previše database konekcija: ${connectionCount}`);
      }

      // 2. Proveri database veličinu (MySQL)
      const dbInfo = await this.prisma.$queryRaw<any[]>`
        SELECT 
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as db_size_mb,
          SUM(data_length + index_length) as db_size_bytes
        FROM information_schema.TABLES 
        WHERE table_schema = DATABASE()
      `;
      
      if (dbInfo[0]) {
        const sizeMB = parseFloat(dbInfo[0].db_size_mb || '0');
        if (sizeMB >= 1024) {
          this.progress.stats.diskSpaceUsed = `${(sizeMB / 1024).toFixed(2)} GB`;
        } else {
          this.progress.stats.diskSpaceUsed = `${sizeMB.toFixed(2)} MB`;
        }
      }

      // 3. Proveri veličinu smart_slow_sync tabela
      const tableInfo = await this.prisma.$queryRaw<any[]>`
        SELECT 
          table_name,
          ROUND((data_length + index_length) / 1024 / 1024, 2) as table_size_mb,
          table_rows as row_count
        FROM information_schema.TABLES 
        WHERE table_schema = DATABASE()
          AND table_name IN ('smart_slow_sync_vehicles', 'smart_slow_sync_logs', 'smart_slow_sync_batches')
      `;
      
      // Log table sizes
      for (const table of tableInfo) {
        if (table.table_size_mb > 1000) {
          this.logger.warn(`Tabela ${table.table_name} je velika: ${table.table_size_mb} MB, ${table.row_count} redova. Razmotrite arhiviranje starih podataka.`);
        }
      }

      // 4. Proveri aktivne query-je (MySQL)
      const activeQueries = await this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count 
        FROM information_schema.PROCESSLIST 
        WHERE COMMAND != 'Sleep' 
          AND INFO NOT LIKE '%PROCESSLIST%'
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
    // MySQL nema TimescaleDB kompresiju
    // Možemo samo da arhiviramo stare podatke
    this.logger.log('Provera starih podataka za arhiviranje...');
    
    try {
      // Proveri koliko ima starih sync history zapisa (starijih od 30 dana)
      const oldHistory = await this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count 
        FROM smart_slow_sync_history 
        WHERE started_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
      `;
      
      const oldCount = parseInt(oldHistory[0]?.count || '0');
      if (oldCount > 10000) {
        this.logger.warn(`Ima ${oldCount} starih history zapisa. Razmotrite arhiviranje.`);
        
        // Možemo obrisati veoma stare history zapise (starije od 90 dana)
        const deletedHistory = await this.prisma.smartSlowSyncHistory.deleteMany({
          where: {
            startedAt: {
              lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            }
          }
        });
        
        if (deletedHistory.count > 0) {
          this.logger.log(`Obrisano ${deletedHistory.count} starih history zapisa`);
        }
      }
      
      // Proveri batch tabelu
      const oldBatches = await this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count 
        FROM smart_slow_sync_batches 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
      `;
      
      const oldBatchCount = parseInt(oldBatches[0]?.count || '0');
      if (oldBatchCount > 1000) {
        this.logger.warn(`Ima ${oldBatchCount} starih batch zapisa. Razmotrite arhiviranje.`);
      }
      
      // Postavi stats za prikaz
      this.progress.stats.compressionRatio = 1; // Nema kompresije u MySQL
      
    } catch (error) {
      this.logger.error(`Greška pri čišćenju starih podataka: ${error.message}`);
      // Ne prekidaj proces zbog greške
    }
  }

  private async performVacuum() {
    this.logger.log('Pokrećem optimizaciju tabela...');
    
    try {
      // MySQL koristi OPTIMIZE TABLE umesto VACUUM
      const tables = [
        'smart_slow_sync_vehicles',
        'smart_slow_sync_logs', 
        'smart_slow_sync_batches'
      ];
      
      for (const table of tables) {
        try {
          await this.prisma.$executeRawUnsafe(`OPTIMIZE TABLE ${table}`);
          this.logger.debug(`Optimizovana tabela: ${table}`);
        } catch (error) {
          this.logger.warn(`Ne mogu optimizovati ${table}: ${error.message}`);
        }
      }
      
      // Proveri veličinu tabela nakon optimizacije
      const tableStats = await this.prisma.$queryRaw<any[]>`
        SELECT 
          table_name,
          ROUND((data_length + index_length) / 1024 / 1024, 2) as size_mb,
          table_rows
        FROM information_schema.TABLES 
        WHERE table_schema = DATABASE()
          AND table_name IN ('smart_slow_sync_vehicles', 'smart_slow_sync_logs', 'smart_slow_sync_batches')
      `;
      
      if (tableStats && tableStats.length > 0) {
        for (const stat of tableStats) {
          this.logger.log(`Tabela ${stat.table_name}: ${stat.size_mb} MB, ${stat.table_rows} redova`);
        }
      }
      
    } catch (error) {
      this.logger.error(`Greška pri optimizaciji tabela: ${error.message}`);
      // Ne prekidaj proces zbog greške u optimizaciji
    }
  }

  private async createCheckpoint() {
    const checkpoints = await this.getSetting<SlowSyncCheckpoint[]>(
      this.SETTINGS_KEY + '_checkpoints'
    ) || [];
    
    // Konvertuj garažne brojeve nazad u ID-eve za checkpoint
    const vehicleIds: number[] = [];
    for (const vehicleInfo of this.progress.vehiclesInCurrentBatch) {
      if (vehicleInfo.startsWith('ID:')) {
        vehicleIds.push(parseInt(vehicleInfo.split(':')[1]));
      } else {
        // Ako je garažni broj, pronađi ID
        const vehicle = await this.prisma.busVehicle.findUnique({
          where: { garageNumber: vehicleInfo },
          select: { id: true }
        });
        if (vehicle) {
          vehicleIds.push(vehicle.id);
        }
      }
    }
    
    const newCheckpoint: SlowSyncCheckpoint = {
      batchNumber: this.progress.currentBatch,
      vehiclesProcessed: vehicleIds,
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

  /**
   * Dobij activity feed sa live porukama
   */
  async getActivityFeed(limit: number = 50): Promise<Array<{
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>> {
    // Kombinuj različite izvore activity feed-a
    const activities: Array<{
      timestamp: string;
      message: string;
      type: 'info' | 'success' | 'warning' | 'error';
    }> = [];

    // 1. Worker Pool statuses kao activity
    const workers = this.workerPoolService.getWorkerStatuses();
    workers.forEach(worker => {
      if (worker.status !== 'idle') {
        let message = '';
        let type: 'info' | 'success' | 'warning' | 'error' = 'info';

        switch (worker.status) {
          case 'exporting':
            message = `🚗 ${worker.garageNumber} - Exportovanje sa legacy servera`;
            type = 'info';
            break;
          case 'transferring':
            message = `🚛 ${worker.garageNumber} - Transfer fajla u toku`;
            type = 'info';
            break;
          case 'importing':
            message = `📥 ${worker.garageNumber} - Import u TimescaleDB: ${worker.processedRecords?.toLocaleString() || 0}/${worker.totalRecords?.toLocaleString() || 0} tačaka`;
            type = 'info';
            break;
          case 'detecting':
            message = `🎯 ${worker.garageNumber} - Detekcija agresivne vožnje u toku`;
            type = 'warning';
            break;
          case 'refreshing':
            message = `📊 ${worker.garageNumber} - Osvežavanje continuous agregata`;
            type = 'info';
            break;
          case 'completed':
            message = `✅ ${worker.garageNumber} - Uspešno završeno: ${worker.totalRecords?.toLocaleString() || 0} GPS tačaka`;
            type = 'success';
            break;
          case 'failed':
            message = `❌ ${worker.garageNumber} - Greška: Unknown error`;
            type = 'error';
            break;
        }

        activities.push({
          timestamp: worker.startTime?.toISOString() || new Date().toISOString(),
          message,
          type
        });
      }
    });

    // 2. Progress errors kao activity
    if (this.progress?.errors) {
      this.progress.errors.slice(-10).forEach(error => {
        activities.push({
          timestamp: typeof error.timestamp === 'string' ? error.timestamp : new Date(error.timestamp).toISOString(),
          message: `❌ Vozilo ID:${error.vehicleId} - ${error.error}`,
          type: 'error' as const
        });
      });
    }

    // 3. Smart Slow Sync batch status
    if (this.progress?.status === 'running') {
      activities.push({
        timestamp: new Date().toISOString(),
        message: `🚀 Batch ${this.progress.currentBatch}/${this.progress.totalBatches} - ${this.progress.vehiclesInCurrentBatch.length} vozila u obradi`,
        type: 'info'
      });
    }

    // 4. Checkpoints kao activity
    try {
      const checkpoints = await this.getSetting<SlowSyncCheckpoint[]>(
        this.SETTINGS_KEY + '_checkpoints'
      ) || [];
      
      checkpoints.slice(-5).forEach(checkpoint => {
        activities.push({
          timestamp: checkpoint.createdAt.toISOString(),
          message: `📋 Checkpoint ${checkpoint.batchNumber}: ${checkpoint.vehiclesProcessed.length} vozila, ${checkpoint.totalPoints.toLocaleString()} GPS tačaka`,
          type: 'info'
        });
      });
    } catch (error) {
      // Ignoriši greške sa checkpoints
    }

    // Sortiraj po vremenu (najnoviji prvi) i ograniči
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}