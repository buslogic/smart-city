import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { GpsPointDto } from './dto/gps-batch.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GpsIngestService {
  private readonly logger = new Logger(GpsIngestService.name);
  private timescalePool: Pool;

  constructor(private prisma: PrismaService) {
    // Kreiraj konekciju na TimescaleDB
    this.timescalePool = new Pool({
      host: process.env.TIMESCALE_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALE_PORT || '5433'),
      database: process.env.TIMESCALE_DB || 'smartcity_gps',
      user: process.env.TIMESCALE_USER || 'smartcity_ts',
      password: process.env.TIMESCALE_PASSWORD || 'TimescalePass123!',
      max: 20, // maksimalni broj konekcija u pool-u
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.timescalePool.on('error', (err) => {
      this.logger.error('Neočekivana greška na TimescaleDB pool', err);
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
   * Obradi batch GPS podataka
   */
  async processBatch(
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
            new Date(point.captured), // time
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

      this.logger.log(`Batch obrađen: ${processed} uspešno, ${failed} neuspešno`);

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