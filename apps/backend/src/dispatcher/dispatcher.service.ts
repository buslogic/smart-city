import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import * as mysql from 'mysql2/promise';

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

  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

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
  private async getPositionsFromLocal(limit: number): Promise<VehiclePosition[]> {
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

      return positions.map(pos => ({
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
        vehicleInfo: pos.vehicle ? {
          registrationNumber: pos.vehicle.registrationNumber || undefined,
          totalCapacity: pos.vehicle.totalCapacity || undefined,
          vehicleType: pos.vehicle.vehicleType || undefined,
        } : undefined,
      }));
    } catch (error) {
      this.logger.error('Greška pri čitanju lokalne GPS tabele:', error);
      throw error;
    }
  }

  /**
   * Dohvata pozicije direktno iz legacy GPS baze
   */
  private async getPositionsFromLegacy(limit: number): Promise<VehiclePosition[]> {
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
      const garageNumbers = ourVehicles.map(v => v.garageNumber);
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
      const password = this.legacyDatabasesService.decryptPassword(legacyDb.password);

      // Kreiraj konekciju
      connection = await mysql.createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: password,
        database: legacyDb.database,
      });

      // Dohvati podatke samo za naša vozila
      const [rows] = await connection.execute(`
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
      `, [...garageNumbers, limit]);

      // Mapiranje na naš format
      const positions = (rows as any[]).map(row => ({
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
      const vehicleMap = new Map(ourVehicles.map(v => [v.garageNumber, v]));

      return positions.map(pos => ({
        ...pos,
        vehicleInfo: vehicleMap.get(pos.garageNo) ? {
          registrationNumber: vehicleMap.get(pos.garageNo)!.registrationNumber,
          totalCapacity: vehicleMap.get(pos.garageNo)!.totalCapacity,
          vehicleType: vehicleMap.get(pos.garageNo)!.vehicleType,
        } : undefined,
      }));

    } catch (error: any) {
      this.logger.error('Greška pri čitanju legacy GPS baze:', error);
      
      // Bolje error handling za različite tipove grešaka
      if (error.code === 'ETIMEDOUT') {
        throw new Error('Konekcija sa Gradskim serverom nije moguća. Server je trenutno nedostupan ili je VPN veza prekinuta. Molimo kontaktirajte sistem administratora.');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Gradski server je odbio konekciju. Proverite da li je server aktivan.');
      } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        throw new Error('Pristup Gradskom serveru je odbijen. Proverite kredencijale.');
      } else if (error.message?.includes('GPS legacy baza nije konfigurisana')) {
        throw new Error('Legacy GPS baza nije konfigurisana u sistemu. Kontaktirajte administratora.');
      }
      
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
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

      const password = this.legacyDatabasesService.decryptPassword(legacyDb.password);

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

      const garageNumbers = ourVehicles.map(v => v.garageNumber);
      const placeholders = garageNumbers.map(() => '?').join(',');

      // Dohvati samo podatke za naša vozila iz current tabele
      const [rows] = await connection.execute(`
        SELECT * FROM current
        WHERE garageNo IN (${placeholders})
      `, garageNumbers);

      // Mapiraj vozila po garage number za brži pristup
      const vehicleMap = new Map(ourVehicles.map(v => [v.garageNumber, v]));

      // Batch upsert u lokalnu tabelu
      for (const row of rows as any[]) {
        try {
          // Pronađi vozilo po garage number (već imamo u mapi)
          const vehicle = vehicleMap.get(row.garageNo);

          // Validacija datuma
          const capturedDate = row.captured ? new Date(row.captured) : new Date();
          const editedDate = row.edited ? new Date(row.edited) : new Date();
          
          // Proveri da li su datumi validni
          if (isNaN(capturedDate.getTime())) {
            this.logger.warn(`Invalid captured date for vehicle ${row.garageNo}, using current date`);
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
          this.logger.error(`Greška pri sinhronizaciji vozila ${row.garageNo}:`, error);
          errors++;
        }
      }

      this.logger.log(`Sinhronizacija završena: ${synced} uspešno, ${errors} grešaka`);
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
}