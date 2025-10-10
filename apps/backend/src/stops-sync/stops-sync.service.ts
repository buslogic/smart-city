import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { createConnection } from 'mysql2/promise';
import { StopDto, SyncResponseDto } from './dto';

@Injectable()
export class StopsSyncService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  // ========== GLAVNI SERVER (NAŠA BAZA) ==========

  async findAllMain(): Promise<StopDto[]> {
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM unique_station_id_local ORDER BY unique_id ASC
    `;

    return results.map(this.mapStopToDto);
  }

  // ========== TIKETING SERVER (LEGACY BAZA) ==========

  async findAllTicketing(): Promise<StopDto[]> {
    return this.findAllFromLegacy('main_ticketing_database');
  }

  // ========== GRADSKI SERVER (LEGACY BAZA) ==========

  async findAllCity(): Promise<StopDto[]> {
    return this.findAllFromLegacy('city_ticketing_database');
  }

  // ========== SINHRONIZACIJA ==========

  async syncFromTicketing(): Promise<SyncResponseDto> {
    console.log('🔄 Starting Ticketing Server sync for stops...');
    const startTime = Date.now();

    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      // Pronađi legacy bazu
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'main_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna Ticketing Baza" nije pronađena',
        );
      }

      // Dekriptuj password
      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      // Konektuj se na legacy bazu
      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        // Učitaj sve rekorde iz legacy tabele
        const [rows] = await connection.execute(
          'SELECT * FROM unique_station_id_local ORDER BY unique_id ASC',
        );

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} stops in legacy database`);

        // Procesiraj u batch-ovima od 50 rekorda
        const BATCH_SIZE = 50;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          for (const legacyRecord of batch) {
            try {
              const result = await this.processStopSyncFromTicketing(legacyRecord);

              switch (result.action) {
                case 'insert':
                  inserted++;
                  break;
                case 'update':
                  updated++;
                  break;
              }
            } catch (error) {
              errors++;
              console.error(
                `❌ Error processing record ID ${legacyRecord.unique_id}:`,
                error.message,
              );
            }
          }

          // Log progress
          const processed = Math.min(i + BATCH_SIZE, legacyRecords.length);
          console.log(
            `📈 Progress: ${processed}/${totalProcessed} (${Math.round((processed / totalProcessed) * 100)}%)`,
          );
        }
      } finally {
        await connection.end();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Sync completed in ${duration}s`);
      console.log(
        `   Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`,
      );

      return {
        message: `Sinhronizacija završena: ${inserted} dodato, ${updated} ažurirano${errors > 0 ? `, ${errors} grešaka` : ''}`,
        inserted,
        updated,
        deleted,
        total: totalProcessed,
        duration: parseFloat(duration),
      };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji: ${error.message}`,
      );
    }
  }

  async syncFromCity(): Promise<SyncResponseDto> {
    console.log('🔄 Starting City Server sync for stops...');
    const startTime = Date.now();

    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      // Pronađi legacy bazu
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Gradska Ticketing Baza" nije pronađena',
        );
      }

      // Dekriptuj password
      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      // Konektuj se na legacy bazu
      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        // Učitaj sve rekorde iz legacy tabele
        const [rows] = await connection.execute(
          'SELECT * FROM unique_station_id_local ORDER BY unique_id ASC',
        );

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} stops in legacy database`);

        // Procesiraj u batch-ovima od 50 rekorda
        const BATCH_SIZE = 50;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          for (const legacyRecord of batch) {
            try {
              const result = await this.processStopSyncFromCity(legacyRecord);

              switch (result.action) {
                case 'insert':
                  inserted++;
                  break;
                case 'update':
                  updated++;
                  break;
              }
            } catch (error) {
              errors++;
              console.error(
                `❌ Error processing record ID ${legacyRecord.unique_id}:`,
                error.message,
              );
            }
          }

          // Log progress
          const processed = Math.min(i + BATCH_SIZE, legacyRecords.length);
          console.log(
            `📈 Progress: ${processed}/${totalProcessed} (${Math.round((processed / totalProcessed) * 100)}%)`,
          );
        }
      } finally {
        await connection.end();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Sync completed in ${duration}s`);
      console.log(
        `   Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`,
      );

      return {
        message: `Sinhronizacija završena: ${inserted} dodato, ${updated} ažurirano${errors > 0 ? `, ${errors} grešaka` : ''}`,
        inserted,
        updated,
        deleted,
        total: totalProcessed,
        duration: parseFloat(duration),
      };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji: ${error.message}`,
      );
    }
  }

  // ========== HELPER METODE ZA SINHRONIZACIJU ==========

  private async processStopSyncFromTicketing(legacyRecord: any) {
    // Konvertuj unique_id u BIGINT za legacy_ticketing_id
    // unique_id je VARCHAR(5) sa numeričkim vrednostima ('1', '2', '151', '894')
    const legacyTicketingId = BigInt(legacyRecord.unique_id);

    // Proveri da li rekord već postoji na osnovu unique_id
    const existingRecord = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM unique_station_id_local WHERE unique_id = ${legacyRecord.unique_id}
    `;

    if (existingRecord.length === 0) {
      // INSERT - novi rekord
      await this.prisma.$executeRaw`
        INSERT INTO unique_station_id_local (
          unique_id, station_name, gpsx, gpsy, description,
          \`range\`, range_for_driver_console, range_for_validators,
          changed, main_operator, group_id, ready_for_booking,
          used_in_booking, date_valid_from, legacy_ticketing_id
        ) VALUES (
          ${legacyRecord.unique_id},
          ${legacyRecord.station_name},
          ${legacyRecord.gpsx},
          ${legacyRecord.gpsy},
          ${legacyRecord.description || ''},
          ${legacyRecord.range},
          ${legacyRecord.range_for_driver_console},
          ${legacyRecord.range_for_validators},
          ${legacyRecord.changed},
          ${legacyRecord.main_operator},
          ${legacyRecord.group_id},
          ${legacyRecord.ready_for_booking},
          ${legacyRecord.used_in_booking},
          ${legacyRecord.date_valid_from},
          ${legacyTicketingId}
        )
      `;

      return { action: 'insert' };
    } else {
      // UPDATE - ažuriraj postojeći rekord
      await this.prisma.$executeRaw`
        UPDATE unique_station_id_local SET
          station_name = ${legacyRecord.station_name},
          gpsx = ${legacyRecord.gpsx},
          gpsy = ${legacyRecord.gpsy},
          description = ${legacyRecord.description || ''},
          \`range\` = ${legacyRecord.range},
          range_for_driver_console = ${legacyRecord.range_for_driver_console},
          range_for_validators = ${legacyRecord.range_for_validators},
          changed = ${legacyRecord.changed},
          main_operator = ${legacyRecord.main_operator},
          group_id = ${legacyRecord.group_id},
          ready_for_booking = ${legacyRecord.ready_for_booking},
          used_in_booking = ${legacyRecord.used_in_booking},
          date_valid_from = ${legacyRecord.date_valid_from},
          legacy_ticketing_id = ${legacyTicketingId}
        WHERE unique_id = ${legacyRecord.unique_id}
      `;

      return { action: 'update' };
    }
  }

  private async processStopSyncFromCity(legacyRecord: any) {
    // Konvertuj unique_id u BIGINT za legacy_city_id
    const legacyCityId = BigInt(legacyRecord.unique_id);

    // Proveri da li rekord već postoji na osnovu unique_id
    const existingRecord = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM unique_station_id_local WHERE unique_id = ${legacyRecord.unique_id}
    `;

    if (existingRecord.length === 0) {
      // INSERT - novi rekord
      await this.prisma.$executeRaw`
        INSERT INTO unique_station_id_local (
          unique_id, station_name, gpsx, gpsy, description,
          \`range\`, range_for_driver_console, range_for_validators,
          changed, main_operator, group_id, ready_for_booking,
          used_in_booking, date_valid_from, legacy_city_id
        ) VALUES (
          ${legacyRecord.unique_id},
          ${legacyRecord.station_name},
          ${legacyRecord.gpsx},
          ${legacyRecord.gpsy},
          ${legacyRecord.description || ''},
          ${legacyRecord.range},
          ${legacyRecord.range_for_driver_console},
          ${legacyRecord.range_for_validators},
          ${legacyRecord.changed},
          ${legacyRecord.main_operator},
          ${legacyRecord.group_id},
          ${legacyRecord.ready_for_booking},
          ${legacyRecord.used_in_booking},
          ${legacyRecord.date_valid_from},
          ${legacyCityId}
        )
      `;

      return { action: 'insert' };
    } else {
      // UPDATE - ažuriraj postojeći rekord
      await this.prisma.$executeRaw`
        UPDATE unique_station_id_local SET
          station_name = ${legacyRecord.station_name},
          gpsx = ${legacyRecord.gpsx},
          gpsy = ${legacyRecord.gpsy},
          description = ${legacyRecord.description || ''},
          \`range\` = ${legacyRecord.range},
          range_for_driver_console = ${legacyRecord.range_for_driver_console},
          range_for_validators = ${legacyRecord.range_for_validators},
          changed = ${legacyRecord.changed},
          main_operator = ${legacyRecord.main_operator},
          group_id = ${legacyRecord.group_id},
          ready_for_booking = ${legacyRecord.ready_for_booking},
          used_in_booking = ${legacyRecord.used_in_booking},
          date_valid_from = ${legacyRecord.date_valid_from},
          legacy_city_id = ${legacyCityId}
        WHERE unique_id = ${legacyRecord.unique_id}
      `;

      return { action: 'update' };
    }
  }

  // ========== HELPER METODE ==========

  private async findAllFromLegacy(subtype: string): Promise<StopDto[]> {
    try {
      // Pronađi legacy bazu prema subtype-u
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          `Legacy baza sa subtype "${subtype}" nije pronađena`,
        );
      }

      // Dekriptuj password
      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      // Kreiraj konekciju
      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        // Učitaj sve stajališta iz legacy baze
        const [rows] = await connection.execute(
          'SELECT * FROM unique_station_id_local ORDER BY unique_id ASC',
        );

        return (rows as any[]).map(this.mapStopToDto);
      } finally {
        // Uvek zatvori konekciju
        await connection.end();
      }
    } catch (error) {
      console.error(`Greška pri učitavanju iz legacy baze (${subtype}):`, error);
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }

  private mapStopToDto(record: any): StopDto {
    return {
      uniqueId: record.unique_id,
      stationName: record.station_name,
      gpsx: parseFloat(record.gpsx),
      gpsy: parseFloat(record.gpsy),
      description: record.description || '',
      range: record.range,
      rangeForDriverConsole: record.range_for_driver_console,
      rangeForValidators: record.range_for_validators,
      changed: Boolean(record.changed),
      mainOperator: Boolean(record.main_operator),
      groupId: record.group_id,
      readyForBooking: record.ready_for_booking,
      usedInBooking: record.used_in_booking,
      dateValidFrom: record.date_valid_from ? new Date(record.date_valid_from) : null,
    };
  }
}
