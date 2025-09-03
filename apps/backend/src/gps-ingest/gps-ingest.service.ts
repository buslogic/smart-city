import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { GpsPointDto } from './dto/gps-batch.dto';
import { PrismaService } from '../prisma/prisma.service';
import { createTimescalePool, testTimescaleConnection } from '../common/config/timescale.config';

@Injectable()
export class GpsIngestService {
  private readonly logger = new Logger(GpsIngestService.name);
  private timescalePool: Pool;

  constructor(private prisma: PrismaService) {
    // Kreiraj konekciju na TimescaleDB koristeći centralizovanu konfiguraciju
    this.timescalePool = createTimescalePool();

    this.timescalePool.on('error', (err) => {
      this.logger.error('Neočekivana greška na TimescaleDB pool', err);
    });

    // Test connection - quiet initialization
    testTimescaleConnection(this.timescalePool).then(success => {
      if (!success) {
        this.logger.error('❌ GpsIngestService nije mogao da se poveže na TimescaleDB');
      }
    });
  }

  /**
   * Validacija API ključa
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const result = await this.timescalePool.query(
        `SELECT id, is_active FROM api_keys 
         WHERE key = $1 AND is_active = true`,
        [apiKey]
      );

      if (result.rows.length > 0) {
        // Ažuriraj last_used_at i request_count
        await this.timescalePool.query(
          `UPDATE api_keys 
           SET last_used_at = NOW(), request_count = request_count + 1 
           WHERE id = $1`,
          [result.rows[0].id]
        );
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Greška pri validaciji API ključa:', error);
      // U slučaju greške, dozvoli pristup ali logiraj
      return apiKey === 'smartcity_legacy_gps_key_2024';
    }
  }

  /**
   * Obradi batch GPS podataka - sada upisuje u MySQL buffer
   */
  async processBatch(
    gpsPoints: GpsPointDto[],
    source: string
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    try {
      // Pripremi podatke za MySQL buffer
      const bufferData: any[] = [];

      for (const point of gpsPoints) {
        try {
          // Pronađi vehicle_id na osnovu garage_no (opciono)
          let vehicleId: number | null = null;
          if (point.garageNo) {
            const vehicleResult = await this.prisma.busVehicle.findFirst({
              where: { garageNumber: point.garageNo },
              select: { id: true },
            });
            vehicleId = vehicleResult?.id || null;
          }

          // Pripremi timestamp
          const timestamp = point.captured || point.timestamp || new Date().toISOString();

          // Dodaj u buffer array
          bufferData.push({
            vehicleId: vehicleId,
            garageNo: point.garageNo || '',
            imei: point.imei || null,
            timestamp: new Date(timestamp),
            lat: parseFloat(point.lat.toString()),
            lng: parseFloat(point.lng.toString()),
            speed: point.speed || 0,
            course: point.course || 0,
            altitude: point.alt || point.altitude || 0,
            satellites: point.satellites || 0,
            state: point.state || 0,
            inRoute: point.inRoute || 0,
            source: source,
            processStatus: 'pending',
            retryCount: 0,
          });

        } catch (error) {
          this.logger.warn(`Greška pri pripremi podatka za ${point.garageNo}:`, error);
          failed++;
        }
      }

      if (bufferData.length > 0) {
        // Bulk insert u MySQL buffer
        const result = await this.prisma.gpsRawBuffer.createMany({
          data: bufferData,
          skipDuplicates: true,
        });
        
        processed = result.count;
        
        // Ažuriraj statistike za primljene podatke
        const hourSlot = new Date();
        hourSlot.setMinutes(0, 0, 0);
        hourSlot.setMilliseconds(0);
        await this.prisma.$executeRaw`
          INSERT INTO gps_processing_stats (hour_slot, received_count, updated_at)
          VALUES (${hourSlot}, ${processed}, NOW())
          ON DUPLICATE KEY UPDATE
            received_count = received_count + ${processed},
            updated_at = NOW()
        `;
        
        this.logger.log(`✅ Buffered ${processed} GPS points u MySQL buffer iz ${source}`);
      }

    } catch (error) {
      this.logger.error('Greška pri upisu u GPS buffer:', error);
      throw error;
    }

    return { processed, failed };
  }

  /**
   * STARA METODA - zadržavamo za direktan upis ako zatrebaSS
   */
  async processDirectToTimescale(
    gpsPoints: GpsPointDto[],
    source: string
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    // Pripremi batch insert query
    const client = await this.timescalePool.connect();

    try {
      // Počni transakciju
      await client.query('BEGIN');

      // Pripremi podatke za batch insert
      const values: any[] = [];
      const valueStrings: string[] = [];
      let paramCounter = 1;

      for (const point of gpsPoints) {
        try {
          // Pronađi vehicle_id na osnovu garage_no
          const vehicleResult = await this.prisma.busVehicle.findFirst({
            where: { garageNumber: point.garageNo },
            select: { id: true },
          });

          const vehicleId = vehicleResult?.id || null;

          // Dodaj vrednosti za ovaj red
          const rowValues = [
            new Date(point.captured || point.timestamp || new Date().toISOString()), // time
            vehicleId, // vehicle_id
            point.garageNo, // garage_no
            point.lat, // lat
            point.lng, // lng
            point.speed || 0, // speed
            point.course || 0, // course
            point.alt || 0, // alt
            point.state || 0, // state
            point.inRoute || 0, // in_route
            point.lineNumber || null, // line_number
            point.direction || null, // direction
            null, // trip_id (za sada null)
            point.departureId || null, // departure_id
            point.peopleIn || 0, // people_in
            point.peopleOut || 0, // people_out
            point.batteryStatus || null, // battery_status
            source, // data_source
          ];

          values.push(...rowValues);

          // Kreiraj placeholder string za ovaj red
          const placeholders: string[] = [];
          for (let i = 0; i < rowValues.length; i++) {
            placeholders.push(`$${paramCounter++}`);
          }
          valueStrings.push(`(${placeholders.join(', ')})`);

        } catch (error) {
          this.logger.warn(`Greška pri pripremi podatka za ${point.garageNo}:`, error);
          failed++;
        }
      }

      if (valueStrings.length > 0) {
        // Izvr\u0161i batch insert
        const insertQuery = `
          INSERT INTO gps_data (
            time, vehicle_id, garage_no, lat, lng, speed, course, alt,
            state, in_route, line_number, direction, trip_id, departure_id,
            people_in, people_out, battery_status, data_source
          ) VALUES ${valueStrings.join(', ')}
          ON CONFLICT (time, garage_no) DO UPDATE SET
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            speed = EXCLUDED.speed,
            course = EXCLUDED.course,
            state = EXCLUDED.state,
            in_route = EXCLUDED.in_route,
            line_number = EXCLUDED.line_number,
            direction = EXCLUDED.direction,
            people_in = EXCLUDED.people_in,
            people_out = EXCLUDED.people_out,
            battery_status = EXCLUDED.battery_status
        `;

        await client.query(insertQuery, values);
        processed = valueStrings.length;
      }

      // Završi transakciju
      await client.query('COMMIT');

      this.logger.log(`Batch direktno u TimescaleDB: ${processed} uspešno, ${failed} neuspešno`);

    } catch (error) {
      // Rollback u slučaju greške
      await client.query('ROLLBACK');
      this.logger.error('Greška pri batch insert:', error);
      throw error;
    } finally {
      // Oslobodi konekciju
      client.release();
    }

    return { processed, failed };
  }

  /**
   * Zatvori konekcije pri gašenju aplikacije
   */
  async onModuleDestroy() {
    await this.timescalePool.end();
  }
}