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
    statsCleanup: true
  };
  
  // Dinamička podešavanja iz baze
  private settings = {
    batchSize: 4000,
    intervalSeconds: 30,
    cleanupProcessedMinutes: 5,
    cleanupFailedHours: 2,
    cleanupStatsDays: 10
  };

  constructor(
    private prisma: PrismaService,
    private drivingBehaviorService: DrivingBehaviorService
  ) {
    // Kreiraj konekciju na TimescaleDB
    this.timescalePool = createTimescalePool();
    this.logger.log('🚀 GPS Processor Service inicijalizovan');
    
    // Učitaj podešavanja pri pokretanju
    this.loadSettings();
  }
  
  /**
   * Učitaj dinamička podešavanja iz baze
   */
  async loadSettings() {
    try {
      const settings = await this.prisma.systemSettings.findMany({
        where: { category: 'gps' }
      });
      
      settings.forEach(setting => {
        const value = setting.type === 'number' ? parseInt(setting.value) : setting.value;
        
        switch(setting.key) {
          case 'gps.processor.batch_size':
            this.settings.batchSize = value as number;
            break;
          case 'gps.processor.interval_seconds':
            this.settings.intervalSeconds = value as number;
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
      
      this.logger.debug(`📋 Učitana podešavanja: Batch=${this.settings.batchSize}, Interval=${this.settings.intervalSeconds}s`);
    } catch (error) {
      this.logger.warn('Greška pri učitavanju podešavanja, koriste se default vrednosti');
    }
  }

  /**
   * Cron job koji se pokreće svakih 30 sekundi
   * Prebacuje podatke iz MySQL buffer-a u TimescaleDB
   */
  @Cron('*/30 * * * * *')
  async processGpsBuffer() {
    // Skip ako je cron isključen
    if (!GpsProcessorService.cronEnabled.processor) {
      this.logger.debug('⏸️ GPS Processor cron je pauziran');
      return;
    }
    
    // Skip ako već procesira
    if (this.isProcessing) {
      this.logger.debug('⏭️ Preskačem - procesiranje već u toku');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Osveži podešavanja pre svakog procesiranja
      await this.loadSettings();
      
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

      this.logger.log(`📦 Pronađeno ${batch.length} GPS tačaka za procesiranje`);

      const ids = batch.map(r => r.id);

      // 2. Označi kao processing
      await this.prisma.$executeRaw`
        UPDATE gps_raw_buffer 
        SET process_status = 'processing',
            processed_at = NOW()
        WHERE id IN (${Prisma.join(ids)})
      `;

      // 3. Deduplicuj po vehicle_id i timestamp
      const uniquePoints = new Map<string, any>();
      for (const point of batch) {
        const vehicleId = point.vehicle_id || point.vehicleId;
        const key = `${vehicleId}_${point.timestamp}`;
        if (!uniquePoints.has(key)) {
          uniquePoints.set(key, point);
        }
      }

      // 4. Pripremi podatke za TimescaleDB
      const values: any[] = [];
      const valueStrings: string[] = [];
      let paramIndex = 1;

      for (const point of uniquePoints.values()) {
        // Kreiraj placeholder string za ovaj red
        valueStrings.push(
          `($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, ` +
          `$${paramIndex+3}, $${paramIndex+4}, ` +
          `ST_SetSRID(ST_MakePoint($${paramIndex+5}, $${paramIndex+6}), 4326), ` +
          `$${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, ` +
          `$${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12})`
        );

        // Dodaj vrednosti
        values.push(
          point.timestamp,                    // time
          point.vehicle_id || point.vehicleId, // vehicle_id
          point.garage_no || point.garageNo,   // garage_no
          parseFloat(point.lat),              // lat
          parseFloat(point.lng),              // lng
          parseFloat(point.lng),              // lng za ST_MakePoint
          parseFloat(point.lat),              // lat za ST_MakePoint
          parseInt(point.speed) || 0,         // speed
          parseInt(point.course) || 0,        // course
          parseInt(point.altitude) || 0,      // alt
          parseInt(point.state) || 0,         // state
          Boolean(parseInt(point.in_route || point.inRoute || 0)), // in_route - konvertuj u boolean
          'mysql_buffer'                      // data_source
        );

        paramIndex += 13;
      }

      // 4. Bulk insert u TimescaleDB - podeli na manje batch-ove zbog PostgreSQL limita
      if (valueStrings.length > 0) {
        // PostgreSQL ima limit od 65535 parametara, a mi koristimo 13 po zapisu
        // Zato delimo na batch-ove od 1000 zapisa (13,000 parametara)
        const BATCH_SIZE = 1000;
        
        for (let i = 0; i < valueStrings.length; i += BATCH_SIZE) {
          const batchStrings = valueStrings.slice(i, i + BATCH_SIZE);
          const batchValues = values.slice(i * 13, (i + BATCH_SIZE) * 13);
          
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

          await this.timescalePool.query(insertQuery, batchValues);
        }

        // 5. Označi kao processed u MySQL buffer-u
        await this.prisma.$executeRaw`
          UPDATE gps_raw_buffer 
          SET process_status = 'processed',
              processed_at = NOW()
          WHERE id IN (${Prisma.join(ids)})
        `;

        const processingTime = Date.now() - startTime;
        const actualProcessed = valueStrings.length; // Broj stvarno procesiranih (nakon deduplikacije)
        const batchesProcessed = Math.ceil(valueStrings.length / 1000); // Broj TimescaleDB batch-ova

        // 6. Detekcija agresivne vožnje (KRITIČNO - dodato!)
        if (actualProcessed > 0) {
          await this.detectAggressiveDriving(batch);
          
          // 7. Refresh continuous aggregates za optimalne performanse Monthly Report-a
          // Ovo omogućava 20x brže generisanje izveštaja
          try {
            // Pronađi vremenski opseg obrađenih podataka
            const timeRange = batch.reduce((acc, record) => {
              const recordTime = new Date(record.timestamp);
              if (!acc.min || recordTime < acc.min) acc.min = recordTime;
              if (!acc.max || recordTime > acc.max) acc.max = recordTime;
              return acc;
            }, { min: null as Date | null, max: null as Date | null });
            
            if (timeRange.min && timeRange.max) {
              // Refresh samo za period koji je obrađen
              await this.timescalePool.query(`
                CALL refresh_continuous_aggregate(
                  'vehicle_hourly_stats',
                  $1::TIMESTAMPTZ,
                  $2::TIMESTAMPTZ
                )
              `, [timeRange.min, timeRange.max]);
              
              await this.timescalePool.query(`
                CALL refresh_continuous_aggregate(
                  'daily_vehicle_stats',
                  $1::TIMESTAMPTZ,
                  $2::TIMESTAMPTZ
                )
              `, [timeRange.min, timeRange.max]);
              
              this.logger.debug(`🔄 Continuous aggregates osveženi za period ${timeRange.min.toISOString()} - ${timeRange.max.toISOString()}`);
            }
          } catch (refreshError) {
            // Nije kritična greška - nastavi dalje
            this.logger.warn(`⚠️ Refresh agregata nije uspeo: ${refreshError.message}`);
          }
        }
        this.processedCount += actualProcessed;
        this.lastProcessTime = new Date();

        this.logger.log(
          `✅ Procesirano ${actualProcessed} GPS tačaka u TimescaleDB za ${processingTime}ms (${batchesProcessed} batch-ova, od ${batch.length} iz buffer-a)`
        );
        
        // Ažuriraj statistike
        const hourSlot = new Date();
        hourSlot.setMinutes(0, 0, 0);
        hourSlot.setMilliseconds(0);
        await this.prisma.$executeRaw`
          INSERT INTO gps_processing_stats (hour_slot, processed_count, avg_processing_time_ms, updated_at)
          VALUES (${hourSlot}, ${actualProcessed}, ${Math.round(processingTime)}, NOW())
          ON DUPLICATE KEY UPDATE
            processed_count = processed_count + ${actualProcessed},
            avg_processing_time_ms = (avg_processing_time_ms + ${Math.round(processingTime)}) / 2,
            updated_at = NOW()
        `;
        
        // Ažuriraj vreme poslednjeg izvršavanja
        const { GpsSyncDashboardController } = require('../gps-sync/gps-sync-dashboard.controller');
        GpsSyncDashboardController.updateCronLastRun('processor');
      }

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
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Procesira batch podataka sa legacy sistema
   * Koristi se iz GpsLegacyController
   */
  async processLegacyBatch(points: any[]): Promise<{ processed: number; failed: number }> {
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
          timestamp: new Date((point.timestamp || Math.floor(Date.now() / 1000)) * 1000), // Convert Unix timestamp to Date
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

        this.logger.log(`Inserted ${validPoints.length} points to buffer`);
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
    this.logger.log('🔧 Ručno pokretanje procesiranja...');
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

      this.logger.log(`🧹 Obrisano ${result} failed GPS zapisa starijih od ${olderThanHours}h`);
      return result;
    } catch (error) {
      this.logger.error('Greška pri čišćenju failed zapisa:', error);
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
      this.logger.debug('⏸️ Buffer Cleanup cron je pauziran');
      return;
    }
    
    try {
      let totalDeleted = 0;
      
      // 1. Briši processed zapise (batch delete sa LIMIT)
      let deletedProcessed = 0;
      for (let i = 0; i < 5; i++) { // Maksimalno 5 batch-eva po 10000
        const result = await this.prisma.$executeRaw`
          DELETE FROM gps_raw_buffer 
          WHERE process_status = 'processed' 
          AND processed_at < DATE_SUB(NOW(), INTERVAL ${this.settings.cleanupProcessedMinutes} MINUTE)
          LIMIT 10000
        `;
        
        deletedProcessed += result;
        if (result < 10000) break; // Nema više za brisanje
      }
      
      if (deletedProcessed > 0) {
        this.logger.log(`🧹 Obrisano ${deletedProcessed} processed GPS zapisa`);
      }
      
      // 2. Briši failed zapise starije od X sati (batch delete sa LIMIT)
      let deletedFailed = 0;
      for (let i = 0; i < 5; i++) { // Maksimalno 5 batch-eva po 10000
        const result = await this.prisma.$executeRaw`
          DELETE FROM gps_raw_buffer 
          WHERE process_status = 'failed' 
          AND received_at < DATE_SUB(NOW(), INTERVAL ${this.settings.cleanupFailedHours} HOUR)
          LIMIT 10000
        `;
        
        deletedFailed += result;
        if (result < 10000) break; // Nema više za brisanje
      }
      
      if (deletedFailed > 0) {
        this.logger.log(`🧹 Obrisano ${deletedFailed} failed GPS zapisa starijih od ${this.settings.cleanupFailedHours}h`);
      }
      
      totalDeleted = deletedProcessed + deletedFailed;
      
      // Ažuriraj vreme poslednjeg izvršavanja
      const { GpsSyncDashboardController } = require('../gps-sync/gps-sync-dashboard.controller');
      GpsSyncDashboardController.updateCronLastRun('cleanup');
      
      return totalDeleted;
    } catch (error) {
      this.logger.error('Greška pri čišćenju buffer zapisa:', error);
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
      this.logger.debug('⏸️ Stats Cleanup cron je pauziran');
      return;
    }
    
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - this.settings.cleanupStatsDays);
      
      const result = await this.prisma.$executeRaw`
        DELETE FROM gps_processing_stats
        WHERE hour_slot < ${daysAgo}
      `;

      if (result > 0) {
        this.logger.log(`📊 Obrisano ${result} starih statistika (starije od ${this.settings.cleanupStatsDays} dana)`);
      }
      
      // Ažuriraj vreme poslednjeg izvršavanja
      const { GpsSyncDashboardController } = require('../gps-sync/gps-sync-dashboard.controller');
      GpsSyncDashboardController.updateCronLastRun('statsCleanup');
      
      return result;
    } catch (error) {
      this.logger.error('Greška pri čišćenju starih statistika:', error);
      return 0;
    }
  }

  /**
   * Kontrola cron jobova
   */
  static setCronEnabled(cronName: 'processor' | 'cleanup' | 'statsCleanup', enabled: boolean) {
    this.cronEnabled[cronName] = enabled;
    const logger = new Logger('GpsProcessorService');
    logger.log(`${enabled ? '▶️' : '⏸️'} Cron ${cronName} je ${enabled ? 'pokrenut' : 'pauziran'}`);
  }

  static getCronStatus() {
    return this.cronEnabled;
  }

  /**
   * Detekcija agresivne vožnje za batch podataka (NOVO!)
   */
  private async detectAggressiveDriving(batch: any[]) {
    try {
      // Grupiši po vehicle_id i vremenu
      const vehicleGroups = new Map<number, { startTime: Date, endTime: Date, garageNo: string }>();
      
      batch.forEach(record => {
        const vehicleId = record.vehicle_id;
        // Buffer tabela koristi 'timestamp', ne 'record_time'
        const recordTime = new Date(record.timestamp);
        
        // Validacija datuma
        if (!recordTime || isNaN(recordTime.getTime())) {
          this.logger.warn(`Invalid timestamp for vehicle ${vehicleId}: ${record.timestamp}`);
          return; // Preskoči loš record
        }
        
        if (!vehicleGroups.has(vehicleId)) {
          vehicleGroups.set(vehicleId, {
            startTime: recordTime,
            endTime: recordTime,
            garageNo: record.garage_no
          });
        } else {
          const group = vehicleGroups.get(vehicleId)!;
          if (recordTime < group.startTime) group.startTime = recordTime;
          if (recordTime > group.endTime) group.endTime = recordTime;
        }
      });

      // Pokreni detekciju za svako vozilo
      const detectionPromises = Array.from(vehicleGroups.entries()).map(async ([vehicleId, timeRange]) => {
        try {
          await this.drivingBehaviorService.processGpsData(
            vehicleId,
            timeRange.startTime,
            timeRange.endTime
          );
          this.logger.debug(`🔍 Agresivna vožnja detektovana za vozilo ${timeRange.garageNo} (${vehicleId})`);
        } catch (error) {
          this.logger.warn(`⚠️ Greška u detekciji za vozilo ${vehicleId}: ${error.message}`);
        }
      });

      await Promise.all(detectionPromises);
      this.logger.log(`🚗 Agresivna vožnja obrađena za ${vehicleGroups.size} vozila`);
      
    } catch (error) {
      this.logger.error(`❌ Greška u batch detekciji agresivne vožnje: ${error.message}`);
    }
  }

  /**
   * Pri gašenju aplikacije
   */
  async onModuleDestroy() {
    await this.timescalePool.end();
    this.logger.log('GPS Processor Service zaustavljen');
  }
}