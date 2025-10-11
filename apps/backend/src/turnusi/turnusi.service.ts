import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { createConnection } from 'mysql2/promise';
import { Prisma } from '@prisma/client';

export interface SyncResult {
  deleted: number;
  created: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
}

@Injectable()
export class TurnusiService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  // ========== TIKETING SERVER (LEGACY BAZA) ==========

  async getAllGroupsTicketing() {
    try {
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
        const [rows] = await connection.execute(
          'SELECT * FROM turnus_groups_names ORDER BY id ASC',
        );
        return rows;
      } finally {
        await connection.end();
      }
    } catch (error) {
      console.error('Greška pri učitavanju grupa turnusa:', error);
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }

  async getAllChangesCodesTicketing(groupId?: number, page = 1, limit = 50) {
    try {
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
        const offset = (page - 1) * limit;

        // Prvo dohvatimo turnus_name iz turnus_groups_assign za odabranu grupu
        let query = `SELECT cct.* FROM changes_codes_tours cct`;
        const params: any[] = [];

        if (groupId) {
          query += `
            INNER JOIN turnus_groups_assign tga
              ON cct.turnus_name = (SELECT DISTINCT turnus_name
                                    FROM changes_codes_tours
                                    WHERE turnus_id = tga.turnus_id
                                    LIMIT 1)
            WHERE tga.group_id = ?`;
          params.push(groupId);
        }

        // Get total count
        const countQuery = query.replace(
          'SELECT cct.*',
          'SELECT COUNT(*) as total',
        );
        const [countRows] = await connection.execute(countQuery, params);
        const total = (countRows as any)[0].total;

        // Get paginated data
        const dataQuery = `${query} ORDER BY cct.turnus_id ASC, cct.start_time ASC LIMIT ? OFFSET ?`;
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
      console.error('Greška pri učitavanju changes_codes_tours:', error);
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }

  // ========== LOCAL DATABASE METHODS ==========

  async getTurnusiByLineNumber(lineNumber: string) {
    try {
      const turnusi = await this.prisma.changesCodesTours.findMany({
        where: {
          lineNo: lineNumber,
        },
        orderBy: [
          { turnusId: 'asc' },
          { startTime: 'asc' },
        ],
      });

      return {
        data: turnusi,
        total: turnusi.length,
        lineNumber,
      };
    } catch (error) {
      console.error(
        `Greška pri učitavanju turnusa za liniju ${lineNumber}:`,
        error,
      );
      throw new InternalServerErrorException(
        `Greška pri učitavanju turnusa: ${error.message}`,
      );
    }
  }

  async getTurnusiGroupedByLineNumber(lineNumber: string) {
    try {
      // Fetch all turnusi for the line and all its direction variants (e.g., 5135, 5135A, 5135B)
      const turnusi = await this.prisma.changesCodesTours.findMany({
        where: {
          lineNo: {
            startsWith: lineNumber,
          },
        },
        orderBy: [
          { turnusId: 'asc' },
          { shiftNumber: 'asc' },
          { departureNoInTurage: 'asc' },
        ],
      });

      if (turnusi.length === 0) {
        return {
          grouped: [],
          total: 0,
          lineNumber,
        };
      }

      // Extract unique base line numbers (strip direction suffix like "B" from "5135B")
      const uniqueLineNumbers = Array.from(
        new Set(
          turnusi.map((t) => {
            // Remove any letter suffix (A, B, C, etc.)
            return t.lineNo.replace(/[A-Z]+$/, '');
          })
        )
      );

      console.log(`📋 Found unique base line numbers:`, uniqueLineNumbers);

      // Fetch line info from lines table
      const lineInfos = await this.prisma.$queryRaw<any[]>`
        SELECT
          line_number as lineNumber,
          line_number_for_display as lineNumberForDisplay,
          line_title as lineTitle,
          line_title_for_display as lineTitleForDisplay
        FROM \`lines\`
        WHERE line_number IN (${Prisma.join(uniqueLineNumbers)})
      `;

      // Create map for quick lookup: lineNumber -> line info
      const lineInfoMap = new Map<string, any>();
      lineInfos.forEach((info) => {
        lineInfoMap.set(info.lineNumber, {
          lineNumberForDisplay: info.lineNumberForDisplay,
          lineTitle: info.lineTitle,
          lineTitleForDisplay: info.lineTitleForDisplay,
        });
      });

      console.log(`📊 Line info map:`, lineInfoMap);

      // Group by turnus_id
      const groupedMap = new Map<number, any>();

      turnusi.forEach((turnus) => {
        // Get base line number for this turnus
        const baseLineNo = turnus.lineNo.replace(/[A-Z]+$/, '');
        const lineInfo = lineInfoMap.get(baseLineNo) || {
          lineNumberForDisplay: turnus.lineNo,
          lineTitle: turnus.lineNo,
          lineTitleForDisplay: turnus.lineNo,
        };

        if (!groupedMap.has(turnus.turnusId)) {
          groupedMap.set(turnus.turnusId, {
            turnusId: turnus.turnusId,
            turnusName: turnus.turnusName,
            transportId: turnus.transportId,
            dayNumber: turnus.dayNumber,
            active: turnus.active,
            departureCount: 0,
            departures: [],
            firstDepartureTime: null,
            lastDepartureTime: null,
            linesServed: new Set(),
            shiftNumbers: new Set(),
            turageNumbers: new Set(),
          });
        }

        const group = groupedMap.get(turnus.turnusId);
        group.departureCount++;

        // Attach line info to departure record
        group.departures.push({
          ...turnus,
          lineNumberForDisplay: lineInfo.lineNumberForDisplay,
          lineTitle: lineInfo.lineTitle,
          lineTitleForDisplay: lineInfo.lineTitleForDisplay,
        });

        // Track lines - line_no already contains direction info (e.g., "5135" and "5135B")
        group.linesServed.add(turnus.lineNo);
        group.shiftNumbers.add(turnus.shiftNumber);
        group.turageNumbers.add(turnus.turageNo);

        // Calculate first and last departure time
        const startTime = new Date(turnus.startTime);
        if (!group.firstDepartureTime || startTime < group.firstDepartureTime) {
          group.firstDepartureTime = startTime;
        }
        if (!group.lastDepartureTime || startTime > group.lastDepartureTime) {
          group.lastDepartureTime = startTime;
        }
      });

      // Convert Map to array and format
      const grouped = Array.from(groupedMap.values()).map((group) => {
        const shiftsCount = group.shiftNumbers.size;
        const driversNeeded = shiftsCount;

        // Calculate shift details for visualization
        const shiftDetails: any[] = [];
        const sortedShiftNumbers = Array.from(group.shiftNumbers).sort((a, b) => (a as number) - (b as number));

        sortedShiftNumbers.forEach((shiftNum) => {
          const shiftDepartures = group.departures.filter((d: any) => d.shiftNumber === shiftNum);
          if (shiftDepartures.length > 0) {
            const firstDep = shiftDepartures[0];
            const lastDep = shiftDepartures[shiftDepartures.length - 1];

            shiftDetails.push({
              shiftNumber: shiftNum,
              firstDepartureTime: new Date(firstDep.startTime),
              lastDepartureTime: new Date(lastDep.startTime),
              departureCount: shiftDepartures.length,
            });
          }
        });

        return {
          turnusId: group.turnusId,
          turnusName: group.turnusName,
          transportId: group.transportId,
          dayNumber: group.dayNumber,
          active: group.active,
          departureCount: group.departureCount,
          firstDepartureTime: group.firstDepartureTime,
          lastDepartureTime: group.lastDepartureTime,
          linesServed: Array.from(group.linesServed),
          shiftsCount,
          driversNeeded,
          shiftNumbers: sortedShiftNumbers,
          shiftDetails,
          turageNumbers: Array.from(group.turageNumbers).sort((a, b) => (a as number) - (b as number)),
          departures: group.departures,
        };
      });

      return {
        grouped,
        total: grouped.length,
        lineNumber,
      };
    } catch (error) {
      console.error(
        `Greška pri učitavanju grupiranih turnusa za liniju ${lineNumber}:`,
        error,
      );
      throw new InternalServerErrorException(
        `Greška pri učitavanju grupiranih turnusa: ${error.message}`,
      );
    }
  }

  // ========== SINHRONIZACIJA ==========

  async syncChangesCodesFromTicketing(
    groupId: number,
    userId: number,
  ): Promise<SyncResult> {
    console.log(
      `🔄 Starting Ticketing Server sync for changes_codes_tours (group_id=${groupId})...`,
    );
    const overallStartTime = Date.now();

    let deleted = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
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
          "SHOW TABLES LIKE 'changes_codes_tours'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "changes_codes_tours" ne postoji u legacy bazi',
          );
          return { deleted: 0, created: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        // Dobij sve turnus_name vrednosti za odabranu grupu
        const [groupAssignments] = await connection.execute(
          `SELECT DISTINCT turnus_name
           FROM changes_codes_tours cct
           INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
           WHERE tga.group_id = ?`,
          [groupId],
        );

        const turnusNames = (groupAssignments as any[]).map(
          (r) => r.turnus_name,
        );

        if (turnusNames.length === 0) {
          console.warn(
            `⚠️ Nema turnusa za grupu ${groupId} u changes_codes_tours`,
          );
          return { deleted: 0, created: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        console.log(
          `📋 Found ${turnusNames.length} distinct turnus_name(s) for group ${groupId}`,
        );

        // DELETE postojećih za ovu grupu - BATCH DELETE za bolju performansu
        console.log('🗑️  Deleting existing records in batches...');
        deleted = await this.batchDeleteChangesCodes(turnusNames);
        console.log(`🗑️  Deleted ${deleted} existing record(s)`);

        // SELECT podataka iz legacy baze
        const placeholders = turnusNames.map(() => '?').join(',');
        const query = `SELECT * FROM changes_codes_tours WHERE turnus_name IN (${placeholders}) ORDER BY turnus_id ASC`;
        const [rows] = await connection.execute(query, turnusNames);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} changes_codes_tours record(s)`);

        if (legacyRecords.length === 0) {
          console.warn(
            `⚠️ Nema podataka u tabeli changes_codes_tours za odabranu grupu`,
          );
          const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(
            2,
          );
          return {
            deleted,
            created: 0,
            skipped: 0,
            errors: 0,
            totalProcessed: 0,
          };
        }

        // Disable indexes for faster bulk insert (except PRIMARY KEY)
        console.log('🔧 Disabling indexes for faster bulk insert...');
        await this.prisma.$executeRawUnsafe(
          'ALTER TABLE changes_codes_tours DISABLE KEYS'
        );

        try {
          // PARALLEL WORKERS - Split dataset into chunks for concurrent processing
          const NUM_WORKERS = 4;
          const BATCH_SIZE = 2000;

          const chunkSize = Math.ceil(legacyRecords.length / NUM_WORKERS);
          console.log(`🚀 Starting ${NUM_WORKERS} parallel workers, ${chunkSize} records per worker`);

          // Create worker promises
          const workerPromises = Array.from({ length: NUM_WORKERS }, (_, workerIndex) => {
            const start = workerIndex * chunkSize;
            const end = Math.min(start + chunkSize, legacyRecords.length);
            const workerRecords = legacyRecords.slice(start, end);

            if (workerRecords.length === 0) return Promise.resolve({ inserted: 0, errors: 0 });

            return this.parallelInsertWorker(
              workerRecords,
              workerIndex + 1,
              BATCH_SIZE,
              totalProcessed
            );
          });

          // Wait for all workers to complete
          const workerResults = await Promise.all(workerPromises);

          // Aggregate results
          workerResults.forEach(result => {
            created += result.inserted;
            errors += result.errors;
          });

          console.log(`✅ All ${NUM_WORKERS} workers completed successfully`);
        } finally {
          // Re-enable indexes - this will rebuild them
          console.log('🔧 Re-enabling indexes (rebuilding in background)...');
          await this.prisma.$executeRawUnsafe(
            'ALTER TABLE changes_codes_tours ENABLE KEYS'
          );
          console.log('✅ Indexes re-enabled successfully');
        }
      } finally {
        await connection.end();
      }

      const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(2);
      console.log(
        `✅ Changes_codes_tours sync completed in ${totalDuration}s`,
      );
      console.log(
        `   Deleted: ${deleted}, Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { deleted, created, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Changes_codes_tours sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji changes_codes_tours: ${error.message}`,
      );
    }
  }

  // ========== PARALLEL INSERT WORKER ==========

  /**
   * Parallel worker for inserting records concurrently
   * Each worker processes its own chunk of records independently
   */
  private async parallelInsertWorker(
    records: any[],
    workerNum: number,
    batchSize: number,
    totalRecords: number,
  ): Promise<{ inserted: number; errors: number }> {
    let inserted = 0;
    let errors = 0;

    console.log(`👷 Worker ${workerNum}: Starting with ${records.length} records`);

    for (let i = 0; i < records.length; i += batchSize) {
      const batchStartTime = Date.now();
      const batch = records.slice(i, i + batchSize);

      try {
        const result = await this.bulkInsertChangesCodes(batch);
        inserted += result.inserted;

        const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
        const workerProgress = Math.min(i + batchSize, records.length);
        console.log(
          `👷 Worker ${workerNum}: ${workerProgress}/${records.length} (${Math.round((workerProgress / records.length) * 100)}%) - Batch took ${batchDuration}s`,
        );
      } catch (error) {
        errors += batch.length;
        console.error(
          `❌ Worker ${workerNum} error at ${i}:`,
          error.message,
        );
      }

      // Small delay to prevent overwhelming MySQL
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`✅ Worker ${workerNum}: Completed - Inserted ${inserted}, Errors ${errors}`);
    return { inserted, errors };
  }

  // ========== BULK DELETE METHOD ==========

  /**
   * Batch DELETE za velike količine podataka - mnogo brže od pojedinačnog DELETE
   * Briše u batch-evima od 2500 rekorda sa progress logging i delay-ima
   */
  private async batchDeleteChangesCodes(
    turnusNames: string[],
  ): Promise<number> {
    let totalDeleted = 0;
    const DELETE_BATCH_SIZE = 2500; // Optimized for balance between speed and stability
    const DELAY_BETWEEN_DELETES_MS = 50; // Small delay to allow MySQL to breathe

    // Pravljenje placeholders za IN klauzulu
    const placeholders = turnusNames.map(() => '?').join(',');

    // Brišemo u batch-evima dok ima šta da se briše
    let deletedInBatch = 0;
    let iteration = 0;

    do {
      const deleteSQL = `
        DELETE FROM changes_codes_tours
        WHERE turnus_name IN (${placeholders})
        LIMIT ${DELETE_BATCH_SIZE}
      `;

      deletedInBatch = await this.prisma.$executeRawUnsafe(
        deleteSQL,
        ...turnusNames,
      ) as number;

      totalDeleted += deletedInBatch;
      iteration++;

      if (deletedInBatch > 0) {
        console.log(
          `🗑️  Batch ${iteration}: Deleted ${deletedInBatch} records (total: ${totalDeleted})`,
        );

        // Add delay between delete batches to prevent overwhelming MySQL
        if (deletedInBatch === DELETE_BATCH_SIZE) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DELETES_MS));
        }
      }
    } while (deletedInBatch === DELETE_BATCH_SIZE);

    return totalDeleted;
  }

  // ========== BULK INSERT METHODS ==========

  private async bulkInsertChangesCodes(
    records: any[],
  ): Promise<{ inserted: number }> {
    if (records.length === 0) {
      return { inserted: 0 };
    }

    const values = records
      .map((r) => {
        return `(
          ${r.turnus_id},
          ${this.escapeSQLValue(r.turnus_name)},
          ${this.escapeSQLValue(r.line_no)},
          ${this.escapeSQLValue(this.formatTimeForSQL(r.start_time))},
          ${r.direction},
          ${this.escapeSQLValue(this.formatTimeForSQL(r.duration))},
          ${this.escapeSQLValue(r.central_point)},
          ${r.change_code},
          ${r.job_id},
          ${this.escapeSQLValue(this.formatTimeForSQL(r.new_start_time))},
          ${this.escapeSQLValue(this.formatTimeForSQL(r.new_duration))},
          ${r.start_station},
          ${r.end_station},
          ${r.day_number},
          ${r.line_type_id},
          ${this.escapeSQLValue(r.rezijski)},
          ${this.escapeSQLValue(r.print_id)},
          ${r.between_rez},
          ${r.bus_number},
          ${r.start_station_id},
          ${r.end_station_id},
          ${this.escapeSQLValue(this.formatDateTimeForSQL(r.change_time))},
          ${this.escapeSQLValue(r.change_user)},
          ${r.active},
          ${this.escapeSQLValue(this.formatTimeForSQL(r.first_day_duration_part))},
          ${this.escapeSQLValue(this.formatTimeForSQL(r.second_day_duration_part))},
          ${this.escapeSQLValue(r.custom_id)},
          ${this.escapeSQLValue(r.transport_id)},
          ${r.departure_number},
          ${r.shift_number},
          ${r.turage_no},
          ${r.departure_no_in_turage}
        )`;
      })
      .join(',\n');

    const insertSQL = `
      INSERT INTO changes_codes_tours (
        turnus_id, turnus_name, line_no, start_time, direction, duration,
        central_point, change_code, job_id, new_start_time, new_duration,
        start_station, end_station, day_number, line_type_id, rezijski,
        print_id, between_rez, bus_number, start_station_id, end_station_id,
        change_time, change_user, active, first_day_duration_part,
        second_day_duration_part, custom_id, transport_id, departure_number,
        shift_number, turage_no, departure_no_in_turage
      ) VALUES ${values}
    `;

    const result = await this.prisma.$executeRawUnsafe(insertSQL);
    return { inserted: result as number };
  }

  // ========== HELPER METHODS ==========

  private escapeSQLValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    const escaped = value
      .toString()
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  private formatTimeForSQL(time: any): string {
    if (!time) return '00:00:00';

    // Ako je već u formatu HH:MM:SS
    if (typeof time === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(time)) {
      return time;
    }

    // Ako je Date objekat
    const d = new Date(time);
    if (!isNaN(d.getTime())) {
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }

    return '00:00:00';
  }

  private formatDateForSQL(date: any): string {
    if (!date) return '2023-11-01';

    // Ako je string sa '0000-00-00', koristi default
    if (typeof date === 'string' && date.startsWith('0000-00-00')) {
      return '2023-11-01';
    }

    const d = new Date(date);
    if (isNaN(d.getTime()) || d.getFullYear() < 1900) {
      return '2023-11-01';
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateTimeForSQL(date: any): string {
    if (!date) return '2023-11-01 00:00:00';

    // Ako je string sa '0000-00-00', koristi default
    if (typeof date === 'string' && date.startsWith('0000-00-00')) {
      return '2023-11-01 00:00:00';
    }

    const d = new Date(date);
    if (isNaN(d.getTime()) || d.getFullYear() < 1900) {
      return '2023-11-01 00:00:00';
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}
