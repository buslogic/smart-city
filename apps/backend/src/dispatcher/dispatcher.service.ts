import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import * as mysql from 'mysql2/promise';
import { Pool } from 'pg';
import {
  createTimescalePool,
  testTimescaleConnection,
} from '../common/config/timescale.config';

export interface VehiclePosition {
  garageNo: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  lineNumber: string | null;
  direction: string;
  captured: Date;
  peopleIn?: number;
  peopleOut?: number;
  batteryStatus?: number | null;
  vehicleInfo?: {
    registrationNumber?: string | null;
    totalCapacity?: number | null;
    vehicleType?: number | null;
  };
}

@Injectable()
export class DispatcherService {
  private readonly logger = new Logger(DispatcherService.name);
  private pgPool: Pool;

  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {
    // Inicijalizuj TimescaleDB pool
    this.pgPool = createTimescalePool();

    // Test connection
    testTimescaleConnection(this.pgPool).then((success) => {
      if (!success) {
        this.logger.error(
          '❌ DispatcherService nije mogao da se poveže na TimescaleDB',
        );
      }
    });
  }

  /**
   * Dohvata trenutne pozicije vozila iz lokalnog ili legacy izvora
   */
  async getCurrentVehiclePositions(
    source: 'local' | 'legacy' = 'local',
    limit: number = 100,
  ): Promise<VehiclePosition[]> {
    if (source === 'legacy') {
      return this.getPositionsFromLegacy(limit);
    } else {
      return this.getPositionsFromLocal(limit);
    }
  }

  /**
   * Dohvata pozicije iz lokalne tabele (legacy_city_gps_current)
   */
  private async getPositionsFromLocal(
    limit: number,
  ): Promise<VehiclePosition[]> {
    try {
      const positions = await this.prisma.legacyCityGpsCurrent.findMany({
        take: limit,
        orderBy: { captured: 'desc' },
        include: {
          vehicle: {
            select: {
              registrationNumber: true,
              totalCapacity: true,
              vehicleType: true,
            },
          },
        },
      });

      return positions.map((pos) => ({
        garageNo: pos.garageNo,
        lat: pos.lat.toNumber(),
        lng: pos.lng.toNumber(),
        speed: pos.speed,
        course: pos.course,
        lineNumber: pos.lineNumber,
        direction: pos.direction === 1 ? 'A' : 'B',
        captured: pos.captured,
        peopleIn: pos.peopleCounterIn || undefined,
        peopleOut: pos.peopleCounterOut || undefined,
        batteryStatus: pos.batteryStatus || undefined,
        vehicleInfo: pos.vehicle
          ? {
              registrationNumber: pos.vehicle.registrationNumber || undefined,
              totalCapacity: pos.vehicle.totalCapacity || undefined,
              vehicleType: pos.vehicle.vehicleType || undefined,
            }
          : undefined,
      }));
    } catch (error) {
      this.logger.error('Greška pri čitanju lokalne GPS tabele:', error);
      throw error;
    }
  }

  /**
   * Dohvata pozicije direktno iz legacy GPS baze
   */
  private async getPositionsFromLegacy(
    limit: number,
  ): Promise<VehiclePosition[]> {
    let connection: mysql.Connection | null = null;

    try {
      // Prvo dohvati listu naših vozila
      const ourVehicles = await this.prisma.busVehicle.findMany({
        select: {
          garageNumber: true,
          registrationNumber: true,
          totalCapacity: true,
          vehicleType: true,
        },
      });

      if (ourVehicles.length === 0) {
        this.logger.warn('Nema vozila u bus_vehicles tabeli');
        return [];
      }

      // Pripremi listu garage brojeva za query
      const garageNumbers = ourVehicles.map((v) => v.garageNumber);
      const placeholders = garageNumbers.map(() => '?').join(',');

      // Dohvati kredencijale za GPS bazu
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: {
          subtype: 'city_gps_ticketing_database',
          isActive: true,
        },
      });

      if (!legacyDb) {
        throw new Error('GPS legacy baza nije konfigurisana');
      }

      // Dekriptuj password
      const password = this.legacyDatabasesService.decryptPassword(
        legacyDb.password,
      );

