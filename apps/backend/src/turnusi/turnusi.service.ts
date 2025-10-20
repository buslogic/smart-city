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
  upserted: number; // Created + Updated rekorda (UPSERT pristup)
  skipped: number;
  errors: number;
  totalProcessed: number;
}

export interface SyncStartResponse {
  syncId: string;
  message: string;
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

      // Extract unique turnus_id values
      const uniqueTurnusIds = Array.from(
        new Set(turnusi.map((t) => t.turnusId))
      );

      console.log(`📋 Found ${uniqueTurnusIds.length} unique turnus IDs`);

      // Fetch turnus_days data for all turnusi
      const turnusDays = await this.prisma.$queryRaw<any[]>`
        SELECT DISTINCT turnus_id as turnusId, dayname as dayname
        FROM turnus_days
        WHERE turnus_id IN (${Prisma.join(uniqueTurnusIds)})
        ORDER BY turnus_id, dayname
      `;

      // Create map: turnus_id -> array of daynames
      const turnusDaysMap = new Map<number, string[]>();
      turnusDays.forEach((td) => {
        if (!turnusDaysMap.has(td.turnusId)) {
          turnusDaysMap.set(td.turnusId, []);
        }
        turnusDaysMap.get(td.turnusId)!.push(td.dayname);
      });

      console.log(`📅 Found turnus_days for ${turnusDaysMap.size} turnusi`);
      console.log(`🔍 Sample turnus_days record:`, turnusDays[0]);
      console.log(`🔍 Sample turnusDaysMap entry:`, Array.from(turnusDaysMap.entries())[0]);

      // Extract unique line numbers WITH direction suffix (e.g., "5135", "5135B")
      const uniqueLineNumbers = Array.from(
        new Set(turnusi.map((t) => t.lineNo))
      );

      // Fetch line info from lines table for ALL directions
      const lineInfos = await this.prisma.$queryRaw<any[]>`
        SELECT
          line_number as lineNumber,
          line_number_for_display as lineNumberForDisplay,
          line_title as lineTitle,
          line_title_for_display as lineTitleForDisplay
        FROM \`lines\`
        WHERE line_number IN (${Prisma.join(uniqueLineNumbers)})
      `;

      // Create map for quick lookup: lineNumber (with suffix) -> line info
      const lineInfoMap = new Map<string, any>();
      lineInfos.forEach((info) => {
        lineInfoMap.set(info.lineNumber, {
          lineNumberForDisplay: info.lineNumberForDisplay,
          lineTitle: info.lineTitle,
          lineTitleForDisplay: info.lineTitleForDisplay,
        });
      });

      // Group by (turnus_id, dayname) combination
      const groupedMap = new Map<string, any>();

