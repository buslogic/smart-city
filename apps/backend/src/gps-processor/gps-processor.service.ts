import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DrivingBehaviorService } from '../driving-behavior/driving-behavior.service';
import { Pool } from 'pg';
import { createTimescalePool } from '../common/config/timescale.config';
import { Prisma } from '@prisma/client';

@Injectable()
export class GpsProcessorService {
  private readonly logger = new Logger(GpsProcessorService.name);
  private isProcessing = false;
  private timescalePool: Pool;
  private processedCount = 0;
  private lastProcessTime: Date | null = null;

  // Kontrola za cron jobove
  private static cronEnabled = {
    processor: true,
    cleanup: true,
    statsCleanup: true,
  };

  // Dinamička podešavanja iz baze
  private settings = {
    batchSize: 10000, // Povećan batch size sa 4000 na 10000
    intervalSeconds: 30,
    cleanupProcessedMinutes: 5,
    cleanupFailedHours: 2,
    cleanupStatsDays: 10,
    useWorkerPool: true, // Omogućen Worker Pool Pattern
    workerCount: 4,
  };

  constructor(
    private prisma: PrismaService,
    private drivingBehaviorService: DrivingBehaviorService,
  ) {
    // Kreiraj konekciju na TimescaleDB
    this.timescalePool = createTimescalePool();
    // this.logger.log('🚀 GPS Processor Service inicijalizovan');

    // Učitaj podešavanja pri pokretanju
    this.loadSettings();
  }

  /**
   * Učitaj dinamička podešavanja iz baze
   */
  async loadSettings() {
    try {
      const settings = await this.prisma.systemSettings.findMany({
        where: { category: 'gps' },
      });

      settings.forEach((setting) => {
        const value =
          setting.type === 'number' ? parseInt(setting.value) : setting.value;

        switch (setting.key) {
          case 'gps.processor.batch_size':
            this.settings.batchSize = value as number;
            break;
          case 'gps.processor.interval_seconds':
            this.settings.intervalSeconds = value as number;
            break;
          case 'gps.processor.use_worker_pool':
            this.settings.useWorkerPool = value === 'true' || value === 1;
            break;
          case 'gps.processor.worker_count':
            this.settings.workerCount = value as number;
            break;
          case 'gps.cleanup.processed_minutes':
            this.settings.cleanupProcessedMinutes = value as number;
            break;
          case 'gps.cleanup.failed_hours':
            this.settings.cleanupFailedHours = value as number;
            break;
          case 'gps.cleanup.stats_days':
            this.settings.cleanupStatsDays = value as number;
            break;
        }
      });
    } catch (error) {
      this.logger.warn(
        'Greška pri učitavanju podešavanja, koriste se default vrednosti',
      );
    }
  }

  /**
   * Konvertuje Belgrade vreme u UTC
   * VAŽNO: MySQL DATETIME kolone čuvaju vreme bez timezone info
   * koje je zapravo Belgrade lokalno vreme
   */
  private convertBelgradeToUTC(dateTimeValue: any): string {
    // Handle različite input formate
    let dateStr: string;

    if (dateTimeValue instanceof Date) {
      // Ako je već Date objekat, konvertuj u string
      dateStr = dateTimeValue.toISOString().replace('T', ' ').substring(0, 19);
    } else if (typeof dateTimeValue === 'string') {
      dateStr = dateTimeValue;
    } else {
      // Fallback na trenutno vreme ako je nevalidan input
      this.logger.warn(`Invalid datetime value: ${dateTimeValue}`);
      return new Date().toISOString();
    }

    // Dodaj Belgrade timezone offset
    // NAPOMENA: Ovo je pojednostavljeno za +02:00 (letnje vreme)
    // Za potpunu podršku DST, koristiti moment-timezone ili date-fns-tz
    const belgradeTime = new Date(dateStr + ' GMT+0200');

    // Vrati ISO string sa UTC vremenom
    return belgradeTime.toISOString();
  }

