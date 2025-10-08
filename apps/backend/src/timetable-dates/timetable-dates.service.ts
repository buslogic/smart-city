import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { CreateTimetableDateDto } from './dto/create-timetable-date.dto';
import { UpdateTimetableDateDto } from './dto/update-timetable-date.dto';
import { createConnection } from 'mysql2/promise';

@Injectable()
export class TimetableDatesService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  // ========== GLAVNI SERVER (NAŠA BAZA) ==========

  async create(createTimetableDateDto: CreateTimetableDateDto) {
    const { legacyCityId, ...rest } = createTimetableDateDto;

    const result = await this.prisma.timetableDate.create({
      data: {
        ...rest,
        dateTime: new Date(), // Automatski setuj trenutno vreme
        legacyCityId: legacyCityId ? BigInt(legacyCityId) : null,
      },
    });

    // Konvertuj BigInt u string za JSON serialization
    return {
      ...result,
      id: result.id.toString(),
      legacyTicketingId: result.legacyTicketingId
        ? result.legacyTicketingId.toString()
        : null,
      legacyCityId: result.legacyCityId ? result.legacyCityId.toString() : null,
    };
  }

  async findAllMain() {
    const results = await this.prisma.timetableDate.findMany({
      orderBy: { dateTime: 'desc' },
    });

    // Konvertuj BigInt u string za JSON serialization
    return results.map((group) => ({
      ...group,
      id: group.id.toString(),
      legacyTicketingId: group.legacyTicketingId
        ? group.legacyTicketingId.toString()
        : null,
      legacyCityId: group.legacyCityId ? group.legacyCityId.toString() : null,
    }));
  }

  async findOne(id: number) {
    const timetableDate = await this.prisma.timetableDate.findUnique({
      where: { id: BigInt(id) },
    });

    if (!timetableDate) {
      throw new NotFoundException(
        `Grupa za RedVoznje sa ID ${id} nije pronađena`,
      );
    }

    // Konvertuj BigInt u string za JSON serialization
    return {
      ...timetableDate,
      id: timetableDate.id.toString(),
      legacyTicketingId: timetableDate.legacyTicketingId
        ? timetableDate.legacyTicketingId.toString()
        : null,
      legacyCityId: timetableDate.legacyCityId
        ? timetableDate.legacyCityId.toString()
        : null,
    };
  }

  async update(id: number, updateTimetableDateDto: UpdateTimetableDateDto) {
    await this.findOne(id); // Proverava da li postoji

    const { legacyCityId, ...rest } = updateTimetableDateDto;

    const result = await this.prisma.timetableDate.update({
      where: { id: BigInt(id) },
      data: {
        ...rest,
        dateTime: new Date(), // Ažuriraj vreme izmene
        legacyCityId:
          legacyCityId !== undefined
            ? legacyCityId
              ? BigInt(legacyCityId)
              : null
            : undefined,
      },
    });

    // Konvertuj BigInt u string za JSON serialization
    return {
      ...result,
      id: result.id.toString(),
      legacyTicketingId: result.legacyTicketingId
        ? result.legacyTicketingId.toString()
        : null,
      legacyCityId: result.legacyCityId ? result.legacyCityId.toString() : null,
    };
  }

  async remove(id: number) {
    await this.findOne(id); // Proverava da li postoji

    const result = await this.prisma.timetableDate.delete({
      where: { id: BigInt(id) },
    });

    return {
      ...result,
      id: result.id.toString(),
      legacyTicketingId: result.legacyTicketingId
        ? result.legacyTicketingId.toString()
        : null,
      legacyCityId: result.legacyCityId ? result.legacyCityId.toString() : null,
    };
  }

  // ========== TIKETING SERVER (LEGACY BAZA) ==========

  async findAllTicketing() {
    return this.findAllFromLegacy('main_ticketing_database');
  }

  // ========== GRADSKI SERVER (LEGACY BAZA) ==========

  async findAllCity() {
    return this.findAllFromLegacy('city_ticketing_database');
  }

  // ========== SINHRONIZACIJA ==========

  async syncFromTicketing(userId: number) {
    console.log('🔄 Starting Ticketing Server sync for timetable dates...');
    const startTime = Date.now();

    let created = 0;
    let updated = 0;
    let skipped = 0;
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
        // Prvo proveri da li tabela postoji
        const [tables] = await connection.execute(
          "SHOW TABLES LIKE 'timetable_dates'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "timetable_dates" ne postoji u legacy bazi - preskačem sinhronizaciju',
          );
          return {
            success: true,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
            totalProcessed: 0,
            message:
              'Tabela "timetable_dates" ne postoji u legacy bazi - nije bilo šta da se sinhronizuje',
          };
        }

        // Učitaj sve rekorde iz legacy tabele
        const [rows] = await connection.execute(
          'SELECT * FROM timetable_dates ORDER BY id ASC',
        );

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} records in legacy database`);

        // Procesiraj u batch-ovima od 50 rekorda
        const BATCH_SIZE = 50;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          for (const legacyRecord of batch) {
            try {
              const result =
                await this.processTimetableDateSyncFromTicketing(legacyRecord);

              switch (result.action) {
                case 'create':
                  created++;
                  break;
                case 'update':
                  updated++;
                  break;
                case 'skip':
                  skipped++;
                  break;
              }
            } catch (error) {
              errors++;
              console.error(
                `❌ Error processing record ID ${legacyRecord.id}:`,
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
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return {
        success: true,
        created,
        updated,
        skipped,
        errors,
        totalProcessed,
        message: `Sinhronizacija završena: ${created} kreirano, ${updated} ažurirano, ${skipped} preskočeno${errors > 0 ? `, ${errors} grešaka` : ''}`,
      };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji: ${error.message}`,
      );
    }
  }

  async syncFromCity(userId: number) {
    console.log('🔄 Starting City Server sync for timetable dates...');
    const startTime = Date.now();

    let created = 0;
    let updated = 0;
    let skipped = 0;
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
        // Prvo proveri da li tabela postoji
        const [tables] = await connection.execute(
          "SHOW TABLES LIKE 'timetable_dates'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "timetable_dates" ne postoji u legacy bazi - preskačem sinhronizaciju',
          );
          return {
            success: true,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
            totalProcessed: 0,
            message:
              'Tabela "timetable_dates" ne postoji u legacy bazi - nije bilo šta da se sinhronizuje',
          };
        }

        // Učitaj sve rekorde iz legacy tabele
        const [rows] = await connection.execute(
          'SELECT * FROM timetable_dates ORDER BY id ASC',
        );

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} records in legacy database`);

        // Procesiraj u batch-ovima od 50 rekorda
        const BATCH_SIZE = 50;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          for (const legacyRecord of batch) {
            try {
              const result =
                await this.processTimetableDateSyncFromCity(legacyRecord);

              switch (result.action) {
                case 'create':
                  created++;
                  break;
                case 'update':
                  updated++;
                  break;
                case 'skip':
                  skipped++;
                  break;
              }
            } catch (error) {
              errors++;
              console.error(
                `❌ Error processing record ID ${legacyRecord.id}:`,
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
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return {
        success: true,
        created,
        updated,
        skipped,
        errors,
        totalProcessed,
        message: `Sinhronizacija završena: ${created} kreirano, ${updated} ažurirano, ${skipped} preskočeno${errors > 0 ? `, ${errors} grešaka` : ''}`,
      };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji: ${error.message}`,
      );
    }
  }

  // ========== HELPER METODE ==========

  private async processTimetableDateSyncFromTicketing(legacyRecord: any) {
    const legacyId = BigInt(legacyRecord.id);

    // Proveri da li rekord već postoji na osnovu legacyTicketingId
    const existingRecord = await this.prisma.timetableDate.findUnique({
      where: { legacyTicketingId: legacyId },
    });

    // Mapiraj legacy podatke
    const mappedData = this.mapLegacyTimetableDate(legacyRecord);

    if (!existingRecord) {
      // CREATE - novi rekord
      await this.prisma.timetableDate.create({
        data: {
          ...mappedData,
          legacyTicketingId: legacyId,
        },
      });

      return { action: 'create' };
    } else {
      // UPDATE - ažuriraj postojeći rekord
      await this.prisma.timetableDate.update({
        where: { id: existingRecord.id },
        data: {
          ...mappedData,
          legacyTicketingId: legacyId,
        },
      });

      return { action: 'update' };
    }
  }

  private async processTimetableDateSyncFromCity(legacyRecord: any) {
    const legacyId = BigInt(legacyRecord.id);

    // Proveri da li rekord već postoji na osnovu legacyCityId
    const existingRecord = await this.prisma.timetableDate.findUnique({
      where: { legacyCityId: legacyId },
    });

    // Mapiraj legacy podatke
    const mappedData = this.mapLegacyTimetableDate(legacyRecord);

    if (!existingRecord) {
      // CREATE - novi rekord
      await this.prisma.timetableDate.create({
        data: {
          ...mappedData,
          legacyCityId: legacyId,
        },
      });

      return { action: 'create' };
    } else {
      // UPDATE - ažuriraj postojeći rekord
      await this.prisma.timetableDate.update({
        where: { id: existingRecord.id },
        data: {
          ...mappedData,
          legacyCityId: legacyId,
        },
      });

      return { action: 'update' };
    }
  }

  private mapLegacyTimetableDate(legacy: any) {
    // Helper za parsiranje datuma
    const parseDate = (value: any): Date => {
      if (!value) return new Date();
      const date = new Date(value);
      return isNaN(date.getTime()) ? new Date() : date;
    };

    // Helper za formatiranje datuma kao string (YYYY-MM-DD)
    const formatDateString = (value: any): string => {
      if (!value) return new Date().toISOString().split('T')[0];
      const date = new Date(value);
      if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
      return date.toISOString().split('T')[0];
    };

    // Legacy tabela ima: datum, kad, timetable_name, date_valid_to, changed_by (INT)
    // NEMA: status, synchro_status, send_incremental - postavi default vrednosti
    return {
      dateValidFrom: formatDateString(legacy.datum),
      dateValidTo: legacy.date_valid_to ? formatDateString(legacy.date_valid_to) : null,
      status: 'N', // Default vrednost - ne postoji u legacy tabeli
      synchroStatus: 'N', // Default vrednost - ne postoji u legacy tabeli
      sendIncremental: '0', // Default vrednost - ne postoji u legacy tabeli
      changedBy: legacy.changed_by?.toString() || 'legacy_sync', // INT u legacy, VARCHAR u našoj bazi
      dateTime: parseDate(legacy.kad),
      name: legacy.timetable_name || '',
    };
  }

  private async findAllFromLegacy(subtype: string) {
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
        // Prvo proveri da li tabela postoji
        const [tables] = await connection.execute(
          "SHOW TABLES LIKE 'timetable_dates'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            `⚠️ Tabela 'timetable_dates' ne postoji u legacy bazi (${subtype})`,
          );
          // Vrati prazan niz umesto greške
          return [];
        }

        // Učitaj sve timetable_dates iz legacy baze
        // Legacy struktura: datum, kad, id, timetable_name, date_valid_to, changed_by
        const [rows] = await connection.execute(
          'SELECT id, DATE_FORMAT(datum, "%Y-%m-%d") as date_valid_from, timetable_name as name, DATE_FORMAT(date_valid_to, "%Y-%m-%d") as date_valid_to, changed_by, kad as date_time FROM timetable_dates ORDER BY id DESC',
        );

        return rows;
      } finally {
        // Uvek zatvori konekciju
        await connection.end();
      }
    } catch (error) {
      console.error(
        `Greška pri učitavanju iz legacy baze (${subtype}):`,
        error,
      );
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }
}
