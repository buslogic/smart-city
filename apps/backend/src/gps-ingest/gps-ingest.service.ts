import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { GpsPointDto } from './dto/gps-batch.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import {
  createTimescalePool,
  testTimescaleConnection,
} from '../common/config/timescale.config';

@Injectable()
export class GpsIngestService {
  private readonly logger = new Logger(GpsIngestService.name);
  private timescalePool: Pool;

  constructor(
    private prisma: PrismaService,
    private apiKeysService: ApiKeysService,
  ) {
    // Kreiraj konekciju na TimescaleDB koristeći centralizovanu konfiguraciju
    this.timescalePool = createTimescalePool();

    this.timescalePool.on('error', (err) => {
      this.logger.error('Neočekivana greška na TimescaleDB pool', err);
    });

    // Test connection - quiet initialization
    testTimescaleConnection(this.timescalePool).then((success) => {
      if (!success) {
        this.logger.error(
          '❌ GpsIngestService nije mogao da se poveže na TimescaleDB',
        );
      }
    });
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
   * Validacija API ključa - koristi novi sigurni API Keys sistem
   */
  async validateApiKey(
    apiKey: string,
    ipAddress?: string,
    userAgent?: string,
    endpoint?: string,
    method?: string,
  ): Promise<boolean> {
    try {
      const validKey = await this.apiKeysService.validateApiKey(
        apiKey,
        ipAddress,
        userAgent,
        endpoint,
        method,
      );

      if (validKey) {
        // Dodatna provera da li ključ ima potrebne permisije za GPS ingest
        const permissions = validKey.permissions
          ? JSON.parse(validKey.permissions as string)
          : [];
        const hasGpsPermission =
          permissions.includes('gps:ingest') ||
          permissions.includes('*') ||
          validKey.type === 'INTEGRATION';

        if (!hasGpsPermission) {
          this.logger.warn(
            `API ključ ${validKey.displayKey} nema dozvolu za GPS ingest`,
          );
          return false;
        }

        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Greška pri validaciji API ključa:', error);

      // Fallback za legacy ključ tokom tranzicije
      if (
        apiKey === 'test-api-key-2024' ||
        apiKey === 'smartcity_legacy_gps_key_2024'
      ) {
        this.logger.warn(
          'Korišćen legacy API ključ - potrebna je migracija na novi sistem!',
        );
        return true;
      }

      return false;
    }
  }

  /**
   * Obradi batch GPS podataka - sada upisuje u MySQL buffer
   */
  async processBatch(
    gpsPoints: GpsPointDto[],
    source: string,
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
          const timestamp =
            point.captured || point.timestamp || new Date().toISOString();

          // Dodaj u buffer array
          bufferData.push({
            vehicleId: vehicleId,
            garageNo: point.garageNo || '',
            imei: point.imei || null,
            timestamp: new Date(this.convertBelgradeToUTC(timestamp)),
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
            workerGroup: vehicleId ? vehicleId % 8 : 0, // Dodeli worker grupu na osnovu vehicle_id
          });
        } catch (error) {
          this.logger.warn(
            `Greška pri pripremi podatka za ${point.garageNo}:`,
            error,
          );
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

        this.logger.log(
          `✅ Buffered ${processed} GPS points u MySQL buffer iz ${source}`,
        );
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
    source: string,
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
            new Date(
              this.convertBelgradeToUTC(
                point.captured || point.timestamp || new Date().toISOString(),
              ),
            ), // time - konvertovano u UTC
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
          this.logger.warn(
            `Greška pri pripremi podatka za ${point.garageNo}:`,
            error,
          );
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

      this.logger.log(
        `Batch direktno u TimescaleDB: ${processed} uspešno, ${failed} neuspešno`,
      );
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