  /**
   * Cron job koji se pokreće svakih 30 sekundi
   * Prebacuje podatke iz MySQL buffer-a u TimescaleDB
   * Koristi Worker Pool Pattern za paralelno procesiranje
   */
  @Cron('*/30 * * * * *')
  async processGpsBuffer() {
    // Skip ako je cron isključen
    if (!GpsProcessorService.cronEnabled.processor) {
      // this.logger.debug('⏸️ GPS Processor cron je pauziran');
      return;
    }

    // Skip ako već procesira
    if (this.isProcessing) {
      // this.logger.debug('⏭️ Preskačem - procesiranje već u toku');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Osveži podešavanja pre svakog procesiranja
      await this.loadSettings();

      // Odluči da li koristiti worker pool ili stari način
      const useWorkerPool = this.settings.useWorkerPool ?? true;
      const workerCount = this.settings.workerCount || 4;

      if (useWorkerPool) {
        await this.processWithWorkerPool(workerCount);
      } else {
        // Stari način - jedan worker
        await this.processSingleBatch();
      }
    } catch (error) {
      this.logger.error('❌ Greška pri procesiranju GPS buffer-a:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Novi Worker Pool pristup - paralelno procesiranje
   */
  private async processWithWorkerPool(workerCount: number) {
    // 🔴 DEBUG: Log početak metode
    // this.logger.log(`🔴 DEBUG: processWithWorkerPool CALLED at ${new Date().toISOString()}`);

    // SKIP COUNT QUERY - nepotreban i spor na 5M+ zapisa!
    // Worker-i će ionako uzeti samo ono što mogu sa LIMIT

    // Generiši batch number (možda treba čuvati u servisu kao counter)
    const lastBatch = await this.prisma.gpsBatchHistory.findFirst({
      orderBy: { batchNumber: 'desc' },
      select: { batchNumber: true },
    });
    const batchNumber = (lastBatch?.batchNumber || 0) + 1;

    // POMERAJ startTime OVDE - posle COUNT query-ja!
    const startTime = Date.now();

    // 🔴 DEBUG: Log početak batch-a sa timestamp
    // this.logger.log(`🔴 DEBUG: Batch #${batchNumber} REAL START at ${new Date().toISOString()}, timestamp: ${startTime}`);

    // Kreiraj batch history zapis
    const batchHistory = await this.prisma.gpsBatchHistory.create({
      data: {
        batchNumber,
        startedAt: new Date(),
        status: 'processing',
        batchSize: this.settings.batchSize,
        workerCount,
        sourceTable: 'gps_raw_buffer',
        cronInterval: 30, // 30 sekundi default
        processedBy: `backend-${process.env.NODE_ENV || 'dev'}`,
      },
    });

    // this.logger.log(`🚀 Batch #${batchNumber}: Pokrećem Worker Pool sa ${workerCount} worker-a`);

    // Podeli posao na worker-e
    const chunkSize = Math.ceil(this.settings.batchSize / workerCount);
    const workerPromises: Promise<any>[] = [];

    // 🔴 DEBUG: Log pre pokretanja worker-a
    // this.logger.log(`🔴 DEBUG: Kreiranje ${workerCount} worker-a, chunkSize: ${chunkSize}`);

    for (let i = 0; i < workerCount; i++) {
      const offset = i * chunkSize;
      const limit = Math.min(chunkSize, this.settings.batchSize - offset);

      if (limit <= 0) break; // Nema više podataka za ovaj worker

      // 🔴 DEBUG: Log kad se kreira svaki worker promise
      // this.logger.log(`🔴 DEBUG: Kreiram Worker ${i + 1} sa limit=${limit} at ${new Date().toISOString()}`);

      workerPromises.push(
        this.processWorkerChunk(i + 1, offset, limit, batchHistory.id),
      );
    }

    // 🔴 DEBUG: Log pre čekanja
    // this.logger.log(`🔴 DEBUG: Svi worker promises kreirani, čekam Promise.allSettled at ${new Date().toISOString()}`);

    // Čekaj da svi worker-i završe
    const workerResults = await Promise.allSettled(workerPromises);

    // 🔴 DEBUG: Log posle čekanja
    // this.logger.log(`🔴 DEBUG: Promise.allSettled završen at ${new Date().toISOString()}`);

    // Agregiraj rezultate i pripremaj worker detalje
    let totalProcessed = 0;
    let totalFailed = 0;
    const timeRanges: { min: Date; max: Date }[] = [];
    const workerDetails: any[] = [];

    workerResults.forEach((result, index) => {
      const workerId = index + 1;
      const workerDetail: any = {
        workerId,
        status: 'unknown',
        processed: 0,
        failed: 0,
        duration: 0,
        startedAt: null,
        completedAt: null,
      };

      if (result.status === 'fulfilled' && result.value) {
        totalProcessed += result.value.processed;
        totalFailed += result.value.failed;
        workerDetail.status = 'completed';
        workerDetail.processed = result.value.processed;
        workerDetail.failed = result.value.failed;
        workerDetail.duration = result.value.duration || 0;
        workerDetail.startedAt = result.value.startedAt || null;
        workerDetail.completedAt = result.value.completedAt || null;

        if (result.value.timeRange) {
          timeRanges.push(result.value.timeRange);
        }
      } else if (result.status === 'rejected') {
        this.logger.error(`Worker ${workerId} je pao:`, result.reason);
        totalFailed += chunkSize; // Pretpostavi da je ceo chunk failed
        workerDetail.status = 'failed';
        workerDetail.error = result.reason?.message || 'Unknown error';
      }

      workerDetails.push(workerDetail);
    });

    // Centralizovan refresh continuous aggregates
    // 🔴 TEMP: Isključeno za optimizaciju brzine real-time sync-a
    /*
    if (timeRanges.length > 0) {
      const overallMin = timeRanges.reduce((min, r) => r.min < min ? r.min : min, timeRanges[0].min);
      const overallMax = timeRanges.reduce((max, r) => r.max > max ? r.max : max, timeRanges[0].max);
      
      await this.refreshContinuousAggregates(overallMin, overallMax);
    }
    */
    // this.logger.debug('⚡ Refresh aggregates preskočen za brzinu');

    const totalTime = Date.now() - startTime;
    const avgRecordsPerSecond = totalProcessed / (totalTime / 1000);

    // 🔴 DEBUG: Log finalne kalkulacije
    // this.logger.log(`🔴 DEBUG: FINAL - startTime: ${startTime}, now: ${Date.now()}, totalTime: ${totalTime}ms`);
    // this.logger.log(`🔴 DEBUG: Worker durations: ${workerDetails.map(w => w.duration).join(', ')}ms`);
    // this.logger.log(`🔴 DEBUG: Sum of worker durations: ${workerDetails.reduce((sum, w) => sum + w.duration, 0)}ms`);

    // Ažuriraj batch history
    await this.prisma.gpsBatchHistory.update({
      where: { id: batchHistory.id },
      data: {
        completedAt: new Date(),
        status:
          totalFailed > 0 && totalProcessed === 0 ? 'failed' : 'completed',
        actualProcessed: totalProcessed,
        failedRecords: totalFailed,
        totalDurationMs: Math.round(totalTime),
        avgRecordsPerSecond: Math.round(avgRecordsPerSecond),
        workerDetails: workerDetails,
      },
    });

    // this.logger.log(
    //   `✅ Batch #${batchNumber} završen: ${totalProcessed} procesirano, ${totalFailed} failed za ${totalTime}ms`
    // );

    // Ažuriraj statistike
    await this.updateProcessingStats(totalProcessed, totalTime);
  }

  /**
   * Procesira jedan chunk podataka (worker)
   */
  private async processWorkerChunk(
    workerId: number,
    offset: number,
    limit: number,
    batchId: string,
  ): Promise<{
    processed: number;
    failed: number;
    duration: number;
    startedAt?: Date;
    completedAt?: Date;
    timeRange?: { min: Date; max: Date };
  }> {
    const workerStart = Date.now();
    const startedAt = new Date();
    const processingSteps: any[] = [];

    // 🔴 DEBUG: Log početak worker-a
    // this.logger.log(`🔴 DEBUG: Worker ${workerId} STARTED at ${startedAt.toISOString()}, timestamp: ${workerStart}`);

    // Kreiraj worker log na početku
    const workerLog = await this.prisma.gpsWorkerLog.create({
      data: {
        batchId,
        workerId,
        startedAt,
        status: 'started',
        recordsAssigned: limit,
        chunkSize: limit,
        offset,
        processedBy: `worker-${workerId}-${process.pid}`,
      },
    });

    try {
      // Step 1: Fetch data - VAŽNO: Grupiši po vehicle_id da izbegneš deadlock!
      // Svaki worker uzima podatke za različita vozila koristeći modulo operaciju
      const fetchStart = new Date();

      // DEADLOCK FIX:
      // - FORCE INDEX (idx_worker_processing): Forsira optimizovan composite index
      //   koji pokriva worker_group + process_status + retry_count + received_at
      // - SKIP LOCKED: Preskače zapise koje drugi worker-i drže, eliminiše deadlock
      //
      // Stari pristup:
      // - MySQL koristio idx_status_only (samo process_status)
      // - Skenirao milione 'pending' zapisa, pa filtrirao po worker_group
      // - Držao lock-ove predugo → deadlock sa UPDATE query-jima
      //
      // Novi pristup:
      // - idx_worker_processing (worker_group, process_status, retry_count, received_at)
      // - Direktan index seek na worker_group = X, process_status = 'pending'
      // - Skenira samo ~100-5000 zapisa umesto miliona
      // - SKIP LOCKED omogućava worker-ima da rade nezavisno
      const batch = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM gps_raw_buffer FORCE INDEX (idx_worker_processing)
        WHERE worker_group = ${workerId - 1}
        AND process_status = 'pending'
        AND retry_count < 3
        ORDER BY received_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;
      const fetchEnd = new Date();

      processingSteps.push({
        step: 'fetch_data',
        startedAt: fetchStart,
        completedAt: fetchEnd,
        durationMs: fetchEnd.getTime() - fetchStart.getTime(),
        recordsCount: batch?.length || 0,
        status: 'success',
      });

      if (!batch || batch.length === 0) {
        // this.logger.debug(`Worker ${workerId}: Nema podataka`);

        // Ažuriraj worker log
        await this.prisma.gpsWorkerLog.update({
          where: { id: workerLog.id },
          data: {
            completedAt: new Date(),
            durationMs: Date.now() - workerStart,
            status: 'completed',
            recordsProcessed: 0,
            processingSteps,
          },
        });

        return {
          processed: 0,
          failed: 0,
          duration: Date.now() - workerStart,
          startedAt,
          completedAt: new Date(),
        };
      }

      // this.logger.debug(`Worker ${workerId}: Procesira ${batch.length} zapisa`);

      // Step 2: Mark as processing
      const markStart = new Date();
      const ids = batch.map((r) => r.id);
      await this.prisma.$executeRaw`
        UPDATE gps_raw_buffer 
        SET process_status = 'processing',
            processed_at = NOW()
        WHERE id IN (${Prisma.join(ids)})
      `;
      const markEnd = new Date();

      processingSteps.push({
        step: 'mark_processing',
        startedAt: markStart,
        completedAt: markEnd,
        durationMs: markEnd.getTime() - markStart.getTime(),
        status: 'success',
      });

      // Step 3: Insert to TimescaleDB
      const insertStart = new Date();
      const result = await this.insertBatchToTimescaleDB(batch);
      const insertEnd = new Date();

      processingSteps.push({
        step: 'insert_timescale',
        startedAt: insertStart,
        completedAt: insertEnd,
        durationMs: insertEnd.getTime() - insertStart.getTime(),
        recordsInserted: result.processedCount,
        status: 'success',
      });

      // Step 4: Mark as processed
      if (result.processedCount > 0) {
        const markProcessedStart = new Date();
        await this.prisma.$executeRaw`
          UPDATE gps_raw_buffer 
          SET process_status = 'processed',
              processed_at = NOW()
          WHERE id IN (${Prisma.join(ids)})
        `;
        const markProcessedEnd = new Date();

        processingSteps.push({
          step: 'mark_processed',
          startedAt: markProcessedStart,
          completedAt: markProcessedEnd,
          durationMs: markProcessedEnd.getTime() - markProcessedStart.getTime(),
          status: 'success',
        });
      }

      const workerTime = Date.now() - workerStart;
      const completedAt = new Date();
      const recordsPerSecond =
        workerTime > 0 ? result.processedCount / (workerTime / 1000) : 0;

      // Ažuriraj worker log sa finalnim podacima
      await this.prisma.gpsWorkerLog.update({
        where: { id: workerLog.id },
        data: {
          completedAt,
          durationMs: workerTime,
          status: 'completed',
          recordsProcessed: result.processedCount,
          recordsFailed: batch.length - result.processedCount,
          recordsPerSecond,
          processingSteps,
        },
      });

      // 🔴 DEBUG: Log završetak worker-a
      // this.logger.log(
      //   `🔴 DEBUG: Worker ${workerId} FINISHED at ${completedAt.toISOString()}, duration: ${workerTime}ms, processed: ${result.processedCount}`
      // );

      // this.logger.debug(
      //   `Worker ${workerId}: Završen - ${result.processedCount} procesirano za ${workerTime}ms`
      // );

      return {
        processed: result.processedCount,
        failed: batch.length - result.processedCount,
        duration: workerTime,
        startedAt,
        completedAt,
        timeRange: result.timeRange,
      };
    } catch (error) {
      this.logger.error(`Worker ${workerId} greška:`, error);

      // Ažuriraj worker log sa error informacijama
      await this.prisma.gpsWorkerLog.update({
        where: { id: workerLog.id },
        data: {
          completedAt: new Date(),
          durationMs: Date.now() - workerStart,
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
          errorStack: error.stack,
          processingSteps,
        },
      });

      throw error;
    }
  }

  /**
   * Stari način - procesira jedan veliki batch
   */
  private async processSingleBatch() {
    try {
      const startTime = Date.now();

      // 1. Dohvati batch podataka iz MySQL buffer-a
      const batch = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM gps_raw_buffer 
        WHERE process_status = 'pending' 
        AND retry_count < 3
        ORDER BY received_at ASC
        LIMIT ${this.settings.batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (!batch || batch.length === 0) {
        return; // Nema podataka za procesiranje
      }

      // this.logger.log(`📦 Pronađeno ${batch.length} GPS tačaka za procesiranje`);

      const ids = batch.map((r) => r.id);

      // 2. Označi kao processing
      await this.prisma.$executeRaw`
        UPDATE gps_raw_buffer 
        SET process_status = 'processing'
        WHERE id IN (${Prisma.join(ids)})
      `;

      // 3. Ubaci u TimescaleDB
      const result = await this.insertBatchToTimescaleDB(batch);

      // 4. Označi kao processed u MySQL buffer-u
      if (result && result.processedCount > 0) {
        await this.prisma.$executeRaw`
          UPDATE gps_raw_buffer 
          SET process_status = 'processed',
              processed_at = NOW()
          WHERE id IN (${Prisma.join(ids)})
        `;

        // 5. Detekcija agresivne vožnje
        // 🔴 TEMP: Isključeno za optimizaciju brzine real-time sync-a
        // await this.detectAggressiveDriving(batch);
        // this.logger.debug('⚡ Aggressive driving detekcija preskočena za brzinu');

        // 6. Refresh continuous aggregates
        // 🔴 TEMP: Isključeno za optimizaciju brzine real-time sync-a
        /*
        if (result.timeRange) {
          await this.refreshContinuousAggregates(result.timeRange.min, result.timeRange.max);
        }
        */
      }

      const processingTime = Date.now() - startTime;
      this.processedCount += result.processedCount;
      this.lastProcessTime = new Date();

      // this.logger.log(
      //   `✅ Procesirano ${result.processedCount} GPS tačaka za ${processingTime}ms (od ${batch.length} iz buffer-a)`
      // );

      // Ažuriraj statistike
      await this.updateProcessingStats(result.processedCount, processingTime);
    } catch (error) {
      this.logger.error('❌ Greška pri procesiranju GPS buffer-a:', error);

      // Označi kao failed za retry
      try {
        await this.prisma.$executeRaw`
          UPDATE gps_raw_buffer 
          SET process_status = 'failed',
              retry_count = retry_count + 1,
              error_message = ${error.message || 'Unknown error'}
          WHERE process_status = 'processing'
        `;
      } catch (updateError) {
        this.logger.error('Greška pri ažuriranju statusa:', updateError);
      }
    }
  }

  /**
   * Procesira batch podataka sa legacy sistema
   * Koristi se iz GpsLegacyController
   */
  public async processLegacyBatch(
    points: any[],
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    // Validacija i priprema podataka
    const validPoints: any[] = [];

    for (const point of points) {
      try {
        // Validacija obaveznih polja
        if (!point.vehicleId || !point.lat || !point.lng || !point.gpsTime) {
          failed++;
          continue;
        }

        // Priprema podatka za buffer
        const bufferData = {
          vehicleId: point.vehicleId,
          garageNo: point.garageNo || '',
          // Unix timestamp je već UTC, ne treba convertBelgradeToUTC!
          timestamp: new Date(
            (point.timestamp || Math.floor(Date.now() / 1000)) * 1000,
          ),
          lat: parseFloat(point.lat),
          lng: parseFloat(point.lng),
          speed: parseInt(point.speed) || 0,
          course: parseInt(point.angle || point.course) || 0, // course umesto angle
          altitude: parseInt(point.altitude) || 0,
          inRoute: parseInt(point.inRoute) || 0, // Int umesto Boolean
          rawData: JSON.stringify(point),
          processStatus: 'pending',
          receivedAt: new Date(),
          satellites: 0,
          state: 0,
          workerGroup: point.vehicleId % 8, // Dodeljuje worker grupu na osnovu vehicle ID (0-7)
          // gpsTime se čuva u rawData
        };

        validPoints.push(bufferData);
        processed++;
      } catch (error) {
        this.logger.warn(`Invalid GPS point: ${JSON.stringify(point)}`);
        failed++;
      }
    }

    // Batch insert u buffer
    if (validPoints.length > 0) {
      try {
        await this.prisma.gpsRawBuffer.createMany({
          data: validPoints,
          skipDuplicates: true,
        });

        // this.logger.log(`Inserted ${validPoints.length} points to buffer`);
      } catch (error) {
        this.logger.error('Error inserting to buffer', error);
        throw error;
      }
    }

    return { processed, failed };
  }

  /**
   * Monitoring metoda - vraća statistike buffer-a
   */
  async getBufferStatus() {
    try {
      const stats = await this.prisma.$queryRaw<any[]>`
        SELECT 
          process_status,
          COUNT(*) as count,
          MIN(received_at) as oldest,
          MAX(received_at) as newest
        FROM gps_raw_buffer
        GROUP BY process_status
      `;

      const total = await this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as total FROM gps_raw_buffer
      `;

      return {
        stats,
        total: total[0]?.total || 0,
        processedTotal: this.processedCount,
        lastProcessTime: this.lastProcessTime,
        isProcessing: this.isProcessing,
      };
    } catch (error) {
      this.logger.error('Greška pri dohvatanju statusa buffer-a:', error);
      return null;
    }
  }

  /**
   * Ručno pokreni procesiranje (za testiranje)
   */
  async processManually() {
    // this.logger.log('🔧 Ručno pokretanje procesiranja...');
    await this.processGpsBuffer();
    return {
      success: true,
      message: 'Procesiranje pokrenuto ručno',
    };
  }

  /**
   * Počisti stare failed zapise
   */
  async cleanupFailedRecords(olderThanHours: number = 24) {
    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM gps_raw_buffer
        WHERE process_status = 'failed'
        AND retry_count >= 3
        AND received_at < DATE_SUB(NOW(), INTERVAL ${olderThanHours} HOUR)
      `;

      // this.logger.log(`🧹 Obrisano ${result} failed GPS zapisa starijih od ${olderThanHours}h`);
      return result;
    } catch (error) {
      this.logger.error('Greška pri čišćenju failed zapisa:', error);
      return 0;
    }
  }

  /**
   * 🔧 RECOVERY: Popravi worker_group za zapise koji imaju NULL
   * Ovo je automatski recovery mehanizam za probleme pri unosu podataka
   * Pokreće se svakih 1 minut
   */
  @Cron('*/1 * * * *') // Svaki 1 minut
  async recoverMissingWorkerGroups() {
    try {
      // Prvo proveri da li postoje zapisi sa NULL worker_group
      const nullCount: any[] = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM gps_raw_buffer
        WHERE process_status = 'pending'
          AND worker_group IS NULL
          AND vehicle_id IS NOT NULL
      `;

      const count = Number(nullCount[0]?.count || 0);

      if (count === 0) {
        return; // Nema problema, izlazimo
      }

      this.logger.warn(
        `🔧 RECOVERY: Detektovano ${count} pending zapisa sa worker_group=NULL. Popravljam...`,
      );

      // Popravi worker_group na osnovu vehicle_id % 8
      const result = await this.prisma.$executeRaw`
        UPDATE gps_raw_buffer
        SET worker_group = vehicle_id % 8
        WHERE process_status = 'pending'
          AND worker_group IS NULL
          AND vehicle_id IS NOT NULL
      `;

      this.logger.log(
        `✅ RECOVERY: Popravljeno ${result} zapisa - worker_group postavljen na vehicle_id % 8`,
      );

      // Proveri distribuciju posle popravke
      const distribution: any[] = await this.prisma.$queryRaw`
        SELECT worker_group, COUNT(*) as count
        FROM gps_raw_buffer
        WHERE process_status = 'pending'
        GROUP BY worker_group
        ORDER BY worker_group
      `;

      const distInfo = distribution
        .map((row) => `W${row.worker_group}:${row.count}`)
        .join(', ');
      this.logger.log(`📊 RECOVERY: Nova distribucija - ${distInfo}`);

      return result;
    } catch (error) {
      this.logger.error('❌ RECOVERY greška pri popravljanju worker_group:', error);
      return 0;
    }
  }

  /**
   * Počisti stare processed zapise
   * Pokreće se periodično da oslobodi prostor
   */
  @Cron('*/2 * * * *') // Svakih 2 minuta
  async cleanupProcessedRecords() {
    // Skip ako je cron isključen
    if (!GpsProcessorService.cronEnabled.cleanup) {
      // this.logger.debug('⏸️ Buffer Cleanup cron je pauziran');
      return;
    }

    try {
      let totalDeleted = 0;

      // Koristi transakciju koja automatski upravlja konekcijama
      await this.prisma.$transaction(
        async (tx) => {
          // 1. Briši processed zapise (batch delete sa LIMIT)
          let deletedProcessed = 0;
          for (let i = 0; i < 5; i++) {
            // Maksimalno 5 batch-eva po 10000
            const result = await tx.$executeRaw`
            DELETE FROM gps_raw_buffer
            WHERE process_status = 'processed'
            AND processed_at < DATE_SUB(NOW(), INTERVAL ${this.settings.cleanupProcessedMinutes} MINUTE)
            LIMIT 10000
          `;

            deletedProcessed += result;
            if (result < 10000) break; // Nema više za brisanje
          }

          if (deletedProcessed > 0) {
            // this.logger.log(`🧹 Obrisano ${deletedProcessed} processed GPS zapisa`);
          }

          // 2. Briši failed zapise starije od X sati (batch delete sa LIMIT)
          let deletedFailed = 0;
          for (let i = 0; i < 5; i++) {
            // Maksimalno 5 batch-eva po 10000
            const result = await tx.$executeRaw`
            DELETE FROM gps_raw_buffer
            WHERE process_status = 'failed'
            AND received_at < DATE_SUB(NOW(), INTERVAL ${this.settings.cleanupFailedHours} HOUR)
            LIMIT 10000
          `;

            deletedFailed += result;
            if (result < 10000) break; // Nema više za brisanje
          }

          if (deletedFailed > 0) {
            // this.logger.log(`🧹 Obrisano ${deletedFailed} failed GPS zapisa starijih od ${this.settings.cleanupFailedHours}h`);
          }

          totalDeleted = deletedProcessed + deletedFailed;
        },
        {
          maxWait: 5000, // Čekaj max 5 sekundi na slobodnu konekciju
          timeout: 30000, // Timeout za celu transakciju je 30 sekundi
        },
      );

      // Ažuriraj vreme poslednjeg izvršavanja
      const {
        GpsSyncDashboardController,
      } = require('../gps-sync/gps-sync-dashboard.controller');
      GpsSyncDashboardController.updateCronLastRun('cleanup');

      return totalDeleted;
    } catch (error) {
      this.logger.error('Greška pri čišćenju buffer zapisa:', error);

      // Ako je problem sa konekcijama, forsiraj reconnect
      if (
        error.code === 'P2024' ||
        error.code === 'P2010' ||
        error.code === 'P2034'
      ) {
        this.logger.warn(
          '🔄 Detektovan connection pool problem, forsiram reconnect...',
        );
        try {
          await this.prisma.$disconnect();
          await this.prisma.$connect();
          this.logger.log('✅ Prisma reconnect uspešan');
        } catch (reconnectError) {
          this.logger.error('❌ Prisma reconnect neuspešan:', reconnectError);
        }
      }

      return 0;
    }
  }

  /**
   * Počisti stare statistike (starije od 10 dana)
   * Pokreće se jednom dnevno
   */
  @Cron('0 3 * * *') // Svaki dan u 3 ujutru
  async cleanupOldStats() {
    // Skip ako je cron isključen
    if (!GpsProcessorService.cronEnabled.statsCleanup) {
      // this.logger.debug('⏸️ Stats Cleanup cron je pauziran');
      return;
    }

    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - this.settings.cleanupStatsDays);

      // Koristi transakciju za sigurno upravljanje konekcijama
      const result = await this.prisma.$transaction(
        async (tx) => {
          return await tx.$executeRaw`
          DELETE FROM gps_processing_stats
          WHERE hour_slot < ${daysAgo}
        `;
        },
        {
          maxWait: 5000,
          timeout: 10000,
        },
      );

      if (result > 0) {
        // this.logger.log(`📊 Obrisano ${result} starih statistika (starije od ${this.settings.cleanupStatsDays} dana`);
      }

      // Ažuriraj vreme poslednjeg izvršavanja
      const {
        GpsSyncDashboardController,
      } = require('../gps-sync/gps-sync-dashboard.controller');
      GpsSyncDashboardController.updateCronLastRun('statsCleanup');

      return result;
    } catch (error) {
      this.logger.error('Greška pri čišćenju starih statistika:', error);

      // Ako je problem sa konekcijama, forsiraj reconnect
      if (
        error.code === 'P2024' ||
        error.code === 'P2010' ||
        error.code === 'P2034'
      ) {
        this.logger.warn(
          '🔄 Detektovan connection pool problem u stats cleanup, forsiram reconnect...',
        );
        try {
          await this.prisma.$disconnect();
          await this.prisma.$connect();
          this.logger.log('✅ Prisma reconnect uspešan');
        } catch (reconnectError) {
          this.logger.error('❌ Prisma reconnect neuspešan:', reconnectError);
        }
      }

      return 0;
    }
  }

  /**
   * Recovery mehanizam za stuck processing zapise
   * Detektuje i resetuje zapise koji su zaglavljeni u processing statusu
   * Pokreće se svakih 5 minuta
   */
  @Cron('*/5 * * * *') // Svakih 5 minuta
  async recoverStuckRecords() {
    try {
      const stuckThresholdMinutes = 5; // Zapisi stuck duže od 5 minuta
      const maxRetries = 3; // Maksimalan broj pokušaja

      const stuckThreshold = new Date();
      stuckThreshold.setMinutes(
        stuckThreshold.getMinutes() - stuckThresholdMinutes,
      );

      // Dohvati stuck zapise
      const stuckRecords = await this.prisma.$queryRaw<
        { id: bigint; retry_count: number; vehicle_id: number }[]
      >`
        SELECT id, retry_count, vehicle_id
        FROM gps_raw_buffer
        WHERE process_status = 'processing'
        AND processed_at < ${stuckThreshold}
        LIMIT 10000
      `;

      if (stuckRecords.length === 0) {
        return { recovered: 0, failed: 0 };
      }

      this.logger.warn(
        `🔧 Pronađeno ${stuckRecords.length} stuck processing zapisa (starijih od ${stuckThresholdMinutes} min)`,
      );

      // Podeli na one koje treba retry-ovati i one koje treba failovati
      const recordsToRetry: bigint[] = [];
      const recordsToFail: bigint[] = [];

      stuckRecords.forEach((record) => {
        if (record.retry_count >= maxRetries - 1) {
          // Već je bio retry-ovan 2 puta, sad ide u failed
          recordsToFail.push(record.id);
        } else {
          // Retry-uj
          recordsToRetry.push(record.id);
        }
      });

      let recoveredCount = 0;
      let failedCount = 0;

      // Reset zapisa za retry
      if (recordsToRetry.length > 0) {
        const result = await this.prisma.$executeRaw`
          UPDATE gps_raw_buffer
          SET process_status = 'pending',
              retry_count = retry_count + 1,
              processed_at = NULL,
              error_message = CONCAT(
                COALESCE(error_message, ''),
                ' | Auto-recovery: Reset from stuck processing status at ',
                NOW()
              )
          WHERE id IN (${Prisma.join(recordsToRetry)})
        `;
        recoveredCount = result;
        this.logger.log(
          `✅ Resetovano ${recoveredCount} stuck zapisa u pending status`,
        );
      }

      // Označi kao trajno failed
      if (recordsToFail.length > 0) {
        const result = await this.prisma.$executeRaw`
          UPDATE gps_raw_buffer
          SET process_status = 'failed',
              retry_count = retry_count + 1,
              error_message = CONCAT(
                COALESCE(error_message, ''),
                ' | Auto-recovery: Max retries exceeded, marked as failed at ',
                NOW()
              )
          WHERE id IN (${Prisma.join(recordsToFail)})
        `;
        failedCount = result;
        this.logger.warn(
          `⚠️ Označeno ${failedCount} stuck zapisa kao failed (max retries exceeded)`,
        );
      }

      return { recovered: recoveredCount, failed: failedCount };
    } catch (error) {
      this.logger.error('Greška pri recovery-ju stuck zapisa:', error);
      return { recovered: 0, failed: 0 };
    }
  }

  /**
   * Kontrola cron jobova
   */
  static setCronEnabled(
    cronName: 'processor' | 'cleanup' | 'statsCleanup',
    enabled: boolean,
  ) {
    this.cronEnabled[cronName] = enabled;
    // const logger = new Logger('GpsProcessorService');
    // logger.log(`${enabled ? '▶️' : '⏸️'} Cron ${cronName} je ${enabled ? 'pokrenut' : 'pauziran'}`);
  }

  static getCronStatus() {
    return this.cronEnabled;
  }

  /**
   * Ubacuje batch podataka u TimescaleDB
   * Koristi se od strane worker-a i starog pristupa
   */
  private async insertBatchToTimescaleDB(batch: any[]): Promise<{
    processedCount: number;
    timeRange?: { min: Date; max: Date };
  }> {
    this.logger.log(
      `🔵 insertBatchToTimescaleDB CALLED with ${batch?.length || 0} points`,
    );

    if (!batch || batch.length === 0) {
      this.logger.warn('⚠️ insertBatchToTimescaleDB: Empty batch!');
      return { processedCount: 0 };
    }

    // Dedupliciranje po vehicle_id i timestamp
    const uniquePoints = new Map<string, any>();
    for (const point of batch) {
      const vehicleId = point.vehicle_id || point.vehicleId;
      const key = `${vehicleId}_${point.timestamp}`;
      if (!uniquePoints.has(key)) {
        uniquePoints.set(key, point);
      }
    }

    const allPoints = Array.from(uniquePoints.values());

    if (allPoints.length === 0) {
      return { processedCount: 0 };
    }

    // Tracking time range za continuous aggregates
    let minTime: Date | null = null;
    let maxTime: Date | null = null;

    // Bulk insert u TimescaleDB - podeli na manje batch-ove zbog PostgreSQL limita
    const BATCH_SIZE = 1000;
    let totalInserted = 0;

    for (
      let batchStart = 0;
      batchStart < allPoints.length;
      batchStart += BATCH_SIZE
    ) {
      const batchPoints = allPoints.slice(
        batchStart,
        Math.min(batchStart + BATCH_SIZE, allPoints.length),
      );

      // Generiši parametre za ovaj batch
      const batchValues: any[] = [];
      const batchStrings: string[] = [];
      let paramIndex = 1;

      for (const point of batchPoints) {
        // Track time range - VAŽNO: konvertuj Belgrade->UTC
        const convertedTime = this.convertBelgradeToUTC(point.timestamp);
        const pointTime = new Date(convertedTime);
        if (!minTime || pointTime < minTime) minTime = pointTime;
        if (!maxTime || pointTime > maxTime) maxTime = pointTime;

        // Kreiraj placeholder string za ovaj red
        batchStrings.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, ` +
            `$${paramIndex + 3}, $${paramIndex + 4}, ` +
            `ST_SetSRID(ST_MakePoint($${paramIndex + 5}, $${paramIndex + 6}), 4326), ` +
            `$${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, ` +
            `$${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12})`,
        );

        // Dodaj vrednosti
        batchValues.push(
          convertedTime, // time - konvertovano u UTC
          point.vehicle_id || point.vehicleId, // vehicle_id
          point.garage_no || point.garageNo, // garage_no
          parseFloat(point.lat), // lat
          parseFloat(point.lng), // lng
          parseFloat(point.lng), // lng za ST_MakePoint
          parseFloat(point.lat), // lat za ST_MakePoint
          parseInt(point.speed) || 0, // speed
          parseInt(point.course) || 0, // course
          parseInt(point.altitude) || 0, // alt
          parseInt(point.state) || 0, // state
          Boolean(parseInt(point.in_route || point.inRoute || 0)), // in_route
          'mysql_buffer', // data_source
        );

        paramIndex += 13;
      }

      const insertQuery = `
        INSERT INTO gps_data (
          time, vehicle_id, garage_no, lat, lng, location,
          speed, course, alt, state, in_route, data_source
        ) VALUES ${batchStrings.join(', ')}
        ON CONFLICT (vehicle_id, time) DO UPDATE SET
          garage_no = EXCLUDED.garage_no,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          location = EXCLUDED.location,
          speed = EXCLUDED.speed,
          course = EXCLUDED.course,
          state = EXCLUDED.state,
          in_route = EXCLUDED.in_route
      `;

      try {
        this.logger.log(
          `🔵 Attempting TimescaleDB INSERT: ${batchPoints.length} points (batch ${batchStart})`,
        );
        const result = await this.timescalePool.query(insertQuery, batchValues);
        this.logger.log(
          `✅ TimescaleDB INSERT SUCCESS: rowCount=${result.rowCount}, command=${result.command}`,
        );
        totalInserted += batchPoints.length;
      } catch (error) {
        this.logger.error(
          `❌ TimescaleDB INSERT greška (batch ${batchStart}-${batchStart + batchPoints.length}): ${error.message}`,
        );
        this.logger.error(`Error code: ${error.code}`);
        this.logger.error(`Sample point: ${JSON.stringify(batchPoints[0])}`);
        throw error; // Re-throw da worker catch-uje
      }
    }

    return {
      processedCount: totalInserted,
      timeRange:
        minTime && maxTime ? { min: minTime, max: maxTime } : undefined,
    };
  }

  /**
   * Centralizovan refresh continuous aggregates
   */
  private async refreshContinuousAggregates(minTime: Date, maxTime: Date) {
    try {
      // this.logger.debug(`🔄 Refresh aggregates za period ${minTime.toISOString()} - ${maxTime.toISOString()}`);

      // Refresh hourly aggregates
      await this.timescalePool.query(
        `
        CALL refresh_continuous_aggregate(
          'vehicle_hourly_stats',
          $1::TIMESTAMPTZ,
          $2::TIMESTAMPTZ
        )
      `,
        [minTime, maxTime],
      );

      // Refresh daily aggregates
      await this.timescalePool.query(
        `
        CALL refresh_continuous_aggregate(
          'daily_vehicle_stats',
          $1::TIMESTAMPTZ,
          $2::TIMESTAMPTZ
        )
      `,
        [minTime, maxTime],
      );

      // this.logger.debug(`✅ Aggregates osveženi`);
    } catch (error) {
      this.logger.warn(`⚠️ Refresh agregata nije uspeo: ${error.message}`);
    }
  }

  /**
   * Ažurira statistike procesiranja
   */
  private async updateProcessingStats(
    processedCount: number,
    processingTime: number,
  ) {
    try {
      const hourSlot = new Date();
      hourSlot.setMinutes(0, 0, 0);
      hourSlot.setMilliseconds(0);

      await this.prisma.$executeRaw`
        INSERT INTO gps_processing_stats (hour_slot, processed_count, avg_processing_time_ms, updated_at)
        VALUES (${hourSlot}, ${processedCount}, ${Math.round(processingTime)}, NOW())
        ON DUPLICATE KEY UPDATE
          processed_count = processed_count + ${processedCount},
          avg_processing_time_ms = (avg_processing_time_ms + ${Math.round(processingTime)}) / 2,
          updated_at = NOW()
      `;

      // Ažuriraj vreme poslednjeg izvršavanja
      const {
        GpsSyncDashboardController,
      } = require('../gps-sync/gps-sync-dashboard.controller');
      GpsSyncDashboardController.updateCronLastRun('processor');
    } catch (error) {
      this.logger.warn(`Greška pri ažuriranju statistika: ${error.message}`);
    }
  }

  /**
   * Detekcija agresivne vožnje za batch podataka
   */
  private async detectAggressiveDriving(batch: any[]) {
    try {
      // Grupiši po vehicle_id i vremenu
      const vehicleGroups = new Map<
        number,
        { startTime: Date; endTime: Date; garageNo: string }
      >();

      batch.forEach((record) => {
        const vehicleId = record.vehicle_id || record.vehicleId;
        // Buffer tabela koristi 'timestamp', ne 'record_time'
        const recordTime = new Date(record.timestamp);

        // Validacija datuma
        if (!recordTime || isNaN(recordTime.getTime())) {
          this.logger.warn(
            `Invalid timestamp for vehicle ${vehicleId}: ${record.timestamp}`,
          );
          return; // Preskoči loš record
        }

        if (!vehicleGroups.has(vehicleId)) {
          vehicleGroups.set(vehicleId, {
            startTime: recordTime,
            endTime: recordTime,
            garageNo: record.garage_no || record.garageNo,
          });
        } else {
          const group = vehicleGroups.get(vehicleId)!;
          if (recordTime < group.startTime) group.startTime = recordTime;
          if (recordTime > group.endTime) group.endTime = recordTime;
        }
      });

      // Pokreni detekciju za svako vozilo
      const detectionPromises = Array.from(vehicleGroups.entries()).map(
        async ([vehicleId, timeRange]) => {
          try {
            await this.drivingBehaviorService.processGpsData(
              vehicleId,
              timeRange.startTime,
              timeRange.endTime,
            );
            // this.logger.debug(`🔍 Agresivna vožnja detektovana za vozilo ${timeRange.garageNo} (${vehicleId})`);
          } catch (error) {
            this.logger.warn(
              `⚠️ Greška u detekciji za vozilo ${vehicleId}: ${error.message}`,
            );
          }
        },
      );

      await Promise.all(detectionPromises);
      // this.logger.log(`🚗 Agresivna vožnja obrađena za ${vehicleGroups.size} vozila`);
    } catch (error) {
      this.logger.error(
        `❌ Greška u batch detekciji agresivne vožnje: ${error.message}`,
      );
    }
  }

  /**
   * Pri gašenju aplikacije
   */
  async onModuleDestroy() {
    await this.timescalePool.end();
    // this.logger.log('GPS Processor Service zaustavljen');
  }
}