      turnusi.forEach((turnus) => {
        // Use full lineNo (with direction suffix like "5135B") for lookup
        const lineInfo = lineInfoMap.get(turnus.lineNo) || {
          lineNumberForDisplay: turnus.lineNo,
          lineTitle: turnus.lineNo,
          lineTitleForDisplay: turnus.lineNo,
        };

        // Get all days this turnus operates on
        const days = turnusDaysMap.get(turnus.turnusId) || [];

        // Create a record for each day
        days.forEach((dayname) => {
          const groupKey = `${turnus.turnusId}-${dayname}`;

          if (!groupedMap.has(groupKey)) {
            groupedMap.set(groupKey, {
              turnusId: turnus.turnusId,
              turnusName: turnus.turnusName,
              transportId: turnus.transportId,
              dayname: dayname,
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

          const group = groupedMap.get(groupKey);
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
          dayname: group.dayname,
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

  async getAllChangesCodesMain(
    groupId?: number,
    lineNumber?: string,
    page = 1,
    limit = 50,
  ) {
    try {
      const offset = (page - 1) * limit;

      // Koristimo raw SQL sa JOIN da izbegnemo MySQL "too many placeholders" grešku
      if (groupId) {
        // Build WHERE clause za lineNumber
        const lineFilter = lineNumber
          ? Prisma.sql`AND cct.line_no = ${lineNumber}`
          : Prisma.empty;

        // Count query sa JOIN
        const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT cct.id) as count
          FROM changes_codes_tours cct
          INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
          WHERE tga.group_id = ${groupId}
          ${lineFilter}
        `;

        const total = Number(countResult[0].count);

        // Data query sa JOIN
        const rawData = await this.prisma.$queryRaw<any[]>`
          SELECT DISTINCT cct.*
          FROM changes_codes_tours cct
          INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
          WHERE tga.group_id = ${groupId}
          ${lineFilter}
          ORDER BY cct.turnus_id ASC, cct.start_time ASC
          LIMIT ${limit} OFFSET ${offset}
        `;

        // Mapiranje snake_case → camelCase za frontend
        // Konvertujemo BigInt u Number da bi moglo da se serijalizuje u JSON
        const data = rawData.map((row) => ({
          id: Number(row.id),
          turnusId: Number(row.turnus_id),
          turnusName: row.turnus_name,
          lineNo: row.line_no,
          startTime: row.start_time,
          direction: Number(row.direction),
          duration: row.duration,
          centralPoint: row.central_point,
          changeCode: Number(row.change_code),
          jobId: Number(row.job_id),
          newStartTime: row.new_start_time,
          newDuration: row.new_duration,
          startStation: Number(row.start_station),
          endStation: Number(row.end_station),
          dayNumber: Number(row.day_number),
          lineTypeId: Number(row.line_type_id),
          rezijski: row.rezijski,
          printId: row.print_id,
          betweenRez: Number(row.between_rez),
          busNumber: Number(row.bus_number),
          startStationId: Number(row.start_station_id),
          endStationId: Number(row.end_station_id),
          changeTime: row.change_time,
          changeUser: row.change_user,
          active: Number(row.active),
          firstDayDurationPart: row.first_day_duration_part,
          secondDayDurationPart: row.second_day_duration_part,
          customId: row.custom_id,
          transportId: row.transport_id,
          departureNumber: Number(row.departure_number),
          shiftNumber: Number(row.shift_number),
          turageNo: Number(row.turage_no),
          departureNoInTurage: Number(row.departure_no_in_turage),
        }));

        return {
          data,
          total,
          page,
          limit,
        };
      } else {
        // Bez groupId filtera, koristimo standardni Prisma query
        const where: Prisma.ChangesCodesToursWhereInput = {};

        if (lineNumber) {
          where.lineNo = lineNumber;
        }

        const total = await this.prisma.changesCodesTours.count({ where });

        const data = await this.prisma.changesCodesTours.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ turnusId: 'asc' }, { startTime: 'asc' }],
        });

        return {
          data,
          total,
          page,
          limit,
        };
      }
    } catch (error) {
      console.error('Greška pri učitavanju changes_codes_tours iz naše baze:', error);
      throw new InternalServerErrorException(
        `Greška pri učitavanju podataka: ${error.message}`,
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

    let upserted = 0; // Created + Updated rekorda
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;
    let syncId: string | null = null;
    let legacyRecords: any[] = []; // Declare outside try block

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
          return { upserted: 0, skipped: 0, errors: 0, totalProcessed: 0 };
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
          return { upserted: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        console.log(
          `📋 Found ${turnusNames.length} distinct turnus_name(s) for group ${groupId}`,
        );

        // UPSERT pristup - ne brišemo postojeće podatke, nego ažuriramo
        console.log('🔄 Starting UPSERT sync (safe sync without data loss)...');

        // SELECT podataka iz legacy baze
        const placeholders = turnusNames.map(() => '?').join(',');
        const query = `SELECT * FROM changes_codes_tours WHERE turnus_name IN (${placeholders}) ORDER BY turnus_id ASC`;
        const [rows] = await connection.execute(query, turnusNames);

        legacyRecords = rows as any[]; // Assign to outer variable
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} changes_codes_tours record(s)`);

      } finally {
        // FIX #1: Zatvori Legacy konekciju ODMAH nakon SELECT-a
        // Legacy konekcija se više ne koristi - workeri koriste samo Prisma
        await connection.end();
        console.log('✅ Legacy MySQL connection closed after SELECT');
      }

      // Create sync log entry for progress tracking
      syncId = await this.createSyncLog(groupId, userId, totalProcessed);

      if (legacyRecords.length === 0) {
        console.warn(
          `⚠️ Nema podataka u tabeli changes_codes_tours za odabranu grupu`,
        );

        // Mark sync as completed even though there are no records
        if (syncId) {
          await this.updateSyncProgress(syncId, {
            status: 'completed',
            processedRecords: 0,
            upsertedRecords: 0,
          });
        }

        const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(
          2,
        );
        return {
          upserted: 0,
          skipped: 0,
          errors: 0,
          totalProcessed: 0,
        };
      }

      // FIX #2: Optimized worker configuration
      // 1 worker umesto 2 = manje Prisma connection pool konkurencije
      // Batch 1000 umesto 500 = manje SQL query-ja (827k / 1000 = ~827 batches)
      const NUM_WORKERS = 1; // Smanjeno sa 2 → 1 za stabilnost Prisma pool-a
      const BATCH_SIZE = 1000; // Povećano sa 500 → 1000 za efikasnost
      const BATCH_DELAY_MS = 100; // Smanjeno sa 200ms → 100ms za brži sync

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
            BATCH_DELAY_MS, // Prosleđujemo delay
            totalProcessed,
            syncId // Prosleđujemo syncId za progress tracking
          );
        });

        // Wait for all workers to complete
        const workerResults = await Promise.all(workerPromises);

        // Aggregate results
        workerResults.forEach(result => {
          upserted += result.inserted; // Changed: created → upserted
          errors += result.errors;
        });

      console.log(`✅ All ${NUM_WORKERS} workers completed successfully`);

      // Mark sync as completed
      if (syncId) {
        await this.updateSyncProgress(syncId, {
          status: 'completed',
          processedRecords: totalProcessed,
          upsertedRecords: upserted,
          errorRecords: errors,
        });
      }

      const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(2);
      console.log(
        `✅ Changes_codes_tours sync completed in ${totalDuration}s`,
      );
      console.log(
        `   Upserted: ${upserted}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { upserted, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Changes_codes_tours sync failed:', error);

      // Mark sync as failed
      if (syncId) {
        await this.updateSyncProgress(syncId, {
          status: 'failed',
          errorMessage: error.message,
          errorRecords: errors,
        });
      }

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
    batchDelayMs: number, // ✅ NOVO - delay između batch-eva
    totalRecords: number,
    syncId: string | null, // ✅ NOVO - syncId za progress tracking
  ): Promise<{ inserted: number; errors: number }> {
    let inserted = 0;
    let errors = 0;
    let batchNumber = 0;

    console.log(`👷 Worker ${workerNum}: Starting with ${records.length} records`);

    for (let i = 0; i < records.length; i += batchSize) {
      const batchStartTime = Date.now();
      const batch = records.slice(i, i + batchSize);
      batchNumber++;

      try {
        // ✅ CHANGED: bulkInsertChangesCodes → upsertChangesCodesBatch
        const result = await this.upsertChangesCodesBatch(batch);
        inserted += result.inserted;

        // FIX #3: Update progress svakih 10 batch-eva umesto nakon svakog batch-a
        // Smanjuje broj Prisma query-ja sa 827 na 83 (10x manje!)
        const shouldUpdateProgress = batchNumber % 10 === 0 || i + batchSize >= records.length;

        if (syncId && shouldUpdateProgress) {
          const processedSoFar = Math.min(i + batchSize, records.length);
          const lastTurnusId = batch[batch.length - 1]?.turnus_id;

          await this.updateSyncProgress(syncId, {
            processedRecords: processedSoFar,
            upsertedRecords: inserted,
            errorRecords: errors,
            lastProcessedTurnusId: lastTurnusId,
            lastProcessedBatch: batchNumber,
          });
        }

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

        // Update error count even on failure (ali i dalje throttle-uj)
        const shouldUpdateProgress = batchNumber % 10 === 0;
        if (syncId && shouldUpdateProgress) {
          await this.updateSyncProgress(syncId, {
            errorRecords: errors,
          });
        }
      }

      // ✅ CHANGED: Parametrizovan delay umesto hardcoded 50ms
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelayMs));
      }
    }

    console.log(`✅ Worker ${workerNum}: Completed - Inserted ${inserted}, Errors ${errors}`);
    return { inserted, errors };
  }

  // ========== batchDeleteChangesCodes metoda obrisana ==========
  // Nije više potrebna jer koristimo UPSERT pristup umesto DELETE + INSERT

  // ========== BULK INSERT METHODS ==========

  /**
   * UPSERT pristup - zamena za bulkInsertChangesCodes
   * Koristi ON DUPLICATE KEY UPDATE za sigurnu sinhronizaciju bez gubitka podataka
   */
  private async upsertChangesCodesBatch(
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

    const upsertSQL = `
      INSERT INTO changes_codes_tours (
        turnus_id, turnus_name, line_no, start_time, direction, duration,
        central_point, change_code, job_id, new_start_time, new_duration,
        start_station, end_station, day_number, line_type_id, rezijski,
        print_id, between_rez, bus_number, start_station_id, end_station_id,
        change_time, change_user, active, first_day_duration_part,
        second_day_duration_part, custom_id, transport_id, departure_number,
        shift_number, turage_no, departure_no_in_turage
      ) VALUES ${values}
      ON DUPLICATE KEY UPDATE
        turnus_name = VALUES(turnus_name),
        line_no = VALUES(line_no),
        start_time = VALUES(start_time),
        direction = VALUES(direction),
        duration = VALUES(duration),
        central_point = VALUES(central_point),
        change_code = VALUES(change_code),
        job_id = VALUES(job_id),
        new_start_time = VALUES(new_start_time),
        new_duration = VALUES(new_duration),
        start_station = VALUES(start_station),
        end_station = VALUES(end_station),
        day_number = VALUES(day_number),
        line_type_id = VALUES(line_type_id),
        rezijski = VALUES(rezijski),
        print_id = VALUES(print_id),
        between_rez = VALUES(between_rez),
        bus_number = VALUES(bus_number),
        start_station_id = VALUES(start_station_id),
        end_station_id = VALUES(end_station_id),
        change_time = VALUES(change_time),
        change_user = VALUES(change_user),
        active = VALUES(active),
        first_day_duration_part = VALUES(first_day_duration_part),
        second_day_duration_part = VALUES(second_day_duration_part),
        custom_id = VALUES(custom_id),
        transport_id = VALUES(transport_id),
        departure_number = VALUES(departure_number),
        shift_number = VALUES(shift_number),
        turage_no = VALUES(turage_no),
        departure_no_in_turage = VALUES(departure_no_in_turage)
    `;

    const result = await this.prisma.$executeRawUnsafe(upsertSQL);
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

  // ========== SYNC PROGRESS TRACKING METHODS ==========

  /**
   * Creates a new sync log entry at the start of sync
   */
  async createSyncLog(
    groupId: number,
    userId: number,
    totalRecords: number,
  ): Promise<string> {
    const syncId = `sync_${groupId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // FIX #6: Koristi raw SQL INSERT umesto Prisma create() da izbegneš connection loss
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO turnus_sync_logs (
        sync_id, group_id, user_id, status, total_records,
        processed_records, upserted_records, error_records,
        last_processed_batch, started_at, updated_at
      ) VALUES (?, ?, ?, 'in_progress', ?, 0, 0, 0, 0, NOW(), NOW())
      `,
      syncId,
      groupId,
      userId,
      totalRecords
    );

    console.log(`📝 Created sync log: ${syncId}`);
    return syncId;
  }

  /**
   * Updates sync progress in the database
   */
  async updateSyncProgress(
    syncId: string,
    updates: {
      totalRecords?: number;
      processedRecords?: number;
      upsertedRecords?: number;
      errorRecords?: number;
      lastProcessedTurnusId?: number;
      lastProcessedBatch?: number;
      status?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    // FIX #4: Koristi raw SQL UPDATE umesto Prisma Client update()
    // Ovo održava konzistentnost sa UPSERT pristupom i sprečava connection loss

    const setClauses: string[] = [];
    const values: any[] = [];

    // Dinamički build UPDATE SET clause
    if (updates.totalRecords !== undefined) {
      setClauses.push('total_records = ?');
      values.push(updates.totalRecords);
    }
    if (updates.processedRecords !== undefined) {
      setClauses.push('processed_records = ?');
      values.push(updates.processedRecords);
    }
    if (updates.upsertedRecords !== undefined) {
      setClauses.push('upserted_records = ?');
      values.push(updates.upsertedRecords);
    }
    if (updates.errorRecords !== undefined) {
      setClauses.push('error_records = ?');
      values.push(updates.errorRecords);
    }
    if (updates.lastProcessedTurnusId !== undefined) {
      setClauses.push('last_processed_turnus_id = ?');
      values.push(updates.lastProcessedTurnusId);
    }
    if (updates.lastProcessedBatch !== undefined) {
      setClauses.push('last_processed_batch = ?');
      values.push(updates.lastProcessedBatch);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);

      // If marking as completed, set completedAt
      if (updates.status === 'completed') {
        setClauses.push('completed_at = NOW()');
      }
    }
    if (updates.errorMessage !== undefined) {
      setClauses.push('error_message = ?');
      values.push(updates.errorMessage);
    }

    // Uvek update-uj updated_at timestamp
    setClauses.push('updated_at = NOW()');

    // Build final SQL query
    const sql = `
      UPDATE turnus_sync_logs
      SET ${setClauses.join(', ')}
      WHERE sync_id = ?
    `;
    values.push(syncId);

    // Execute raw SQL - koristi istu connection pool strategiju kao UPSERT
    await this.prisma.$executeRawUnsafe(sql, ...values);
  }

  /**
   * Gets the current status of a sync log
   */
  async getSyncStatus(syncId: string) {
    return await this.prisma.turnusSyncLog.findUnique({
      where: { syncId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Gets the last incomplete sync for a group (for resume capability)
   */
  async getLastIncompleteSyncForGroup(groupId: number) {
    // FIX #5: Koristi raw SQL umesto Prisma findFirst() da izbegneš connection loss
    const result = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT * FROM turnus_sync_logs
      WHERE group_id = ?
        AND status IN ('pending', 'in_progress')
      ORDER BY started_at DESC
      LIMIT 1
      `,
      groupId
    );

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Resume or start sync - detects incomplete syncs and handles them gracefully
   * Uses UPSERT approach to ensure data consistency even when resuming
   */
  async resumeOrStartSync(groupId: number, userId: number): Promise<SyncResult> {
    // Check for incomplete sync
    const incompleteSync = await this.getLastIncompleteSyncForGroup(groupId);

    if (incompleteSync) {
      console.log(`⚠️ Found incomplete sync: ${incompleteSync.syncId}`);
      console.log(`   Started: ${incompleteSync.startedAt}`);
      console.log(
        `   Progress: ${incompleteSync.processedRecords}/${incompleteSync.totalRecords} (${Math.round((incompleteSync.processedRecords / incompleteSync.totalRecords) * 100)}%)`,
      );

      // Mark old sync as abandoned
      await this.updateSyncProgress(incompleteSync.syncId, {
        status: 'abandoned',
        errorMessage: 'Sync was interrupted and a new sync was started',
      });

      console.log(`🔄 Starting new sync to replace abandoned one...`);
      console.log(`   ✅ UPSERT approach ensures no data loss from interrupted sync`);
    }

    // Start fresh sync (UPSERT ensures data consistency - won't duplicate or lose data)
    return await this.syncChangesCodesFromTicketing(groupId, userId);
  }

  /**
   * Start sync asynchronously and return syncId immediately for real-time tracking
   * Sync continues in background
   */
  async startSyncAsync(groupId: number, userId: number): Promise<SyncStartResponse> {
    // Check for incomplete sync
    const incompleteSync = await this.getLastIncompleteSyncForGroup(groupId);

    if (incompleteSync) {
      console.log(`⚠️ Found incomplete sync: ${incompleteSync.syncId}`);
      console.log(`   Started: ${incompleteSync.startedAt}`);
      console.log(
        `   Progress: ${incompleteSync.processedRecords}/${incompleteSync.totalRecords} (${Math.round((incompleteSync.processedRecords / incompleteSync.totalRecords) * 100)}%)`,
      );

      // Mark old sync as abandoned
      await this.updateSyncProgress(incompleteSync.syncId, {
        status: 'abandoned',
        errorMessage: 'Sync was interrupted and a new sync was started',
      });

      console.log(`🔄 Starting new sync to replace abandoned one...`);
      console.log(`   ✅ UPSERT approach ensures no data loss from interrupted sync`);
    }

    // Create a temporary sync log to get syncId (we don't know totalRecords yet, will update in sync method)
    const syncId = `sync_${groupId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // FIX #6: Create initial sync log using raw SQL (totalRecords will be updated later when we know the count)
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO turnus_sync_logs (
        sync_id, group_id, user_id, status, total_records,
        processed_records, upserted_records, error_records,
        last_processed_batch, started_at, updated_at
      ) VALUES (?, ?, ?, 'in_progress', 0, 0, 0, 0, 0, NOW(), NOW())
      `,
      syncId,
      groupId,
      userId
    );

    // Start sync in background (don't await)
    setImmediate(() => {
      this.syncChangesCodesFromTicketingWithExistingLog(groupId, userId, syncId)
        .then(() => {
          console.log(`✅ Background sync completed for group ${groupId}`);
        })
        .catch((error) => {
          console.error(`❌ Background sync failed for group ${groupId}:`, error);
          // Mark sync as failed
          this.updateSyncProgress(syncId, {
            status: 'failed',
            errorMessage: error.message,
          }).catch(console.error);
        });
    });

    return {
      syncId,
      message: `Sync started successfully for group ${groupId}. Use syncId to track progress.`,
    };
  }

  /**
   * Internal method - sync with existing log (used by startSyncAsync)
   */
  private async syncChangesCodesFromTicketingWithExistingLog(
    groupId: number,
    userId: number,
    existingSyncId: string,
  ): Promise<SyncResult> {
    console.log(
      `🔄 Starting Ticketing Server sync for changes_codes_tours (group_id=${groupId}) with existing syncId=${existingSyncId}...`,
    );
    const overallStartTime = Date.now();

    let upserted = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;
    const syncId = existingSyncId;
    let legacyRecords: any[] = []; // Declare outside try block

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
          await this.updateSyncProgress(syncId, {
            status: 'completed',
            processedRecords: 0,
            upsertedRecords: 0,
          });
          return { upserted: 0, skipped: 0, errors: 0, totalProcessed: 0 };
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
          await this.updateSyncProgress(syncId, {
            status: 'completed',
            processedRecords: 0,
            upsertedRecords: 0,
          });
          return { upserted: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        console.log(
          `📋 Found ${turnusNames.length} distinct turnus_name(s) for group ${groupId}`,
        );

        console.log('🔄 Starting UPSERT sync (safe sync without data loss)...');

        // SELECT podataka iz legacy baze
        const placeholders = turnusNames.map(() => '?').join(',');
        const query = `SELECT * FROM changes_codes_tours WHERE turnus_name IN (${placeholders}) ORDER BY turnus_id ASC`;
        const [rows] = await connection.execute(query, turnusNames);

        legacyRecords = rows as any[]; // Assign to outer variable
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} changes_codes_tours record(s)`);

      } finally {
        // FIX #1: Zatvori Legacy konekciju ODMAH nakon SELECT-a
        // Legacy konekcija se više ne koristi - workeri koriste samo Prisma
        await connection.end();
        console.log('✅ Legacy MySQL connection closed after SELECT');
      }

      // Update sync log with totalRecords now that we know it
      await this.updateSyncProgress(syncId, {
        totalRecords: totalProcessed,
      });

      if (legacyRecords.length === 0) {
        console.warn(
          `⚠️ Nema podataka u tabeli changes_codes_tours za odabranu grupu`,
        );
        await this.updateSyncProgress(syncId, {
          status: 'completed',
          processedRecords: 0,
          upsertedRecords: 0,
        });
        return {
          upserted: 0,
          skipped: 0,
          errors: 0,
          totalProcessed: 0,
        };
      }

      // FIX #2: Optimized worker configuration
      // 1 worker umesto 2 = manje Prisma connection pool konkurencije
      // Batch 1000 umesto 500 = manje SQL query-ja (827k / 1000 = ~827 batches)
      const NUM_WORKERS = 1; // Smanjeno sa 2 → 1 za stabilnost Prisma pool-a
      const BATCH_SIZE = 1000; // Povećano sa 500 → 1000 za efikasnost
      const BATCH_DELAY_MS = 100; // Smanjeno sa 200ms → 100ms za brži sync

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
            BATCH_DELAY_MS,
            totalProcessed,
            syncId,
          );
        });

        // Wait for all workers to complete
        const workerResults = await Promise.all(workerPromises);

        // Aggregate results
        workerResults.forEach(result => {
          upserted += result.inserted;
          errors += result.errors;
        });

      console.log(`✅ All ${NUM_WORKERS} workers completed successfully`);

      // Mark sync as completed
      await this.updateSyncProgress(syncId, {
        status: 'completed',
        processedRecords: totalProcessed,
        upsertedRecords: upserted,
        errorRecords: errors,
      });

      const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(2);
      console.log(
        `✅ Changes_codes_tours sync completed in ${totalDuration}s`,
      );
      console.log(
        `   Upserted: ${upserted}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { upserted, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Changes_codes_tours sync failed:', error);

      // Mark sync as failed
      await this.updateSyncProgress(syncId, {
        status: 'failed',
        errorMessage: error.message,
        errorRecords: errors,
      });

      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji changes_codes_tours: ${error.message}`,
      );
    }
  }
}