      // Kreiraj konekciju
      connection = await mysql.createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: password,
        database: legacyDb.database,
      });

      // Dohvati podatke samo za naša vozila
      const [rows] = await connection.execute(
        `
        SELECT 
          garageNo,
          lat,
          lng,
          speed,
          course,
          line_number,
          direction,
          captured,
          people_counter_1_in + people_counter_2_in + people_counter_3_in + people_counter_4_in as people_in,
          people_counter_1_out + people_counter_2_out + people_counter_3_out + people_counter_4_out as people_out,
          battery_status
        FROM current
        WHERE garageNo IN (${placeholders})
        ORDER BY captured DESC
        LIMIT ?
      `,
        [...garageNumbers, limit],
      );

      // Mapiranje na naš format
      const positions = (rows as any[]).map((row) => ({
        garageNo: row.garageNo,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        speed: row.speed,
        course: row.course,
        lineNumber: row.line_number || null,
        direction: row.direction === 1 ? 'A' : 'B',
        captured: new Date(row.captured),
        peopleIn: row.people_in,
        peopleOut: row.people_out,
        batteryStatus: row.battery_status,
      }));

      // Mapiraj sa našim vozilima (već imamo podatke iz početka)
      const vehicleMap = new Map(ourVehicles.map((v) => [v.garageNumber, v]));

      return positions.map((pos) => ({
        ...pos,
        vehicleInfo: vehicleMap.get(pos.garageNo)
          ? {
              registrationNumber: vehicleMap.get(pos.garageNo)!
                .registrationNumber,
              totalCapacity: vehicleMap.get(pos.garageNo)!.totalCapacity,
              vehicleType: vehicleMap.get(pos.garageNo)!.vehicleType,
            }
          : undefined,
      }));
    } catch (error: any) {
      this.logger.error('Greška pri čitanju legacy GPS baze:', error);

      // Bolje error handling za različite tipove grešaka
      if (error.code === 'ETIMEDOUT') {
        throw new Error(
          'Konekcija sa Gradskim serverom nije moguća. Server je trenutno nedostupan ili je VPN veza prekinuta. Molimo kontaktirajte sistem administratora.',
        );
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Gradski server je odbio konekciju. Proverite da li je server aktivan.',
        );
      } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        throw new Error(
          'Pristup Gradskom serveru je odbijen. Proverite kredencijale.',
        );
      } else if (
        error.message?.includes('GPS legacy baza nije konfigurisana')
      ) {
        throw new Error(
          'Legacy GPS baza nije konfigurisana u sistemu. Kontaktirajte administratora.',
        );
      }

      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Dohvata listu vozača (korisnici koji su u user_groups sa driver = true)
   */
  async getDrivers() {
    try {
      const drivers = await this.prisma.user.findMany({
        where: {
          userGroup: {
            driver: true,
            isActive: true,
          },
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          userGroup: {
            select: {
              id: true,
              groupName: true,
            },
          },
        },
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' },
        ],
      });

      return drivers.map(driver => ({
        id: driver.id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        fullName: `${driver.firstName} ${driver.lastName}`,
        email: driver.email,
        avatar: driver.avatar,
        userGroup: driver.userGroup,
      }));
    } catch (error) {
      this.logger.error('Greška pri dohvatanju vozača:', error);
      throw error;
    }
  }

  /**
   * Dohvata podatke za karton vozača
   */
  async getDriverCard(driverId: number) {
    try {
      const driver = await this.prisma.user.findFirst({
        where: {
          id: driverId,
          userGroup: {
            driver: true,
            isActive: true,
          },
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          createdAt: true,
          userGroup: {
            select: {
              id: true,
              groupName: true,
            },
          },
        },
      });

      if (!driver) {
        throw new Error('Vozač nije pronađen ili nije aktivan');
      }

      // Za sada vraćamo osnovne podatke, ostala polja ćemo dodati kasnije
      return {
        driver: {
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          fullName: `${driver.firstName} ${driver.lastName}`,
          email: driver.email,
          avatar: driver.avatar,
          userGroup: driver.userGroup,
          employedSince: driver.createdAt,
        },
        // Prazna polja za sada - biće implementirana kasnije
        contactInfo: {
          address: '',
          phone1: '',
          phone2: '',
          employeeNumber: '',
        },
        // Tabela za godine - prazna za sada
        workHistory: {
          years: ['2025', '2026', '2027', '2028', '2029', '2030'],
          months: [
            'JANUAR', 'FEBRUAR', 'MART', 'APRIL', 'MAJ', 'JUN',
            'JUL', 'AVGUST', 'SEPTEMBAR', 'OKTOBAR', 'NOVEMBAR', 'DECEMBAR'
          ],
          data: {} // Biće popunjeno kasnije sa stvarnim podacima
        }
      };
    } catch (error) {
      this.logger.error('Greška pri dohvatanju kartona vozača:', error);
      throw error;
    }
  }

  /**
   * Sinhronizuje podatke iz legacy baze u lokalnu tabelu
   */
  async syncGPSData(): Promise<{ synced: number; errors: number }> {
    let connection: mysql.Connection | null = null;
    let synced = 0;
    let errors = 0;

    try {
      // Dohvati kredencijale
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: {
          subtype: 'city_gps_ticketing_database',
          isActive: true,
        },
      });

      if (!legacyDb) {
        throw new Error('GPS legacy baza nije konfigurisana');
      }

      const password = this.legacyDatabasesService.decryptPassword(
        legacyDb.password,
      );

      connection = await mysql.createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: password,
        database: legacyDb.database,
      });

      // Prvo dohvati listu naših vozila
      const ourVehicles = await this.prisma.busVehicle.findMany({
        select: {
          id: true,
          garageNumber: true,
        },
      });

      if (ourVehicles.length === 0) {
        this.logger.warn('Nema vozila u bus_vehicles tabeli za sync');
        return { synced: 0, errors: 0 };
      }

      const garageNumbers = ourVehicles.map((v) => v.garageNumber);
      const placeholders = garageNumbers.map(() => '?').join(',');

      // Dohvati samo podatke za naša vozila iz current tabele
      const [rows] = await connection.execute(
        `
        SELECT * FROM current
        WHERE garageNo IN (${placeholders})
      `,
        garageNumbers,
      );

      // Mapiraj vozila po garage number za brži pristup
      const vehicleMap = new Map(ourVehicles.map((v) => [v.garageNumber, v]));

      // Batch upsert u lokalnu tabelu
      for (const row of rows as any[]) {
        try {
          // Pronađi vozilo po garage number (već imamo u mapi)
          const vehicle = vehicleMap.get(row.garageNo);

          // Validacija datuma
          const capturedDate = row.captured
            ? new Date(row.captured)
            : new Date();
          const editedDate = row.edited ? new Date(row.edited) : new Date();

          // Proveri da li su datumi validni
          if (isNaN(capturedDate.getTime())) {
            this.logger.warn(
              `Invalid captured date for vehicle ${row.garageNo}, using current date`,
            );
            continue; // Preskoči ovaj red
          }

          await this.prisma.legacyCityGpsCurrent.upsert({
            where: { garageNo: row.garageNo },
            update: {
              lat: row.lat,
              lng: row.lng,
              course: row.course,
              speed: row.speed,
              alt: row.alt,
              state: row.state,
              lineNumber: row.line_number || null,
              tripType: row.trip_type,
              direction: row.direction,
              inRoute: row.inroute,
              captured: capturedDate,
              edited: editedDate,
              peopleCounterIn:
                (row.people_counter_1_in || 0) +
                (row.people_counter_2_in || 0) +
                (row.people_counter_3_in || 0) +
                (row.people_counter_4_in || 0),
              peopleCounterOut:
                (row.people_counter_1_out || 0) +
                (row.people_counter_2_out || 0) +
                (row.people_counter_3_out || 0) +
                (row.people_counter_4_out || 0),
              iotVoltage: row.iot_voltage || null,
              iotIgnition: row.iot_ignition || null,
              batteryStatus: row.battery_status || null,
              vehicleId: vehicle?.id || null,
              lastUpdate: new Date(),
              dataSource: 'cron',
            },
            create: {
              garageNo: row.garageNo,
              lat: row.lat,
              lng: row.lng,
              course: row.course,
              speed: row.speed,
              alt: row.alt,
              state: row.state,
              lineNumber: row.line_number || null,
              tripType: row.trip_type,
              direction: row.direction,
              inRoute: row.inroute,
              captured: capturedDate,
              edited: editedDate,
              peopleCounterIn:
                (row.people_counter_1_in || 0) +
                (row.people_counter_2_in || 0) +
                (row.people_counter_3_in || 0) +
                (row.people_counter_4_in || 0),
              peopleCounterOut:
                (row.people_counter_1_out || 0) +
                (row.people_counter_2_out || 0) +
                (row.people_counter_3_out || 0) +
                (row.people_counter_4_out || 0),
              iotVoltage: row.iot_voltage || null,
              iotIgnition: row.iot_ignition || null,
              batteryStatus: row.battery_status || null,
              vehicleId: vehicle?.id || null,
              dataSource: 'cron',
            },
          });
          synced++;
        } catch (error) {
          this.logger.error(
            `Greška pri sinhronizaciji vozila ${row.garageNo}:`,
            error,
          );
          errors++;
        }
      }

      this.logger.log(
        `Sinhronizacija završena: ${synced} uspešno, ${errors} grešaka`,
      );
      return { synced, errors };
    } catch (error) {
      this.logger.error('Greška pri sinhronizaciji GPS podataka:', error);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Dohvata GPS istoriju vozila za zadati period
   */
  async getVehicleHistory(
    vehicleId: number,
    startDate: Date,
    endDate: Date,
    source: 'gps_data' | 'gps_data_lag_filtered' = 'gps_data',
  ) {
    try {
      this.logger.log(
        `📍 Dohvatanje GPS istorije za vozilo ${vehicleId} od ${startDate.toISOString()} do ${endDate.toISOString()} iz ${source}`,
      );

      // Query za dohvatanje GPS tačaka - koristi odgovarajuću tabelu
      // Za gps_data_lag_filtered automatski isključi outlier-e
      const isLagFiltered = source === 'gps_data_lag_filtered';
      const gpsQuery = `
        SELECT
          time,
          vehicle_id,
          garage_no,
          lat,
          lng,
          speed,
          course,
          line_number,
          people_in,
          people_out
        FROM ${source}
        WHERE vehicle_id = $1
          AND time >= $2
          AND time <= $3
          ${isLagFiltered ? 'AND is_outlier = FALSE' : ''}
        ORDER BY time ASC
      `;

      // DEBUG: Loguj kompletan query
      this.logger.log(`🔍 [Service] SQL Query: ${gpsQuery.replace(/\s+/g, ' ').trim()}`);
      this.logger.log(`📊 [Service] Parametri: vehicleId=${vehicleId}, start=${startDate.toISOString()}, end=${endDate.toISOString()}`);

      const result = await this.pgPool.query(gpsQuery, [
        vehicleId,
        startDate,
        endDate,
      ]);

      this.logger.log(`✅ [Service] Pronađeno ${result.rows.length} tačaka iz tabele ${source}`);

      const points = result.rows;

      if (points.length === 0) {
        return {
          points: [],
          statistics: {
            totalDistance: 0,
            drivingTime: 0,
            idleTime: 0,
            averageSpeed: 0,
            maxSpeed: 0,
            totalPoints: 0,
          },
        };
      }

      // Kalkulacija statistika
      let totalDistance = 0;
      let drivingTime = 0;
      let idleTime = 0;
      let maxSpeed = 0;
      let speedSum = 0;
      let drivingPoints = 0;

      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];

        // Haversine formula za udaljenost
        const distance = this.calculateDistance(
          current.lat,
          current.lng,
          next.lat,
          next.lng,
        );

        totalDistance += distance;

        // Vreme između dve tačke (u minutama)
        const timeDiff =
          (new Date(next.time).getTime() - new Date(current.time).getTime()) /
          1000 /
          60;

        if (current.speed > 0) {
          drivingTime += timeDiff;
          speedSum += current.speed;
          drivingPoints++;
          maxSpeed = Math.max(maxSpeed, current.speed);
        } else {
          idleTime += timeDiff;
        }
      }

      const statistics = {
        totalDistance: Math.round(totalDistance * 100) / 100, // km
        drivingTime: Math.round(drivingTime), // minuti
        idleTime: Math.round(idleTime), // minuti
        averageSpeed:
          drivingPoints > 0 ? Math.round(speedSum / drivingPoints) : 0,
        maxSpeed: Math.round(maxSpeed),
        totalPoints: points.length,
      };

      // Formatiraj tačke za frontend
      const formattedPoints = points.map((p) => ({
        time: p.time,
        lat: parseFloat(p.lat),
        lng: parseFloat(p.lng),
        speed: p.speed,
        course: p.course,
        lineNumber: p.line_number,
        peopleIn: p.people_in,
        peopleOut: p.people_out,
      }));

      this.logger.log(
        `✅ Pronađeno ${points.length} GPS tačaka, ukupna distanca: ${statistics.totalDistance} km`,
      );

      return {
        points: formattedPoints,
        statistics,
      };
    } catch (error) {
      this.logger.error(
        `Greška pri dohvatanju GPS istorije za vozilo ${vehicleId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Haversine formula za kalkulaciju udaljenosti između dve geografske tačke
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radijus Zemlje u km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
