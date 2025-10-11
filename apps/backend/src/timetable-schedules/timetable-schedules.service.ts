import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { createConnection } from 'mysql2/promise';
import {
  MainScheduleLineDto,
  MainSchedulesResponseDto,
} from './dto/main-schedules-response.dto';

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
}

@Injectable()
export class TimetableSchedulesService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  // ========== GLAVNI SERVER (LOKALNI MYSQL) ==========

  async findAllMain(dateValidFrom?: string): Promise<MainSchedulesResponseDto> {
    try {
      // Ako nije prosleđen dateValidFrom, uzmi prvi aktivan price_table_group
      if (!dateValidFrom) {
        const activeGroup = await this.prisma.$queryRaw<any[]>`
          SELECT date_valid_from
          FROM price_table_groups
          WHERE status = 'A'
          ORDER BY date_valid_from DESC
          LIMIT 1
        `;

        if (activeGroup.length === 0) {
          return { data: [], total: 0 };
        }

        // Format date to YYYY-MM-DD (koristimo lokalno vreme, ne UTC!)
        const dateObj =
          activeGroup[0].date_valid_from instanceof Date
            ? activeGroup[0].date_valid_from
            : new Date(activeGroup[0].date_valid_from);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        dateValidFrom = `${year}-${month}-${day}`;
      }

      // Query: Get all lines for the selected date_valid_from with statistics
      const linesWithStats = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          l.price_table_ident as priceTableIdent,
          l.line_number as lineNumber,
          l.line_number_for_display as lineNumberForDisplay,
          l.line_title as lineTitle,
          l.direction_id_for_display as direction,
          l.line_type as lineType,
          COUNT(vp.id) as totalSchedules,
          SUM(CASE WHEN vp.legacy_ticketing_id IS NOT NULL THEN 1 ELSE 0 END) as legacyTicketingCount,
          SUM(CASE WHEN vp.legacy_city_id IS NOT NULL THEN 1 ELSE 0 END) as legacyCityCount
        FROM \`lines\` l
        LEFT JOIN vremena_polaska vp
          ON vp.idlinije = l.price_table_ident
          AND vp.datum = ?
        WHERE l.date_valid_from = ?
        GROUP BY l.id, l.price_table_ident, l.line_number, l.line_number_for_display, l.line_title, l.direction_id_for_display, l.line_type
        HAVING totalSchedules > 0
        ORDER BY l.line_number_for_display
        `,
        dateValidFrom,
        dateValidFrom,
      );

      // Convert BigInt to Number and map to DTO
      const data: MainScheduleLineDto[] = linesWithStats.map((line) => ({
        priceTableIdent: line.priceTableIdent,
        lineNumber: line.lineNumber,
        lineNumberForDisplay: line.lineNumberForDisplay,
        lineTitle: line.lineTitle,
        direction: line.direction || '',
        lineType: line.lineType || '',
        totalSchedules: Number(line.totalSchedules) || 0,
        hasTicketingData: Number(line.legacyTicketingCount) > 0,
        hasCityData: Number(line.legacyCityCount) > 0,
        legacyTicketingCount: Number(line.legacyTicketingCount) || 0,
        legacyCityCount: Number(line.legacyCityCount) || 0,
      }));

      return {
        data,
        total: data.length,
      };
    } catch (error) {
      console.error('Greška pri učitavanju glavnih podataka:', error);
      throw new InternalServerErrorException(
        `Greška pri učitavanju glavnih podataka: ${error.message}`,
      );
    }
  }

  // ========== TIKETING SERVER (LEGACY BAZA) ==========

  async findAllVremenaPolaskaTicketing(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ) {
    return this.findAllVremenaPolaskaFromLegacy(
      'main_ticketing_database',
      dateValidFrom,
      page,
      limit,
    );
  }

  async findAllVremenaPolaskaStTicketing(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ) {
    return this.findAllVremenaPolaskaStFromLegacy(
      'main_ticketing_database',
      dateValidFrom,
      page,
      limit,
    );
  }

  // ========== GRADSKI SERVER (LEGACY BAZA) ==========

  async findAllVremenaPolaskaCity(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ) {
    return this.findAllVremenaPolaskaFromLegacy(
      'city_ticketing_database',
      dateValidFrom,
      page,
      limit,
    );
  }

  async findAllVremenaPolaskaStCity(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ) {
    return this.findAllVremenaPolaskaStFromLegacy(
      'city_ticketing_database',
      dateValidFrom,
      page,
      limit,
    );
  }

  // ========== SINHRONIZACIJA ==========

  async syncAllFromTicketing(dateValidFrom: string, userId: number) {
    console.log(
      `🔄 Starting Ticketing Server sync for timetable schedules (${dateValidFrom})...`,
    );
    const overallStartTime = Date.now();

    // PRVO: Sinhronizuj vremena_polaska
    console.log('📋 Step 1/2: Syncing vremena_polaska...');
    const vremenaPolaskaResult =
      await this.syncVremenaPolaskaFromTicketing(dateValidFrom);

    // ZATIM: Sinhronizuj vremena_polaska_st
    console.log('📋 Step 2/2: Syncing vremena_polaska_st...');
    const vremenaPolaskaStResult =
      await this.syncVremenaPolaskaStFromTicketing(dateValidFrom);

    const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(2);
    console.log(`✅ Complete sync finished in ${totalDuration}s`);

    return {
      success: true,
      vremenaPolaska: vremenaPolaskaResult,
      vremenaPolaskaSt: vremenaPolaskaStResult,
      totalProcessed:
        vremenaPolaskaResult.totalProcessed +
        vremenaPolaskaStResult.totalProcessed,
      message: `Sinhronizacija završena: vremena_polaska (${vremenaPolaskaResult.created}/${vremenaPolaskaResult.updated}/${vremenaPolaskaResult.skipped}), vremena_polaska_st (${vremenaPolaskaStResult.created}/${vremenaPolaskaStResult.updated}/${vremenaPolaskaStResult.skipped})`,
    };
  }

  async syncAllFromCity(dateValidFrom: string, userId: number) {
    console.log(
      `🔄 Starting City Server sync for timetable schedules (${dateValidFrom})...`,
    );
    const overallStartTime = Date.now();

    // PRVO: Sinhronizuj vremena_polaska
    console.log('📋 Step 1/2: Syncing vremena_polaska...');
    const vremenaPolaskaResult =
      await this.syncVremenaPolaskaFromCity(dateValidFrom);

    // ZATIM: Sinhronizuj vremena_polaska_st
    console.log('📋 Step 2/2: Syncing vremena_polaska_st...');
    const vremenaPolaskaStResult =
      await this.syncVremenaPolaskaStFromCity(dateValidFrom);

    const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(2);
    console.log(`✅ Complete sync finished in ${totalDuration}s`);

    return {
      success: true,
      vremenaPolaska: vremenaPolaskaResult,
      vremenaPolaskaSt: vremenaPolaskaStResult,
      totalProcessed:
        vremenaPolaskaResult.totalProcessed +
        vremenaPolaskaStResult.totalProcessed,
      message: `Sinhronizacija završena: vremena_polaska (${vremenaPolaskaResult.created}/${vremenaPolaskaResult.updated}/${vremenaPolaskaResult.skipped}), vremena_polaska_st (${vremenaPolaskaStResult.created}/${vremenaPolaskaStResult.updated}/${vremenaPolaskaStResult.skipped})`,
    };
  }

  // ========== VREMENA_POLASKA SYNC ==========

  private async syncVremenaPolaskaFromTicketing(
    dateValidFrom: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      // PRVO: Učitaj linije iz naše baze koje imaju ovaj dateValidFrom
      const ourLines = await this.prisma.line.findMany({
        where: { dateValidFrom },
        select: { priceTableIdent: true },
      });

      if (ourLines.length === 0) {
        console.warn(
          `⚠️ Nema linija u našoj bazi sa dateValidFrom = ${dateValidFrom}, preskačem sinhronizaciju`,
        );
        return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
      }

      const priceTableIdents = ourLines.map((l) => l.priceTableIdent);
      console.log(
        `📊 Pronađeno ${priceTableIdents.length} linija za sinhronizaciju vremena_polaska`,
      );

      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'main_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna Ticketing Baza" nije pronađena',
        );
      }

      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        // Proveri da li tabela postoji
        const [tables] = await connection.execute(
          "SHOW TABLES LIKE 'vremena_polaska'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "vremena_polaska" ne postoji u legacy bazi',
          );
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        // NOVO: Učitaj samo rekorde za naše linije (JOIN pristup)
        const placeholders = priceTableIdents.map(() => '?').join(',');
        const query = `
          SELECT * FROM vremena_polaska
          WHERE idlinije IN (${placeholders}) AND datum = ?
          ORDER BY id ASC
        `;
        const [rows] = await connection.execute(query, [
          ...priceTableIdents,
          dateValidFrom,
        ]);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(
          `📊 Found ${totalProcessed} vremena_polaska records for ${priceTableIdents.length} lines and date ${dateValidFrom}`,
        );

        // BULK INSERT - mnogo brži pristup
        const BATCH_SIZE = 2000;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          try {
            const result = await this.bulkInsertVremenaPolaska(
              batch,
              'ticketing',
            );
            created += result.inserted;
            updated += result.updated;
          } catch (error) {
            errors += batch.length;
            console.error(
              `❌ Error processing batch starting at ${i}:`,
              error.message,
            );
          }

          const processed = Math.min(i + BATCH_SIZE, legacyRecords.length);
          console.log(
            `📈 Progress: ${processed}/${totalProcessed} (${Math.round((processed / totalProcessed) * 100)}%)`,
          );
        }
      } finally {
        await connection.end();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Vremena_polaska sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { created, updated, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Vremena_polaska sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji vremena_polaska: ${error.message}`,
      );
    }
  }

  private async syncVremenaPolaskaFromCity(
    dateValidFrom: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      // PRVO: Učitaj linije iz naše baze koje imaju ovaj dateValidFrom
      const ourLines = await this.prisma.line.findMany({
        where: { dateValidFrom },
        select: { priceTableIdent: true },
      });

      if (ourLines.length === 0) {
        console.warn(
          `⚠️ Nema linija u našoj bazi sa dateValidFrom = ${dateValidFrom}, preskačem sinhronizaciju`,
        );
        return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
      }

      const priceTableIdents = ourLines.map((l) => l.priceTableIdent);
      console.log(
        `📊 Pronađeno ${priceTableIdents.length} linija za sinhronizaciju vremena_polaska (City server)`,
      );

      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Gradska Ticketing Baza" nije pronađena',
        );
      }

      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        const [tables] = await connection.execute(
          "SHOW TABLES LIKE 'vremena_polaska'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "vremena_polaska" ne postoji u legacy bazi',
          );
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        // NOVO: Učitaj samo rekorde za naše linije (JOIN pristup)
        const placeholders = priceTableIdents.map(() => '?').join(',');
        const query = `
          SELECT * FROM vremena_polaska
          WHERE idlinije IN (${placeholders}) AND datum = ?
          ORDER BY id ASC
        `;
        const [rows] = await connection.execute(query, [
          ...priceTableIdents,
          dateValidFrom,
        ]);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(
          `📊 Found ${totalProcessed} vremena_polaska records for ${priceTableIdents.length} lines and date ${dateValidFrom} (City server)`,
        );

        // BULK INSERT - mnogo brži pristup
        const BATCH_SIZE = 2000;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          try {
            const result = await this.bulkInsertVremenaPolaska(batch, 'city');
            created += result.inserted;
            updated += result.updated;
          } catch (error) {
            errors += batch.length;
            console.error(
              `❌ Error processing batch starting at ${i}:`,
              error.message,
            );
          }

          const processed = Math.min(i + BATCH_SIZE, legacyRecords.length);
          console.log(
            `📈 Progress: ${processed}/${totalProcessed} (${Math.round((processed / totalProcessed) * 100)}%)`,
          );
        }
      } finally {
        await connection.end();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Vremena_polaska sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { created, updated, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Vremena_polaska sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji vremena_polaska: ${error.message}`,
      );
    }
  }

  // ========== VREMENA_POLASKA_ST SYNC ==========

  private async syncVremenaPolaskaStFromTicketing(
    dateValidFrom: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      // PRVO: Učitaj linije iz naše baze koje imaju ovaj dateValidFrom
      const ourLines = await this.prisma.line.findMany({
        where: { dateValidFrom },
        select: { priceTableIdent: true },
      });

      if (ourLines.length === 0) {
        console.warn(
          `⚠️ Nema linija u našoj bazi sa dateValidFrom = ${dateValidFrom}, preskačem sinhronizaciju`,
        );
        return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
      }

      const priceTableIdents = ourLines.map((l) => l.priceTableIdent);
      console.log(
        `📊 Pronađeno ${priceTableIdents.length} linija za sinhronizaciju vremena_polaska_st`,
      );

      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'main_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna Ticketing Baza" nije pronađena',
        );
      }

      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        const [tables] = await connection.execute(
          "SHOW TABLES LIKE 'vremena_polaska_st'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "vremena_polaska_st" ne postoji u legacy bazi',
          );
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        // NOVO: Učitaj samo rekorde za naše linije (JOIN pristup)
        const placeholders = priceTableIdents.map(() => '?').join(',');
        const query = `
          SELECT * FROM vremena_polaska_st
          WHERE idlinije IN (${placeholders}) AND datum = ?
          ORDER BY id ASC
        `;
        const [rows] = await connection.execute(query, [
          ...priceTableIdents,
          dateValidFrom,
        ]);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(
          `📊 Found ${totalProcessed} vremena_polaska_st records for ${priceTableIdents.length} lines and date ${dateValidFrom}`,
        );

        // BULK INSERT - mnogo brži pristup
        const BATCH_SIZE = 2000;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          try {
            const result = await this.bulkInsertVremenaPolaskaSt(
              batch,
              'ticketing',
            );
            created += result.inserted;
            updated += result.updated;
          } catch (error) {
            errors += batch.length;
            console.error(
              `❌ Error processing batch starting at ${i}:`,
              error.message,
            );
          }

          const processed = Math.min(i + BATCH_SIZE, legacyRecords.length);
          console.log(
            `📈 Progress: ${processed}/${totalProcessed} (${Math.round((processed / totalProcessed) * 100)}%)`,
          );
        }
      } finally {
        await connection.end();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Vremena_polaska_st sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { created, updated, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Vremena_polaska_st sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji vremena_polaska_st: ${error.message}`,
      );
    }
  }

  private async syncVremenaPolaskaStFromCity(
    dateValidFrom: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      // PRVO: Učitaj linije iz naše baze koje imaju ovaj dateValidFrom
      const ourLines = await this.prisma.line.findMany({
        where: { dateValidFrom },
        select: { priceTableIdent: true },
      });

      if (ourLines.length === 0) {
        console.warn(
          `⚠️ Nema linija u našoj bazi sa dateValidFrom = ${dateValidFrom}, preskačem sinhronizaciju`,
        );
        return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
      }

      const priceTableIdents = ourLines.map((l) => l.priceTableIdent);
      console.log(
        `📊 Pronađeno ${priceTableIdents.length} linija za sinhronizaciju vremena_polaska_st (City server)`,
      );

      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Gradska Ticketing Baza" nije pronađena',
        );
      }

      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        const [tables] = await connection.execute(
          "SHOW TABLES LIKE 'vremena_polaska_st'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "vremena_polaska_st" ne postoji u legacy bazi',
          );
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        // NOVO: Učitaj samo rekorde za naše linije (JOIN pristup)
        const placeholders = priceTableIdents.map(() => '?').join(',');
        const query = `
          SELECT * FROM vremena_polaska_st
          WHERE idlinije IN (${placeholders}) AND datum = ?
          ORDER BY id ASC
        `;
        const [rows] = await connection.execute(query, [
          ...priceTableIdents,
          dateValidFrom,
        ]);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(
          `📊 Found ${totalProcessed} vremena_polaska_st records for ${priceTableIdents.length} lines and date ${dateValidFrom} (City server)`,
        );

        // BULK INSERT - mnogo brži pristup
        const BATCH_SIZE = 2000;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          try {
            const result = await this.bulkInsertVremenaPolaskaSt(batch, 'city');
            created += result.inserted;
            updated += result.updated;
          } catch (error) {
            errors += batch.length;
            console.error(
              `❌ Error processing batch starting at ${i}:`,
              error.message,
            );
          }

          const processed = Math.min(i + BATCH_SIZE, legacyRecords.length);
          console.log(
            `📈 Progress: ${processed}/${totalProcessed} (${Math.round((processed / totalProcessed) * 100)}%)`,
          );
        }
      } finally {
        await connection.end();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Vremena_polaska_st sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { created, updated, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Vremena_polaska_st sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji vremena_polaska_st: ${error.message}`,
      );
    }
  }

  // ========== HELPER METODE ==========

  /**
   * Bulk insert za vremena_polaska tabelu (mnogo brže od pojedinačnih insert-ova)
   */
  private async bulkInsertVremenaPolaska(
    records: any[],
    source: 'ticketing' | 'city',
  ): Promise<{ inserted: number; updated: number }> {
    if (records.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    // Map legacy records to our format
    const mappedRecords = records.map((r) =>
      this.mapLegacyVremenaPolaska(r, source),
    );

    // Build VALUES string for bulk insert
    const values = mappedRecords
      .map((r) => {
        const datum = this.formatDateForSQL(r.datum);
        const datetimeFrom = this.formatDateTimeForSQL(r.datetimeFrom);
        const datetimeTo = this.formatDateTimeForSQL(r.datetimeTo);
        const legacyId =
          source === 'ticketing' ? r.legacyTicketingId : r.legacyCityId;

        return `(
          ${this.escapeSQLValue(datum)},
          ${this.escapeSQLValue(r.idlinije)},
          ${r.smer},
          ${this.escapeSQLValue(r.pon)},
          ${this.escapeSQLValue(r.uto)},
          ${this.escapeSQLValue(r.sre)},
          ${this.escapeSQLValue(r.cet)},
          ${this.escapeSQLValue(r.pet)},
          ${this.escapeSQLValue(r.sub)},
          ${this.escapeSQLValue(r.ned)},
          ${this.escapeSQLValue(r.dk1)},
          ${this.escapeSQLValue(r.dk1naziv)},
          ${this.escapeSQLValue(r.dk2)},
          ${this.escapeSQLValue(r.dk2naziv)},
          ${this.escapeSQLValue(r.dk3)},
          ${this.escapeSQLValue(r.dk3naziv)},
          ${this.escapeSQLValue(r.dk4)},
          ${this.escapeSQLValue(r.dk4naziv)},
          ${r.variation},
          ${this.escapeSQLValue(datetimeFrom)},
          ${this.escapeSQLValue(datetimeTo)},
          ${this.escapeSQLValue(r.variationDescription)},
          ${source === 'ticketing' ? legacyId : 'NULL'},
          ${source === 'city' ? legacyId : 'NULL'}
        )`;
      })
      .join(',\n');

    const insertSQL = `
      INSERT INTO vremena_polaska (
        datum, idlinije, smer, pon, uto, sre, cet, pet, sub, ned,
        dk1, dk1naziv, dk2, dk2naziv, dk3, dk3naziv, dk4, dk4naziv,
        variation, datetime_from, datetime_to, variation_description,
        legacy_ticketing_id, legacy_city_id
      ) VALUES ${values}
      ON DUPLICATE KEY UPDATE
        pon = VALUES(pon),
        uto = VALUES(uto),
        sre = VALUES(sre),
        cet = VALUES(cet),
        pet = VALUES(pet),
        sub = VALUES(sub),
        ned = VALUES(ned),
        dk1 = VALUES(dk1),
        dk1naziv = VALUES(dk1naziv),
        dk2 = VALUES(dk2),
        dk2naziv = VALUES(dk2naziv),
        dk3 = VALUES(dk3),
        dk3naziv = VALUES(dk3naziv),
        dk4 = VALUES(dk4),
        dk4naziv = VALUES(dk4naziv),
        variation = VALUES(variation),
        datetime_to = VALUES(datetime_to),
        variation_description = VALUES(variation_description),
        updated_at = NOW()
    `;

    const result = await this.prisma.$executeRawUnsafe(insertSQL);

    // MySQL vraća broj affected rows (insert + update)
    // Za sada vraćamo kao inserted (jer ne možemo razlikovati)
    return { inserted: result as number, updated: 0 };
  }

  /**
   * Bulk insert za vremena_polaska_st tabelu (mnogo brže od pojedinačnih insert-ova)
   */
  private async bulkInsertVremenaPolaskaSt(
    records: any[],
    source: 'ticketing' | 'city',
  ): Promise<{ inserted: number; updated: number }> {
    if (records.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    // Map legacy records to our format
    const mappedRecords = records.map((r) =>
      this.mapLegacyVremenaPolaskaSt(r, source),
    );

    // Build VALUES string for bulk insert
    const values = mappedRecords
      .map((r) => {
        const datum = this.formatDateForSQL(r.datum);
        const legacyId =
          source === 'ticketing' ? r.legacyTicketingId : r.legacyCityId;

        return `(
          ${this.escapeSQLValue(datum)},
          ${this.escapeSQLValue(r.idlinije)},
          ${r.smer},
          ${this.escapeSQLValue(r.dan)},
          ${this.escapeSQLValue(r.vreme)},
          ${this.escapeSQLValue(r.stanice)},
          ${this.escapeSQLValue(r.opis)},
          ${r.centralPoint},
          ${this.escapeSQLValue(r.pauza)},
          ${this.escapeSQLValue(r.defaultTimes)},
          ${r.dayBefore},
          ${this.escapeSQLValue(r.defaultPeron)},
          ${r.numDepartures},
          ${r.defaultNumSeats},
          ${r.timetableShortCommentsId},
          ${r.vehicleChassisTypesId},
          ${this.escapeSQLValue(r.gtfsTripId)},
          ${this.escapeSQLValue(r.serviceId)},
          ${r.notOfficial},
          ${r.compCode},
          ${r.vehicleGroupTypesId},
          ${r.turageNo},
          ${r.departureNoInTurage},
          ${source === 'ticketing' ? legacyId : 'NULL'},
          ${source === 'city' ? legacyId : 'NULL'}
        )`;
      })
      .join(',\n');

    const insertSQL = `
      INSERT INTO vremena_polaska_st (
        datum, idlinije, smer, dan, vreme, stanice, opis, central_point,
        pauza, default_times, day_before, default_peron, num_departures,
        default_num_seats, timetable_short_comments_id, vehicle_chassis_types_id,
        gtfs_trip_id, service_id, not_official, comp_code, vehicle_group_types_id,
        turage_no, departure_no_in_turage, legacy_ticketing_id, legacy_city_id
      ) VALUES ${values}
      ON DUPLICATE KEY UPDATE
        datum = VALUES(datum),
        stanice = VALUES(stanice),
        opis = VALUES(opis),
        pauza = VALUES(pauza),
        default_times = VALUES(default_times),
        day_before = VALUES(day_before),
        default_peron = VALUES(default_peron),
        num_departures = VALUES(num_departures),
        default_num_seats = VALUES(default_num_seats),
        timetable_short_comments_id = VALUES(timetable_short_comments_id),
        vehicle_chassis_types_id = VALUES(vehicle_chassis_types_id),
        gtfs_trip_id = VALUES(gtfs_trip_id),
        service_id = VALUES(service_id),
        not_official = VALUES(not_official),
        comp_code = VALUES(comp_code),
        vehicle_group_types_id = VALUES(vehicle_group_types_id),
        turage_no = VALUES(turage_no),
        departure_no_in_turage = VALUES(departure_no_in_turage),
        updated_at = NOW()
    `;

    const result = await this.prisma.$executeRawUnsafe(insertSQL);

    // MySQL vraća broj affected rows (insert + update)
    return { inserted: result as number, updated: 0 };
  }

  /**
   * Escape SQL string values
   */
  private escapeSQLValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    // Escape single quotes and backslashes
    const escaped = value
      .toString()
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  /**
   * Format Date for SQL (YYYY-MM-DD)
   */
  private formatDateForSQL(date: Date | null): string {
    if (!date) return '0000-00-00';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format DateTime for SQL (YYYY-MM-DD HH:MM:SS)
   */
  private formatDateTimeForSQL(date: Date | null): string {
    if (!date) return '0000-00-00 00:00:00';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private async processVremenaPolaskaSync(legacyRecord: any, source: 'ticketing' | 'city') {
    // Unique constraint: [datum, idlinije, smer, datetimeFrom]
    const datum = this.parseDate(legacyRecord.datum) || new Date();
    const idlinije = legacyRecord.idlinije;
    const smer = legacyRecord.smer;
    const datetimeFrom = this.parseDate(legacyRecord.datetime_from) || new Date();

    const existingRecord = await this.prisma.vremenaPolaska.findFirst({
      where: {
        datum,
        idlinije,
        smer,
        datetimeFrom,
      },
    });

    const mappedData = this.mapLegacyVremenaPolaska(legacyRecord, source);

    if (!existingRecord) {
      await this.prisma.vremenaPolaska.create({
        data: mappedData,
      });
      return { action: 'create' };
    } else {
      await this.prisma.vremenaPolaska.update({
        where: { id: existingRecord.id },
        data: mappedData,
      });
      return { action: 'update' };
    }
  }

  private async processVremenaPolaskaStSync(legacyRecord: any, source: 'ticketing' | 'city') {
    // Unique constraint: [idlinije, smer, dan, vreme, centralPoint]
    const idlinije = legacyRecord.idlinije;
    const smer = legacyRecord.smer;
    const dan = legacyRecord.dan;
    const vreme = legacyRecord.vreme;
    const centralPoint = legacyRecord.central_point;

    const existingRecord = await this.prisma.vremenaPolaskaSt.findFirst({
      where: {
        idlinije,
        smer,
        dan,
        vreme,
        centralPoint,
      },
    });

    const mappedData = this.mapLegacyVremenaPolaskaSt(legacyRecord, source);

    if (!existingRecord) {
      await this.prisma.vremenaPolaskaSt.create({
        data: mappedData,
      });
      return { action: 'create' };
    } else {
      await this.prisma.vremenaPolaskaSt.update({
        where: { id: existingRecord.id },
        data: mappedData,
      });
      return { action: 'update' };
    }
  }

  private mapLegacyVremenaPolaska(legacy: any, source: 'ticketing' | 'city') {
    const datum = this.parseDate(legacy.datum);
    const datetimeFrom = this.parseDate(legacy.datetime_from);
    const datetimeTo = this.parseDate(legacy.datetime_to);

    return {
      datum: datum || new Date(),
      idlinije: legacy.idlinije || '',
      smer: legacy.smer || 0,
      pon: legacy.pon || '',
      uto: legacy.uto || '',
      sre: legacy.sre || '',
      cet: legacy.cet || '',
      pet: legacy.pet || '',
      sub: legacy.sub || '',
      ned: legacy.ned || '',
      dk1: legacy.dk1 || '',
      dk1naziv: legacy.dk1naziv || '',
      dk2: legacy.dk2 || '',
      dk2naziv: legacy.dk2naziv || '',
      dk3: legacy.dk3 || '',
      dk3naziv: legacy.dk3naziv || '',
      dk4: legacy.dk4 || '',
      dk4naziv: legacy.dk4naziv || '',
      variation: legacy.variation || 0,
      datetimeFrom: datetimeFrom || new Date(),
      datetimeTo: datetimeTo || new Date(),
      variationDescription: legacy.variation_description || '',
      legacyTicketingId: source === 'ticketing' ? BigInt(legacy.id) : undefined,
      legacyCityId: source === 'city' ? BigInt(legacy.id) : undefined,
    };
  }

  private mapLegacyVremenaPolaskaSt(legacy: any, source: 'ticketing' | 'city') {
    const datum = this.parseDate(legacy.datum);

    return {
      datum: datum || new Date(),
      idlinije: legacy.idlinije || '',
      smer: legacy.smer || 0,
      dan: legacy.dan || '',
      vreme: legacy.vreme || '',
      stanice: legacy.stanice || '',
      opis: legacy.opis || '',
      centralPoint: legacy.central_point || 0,
      pauza: legacy.pauza || '',
      defaultTimes: legacy.default_times || '',
      dayBefore: legacy.day_before || 0,
      defaultPeron: legacy.default_peron || '',
      numDepartures: legacy.num_departures || 1,
      defaultNumSeats: legacy.default_num_seats || 57,
      timetableShortCommentsId: legacy.timetable_short_comments_id || 0,
      vehicleChassisTypesId: legacy.vehicle_chassis_types_id || 0,
      gtfsTripId: legacy.gtfs_trip_id || '',
      serviceId: legacy.service_id || '',
      notOfficial: legacy.not_official || 0,
      compCode: legacy.comp_code || 0,
      vehicleGroupTypesId: legacy.vehicle_group_types_id || 0,
      turageNo: legacy.turage_no || 0,
      departureNoInTurage: legacy.departure_no_in_turage || 0,
      legacyTicketingId: source === 'ticketing' ? BigInt(legacy.id) : undefined,
      legacyCityId: source === 'city' ? BigInt(legacy.id) : undefined,
    };
  }

  private parseDate(value: any): Date | null {
    if (!value || value === '0000-00-00' || value === '0000-00-00 00:00:00')
      return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  private formatDateString(value: any): string {
    if (!value) return new Date().toISOString().split('T')[0];

    // Ako je već string u YYYY-MM-DD formatu, vrati direktno
    const strValue = value.toString().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
      return strValue;
    }

    // Ako je Date objekat, ekstraktuj komponente lokalno (bez UTC konverzije)
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Fallback: pokušaj parsiranje
    const date = new Date(value);
    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];

    // Ekstraktuj komponente lokalno (bez UTC konverzije)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ========== HELPER METODE ZA LEGACY READ ==========

  private async findAllVremenaPolaskaFromLegacy(
    subtype: string,
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ) {
    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          `Legacy baza sa subtype "${subtype}" nije pronađena`,
        );
      }

      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        const offset = (page - 1) * limit;

        const whereClauses: string[] = [];
        const params: any[] = [];

        if (dateValidFrom) {
          whereClauses.push('datum = ?');
          params.push(dateValidFrom);
        }

        const whereClause =
          whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM vremena_polaska ${whereClause}`;
        const [countRows] = await connection.execute(countQuery, params);
        const total = (countRows as any)[0].total;

        // Get paginated data
        const dataQuery = `SELECT * FROM vremena_polaska ${whereClause} ORDER BY id ASC LIMIT ? OFFSET ?`;
        const [rows] = await connection.execute(dataQuery, [
          ...params,
          limit,
          offset,
        ]);

        return {
          data: rows,
          total,
          page,
          limit,
        };
      } finally {
        await connection.end();
      }
    } catch (error) {
      console.error(
        `Greška pri učitavanju vremena_polaska iz legacy baze (${subtype}):`,
        error,
      );
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }

  private async findAllVremenaPolaskaStFromLegacy(
    subtype: string,
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ) {
    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          `Legacy baza sa subtype "${subtype}" nije pronađena`,
        );
      }

      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        const offset = (page - 1) * limit;

        const whereClauses: string[] = [];
        const params: any[] = [];

        if (dateValidFrom) {
          whereClauses.push('datum = ?');
          params.push(dateValidFrom);
        }

        const whereClause =
          whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM vremena_polaska_st ${whereClause}`;
        const [countRows] = await connection.execute(countQuery, params);
        const total = (countRows as any)[0].total;

        // Get paginated data
        const dataQuery = `SELECT * FROM vremena_polaska_st ${whereClause} ORDER BY id ASC LIMIT ? OFFSET ?`;
        const [rows] = await connection.execute(dataQuery, [
          ...params,
          limit,
          offset,
        ]);

        return {
          data: rows,
          total,
          page,
          limit,
        };
      } finally {
        await connection.end();
      }
    } catch (error) {
      console.error(
        `Greška pri učitavanju vremena_polaska_st iz legacy baze (${subtype}):`,
        error,
      );
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }
}
