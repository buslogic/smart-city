import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
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

  constructor(private prisma: PrismaService) {
    // Kreiraj konekciju na TimescaleDB
    this.timescalePool = createTimescalePool();
    this.logger.log('🚀 GPS Processor Service inicijalizovan');
  }

  /**
   * Cron job koji se pokreće svakih 30 sekundi
   * Prebacuje podatke iz MySQL buffer-a u TimescaleDB
   */
  @Cron('*/30 * * * * *')
  async processGpsBuffer() {
    // Skip ako već procesira
    if (this.isProcessing) {
      this.logger.debug('⏭️ Preskačem - procesiranje već u toku');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // 1. Dohvati batch podataka iz MySQL buffer-a
      const batch = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM gps_raw_buffer 
        WHERE process_status = 'pending' 
        AND retry_count < 3
        ORDER BY received_at ASC
        LIMIT 1000
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

      // 4. Bulk insert u TimescaleDB
      if (valueStrings.length > 0) {
        const insertQuery = `
          INSERT INTO gps_data (
            time, vehicle_id, garage_no, lat, lng, location,
            speed, course, alt, state, in_route, data_source
          ) VALUES ${valueStrings.join(', ')}
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

        await this.timescalePool.query(insertQuery, values);

        // 5. Obriši uspešno procesirane iz MySQL buffer-a
        await this.prisma.$executeRaw`
          DELETE FROM gps_raw_buffer 
          WHERE id IN (${Prisma.join(ids)})
        `;

        const processingTime = Date.now() - startTime;
        this.processedCount += batch.length;
        this.lastProcessTime = new Date();

        this.logger.log(
          `✅ Procesirano ${batch.length} GPS tačaka u TimescaleDB za ${processingTime}ms`
        );
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
   * Pri gašenju aplikacije
   */
  async onModuleDestroy() {
    await this.timescalePool.end();
    this.logger.log('GPS Processor Service zaustavljen');
  }
}