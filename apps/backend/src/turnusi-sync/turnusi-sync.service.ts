import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { createConnection } from 'mysql2/promise';

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
}

@Injectable()
export class TurnusiSyncService {
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

  async getAllAssignTicketing(groupId?: number, page = 1, limit = 50) {
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
        const whereClauses: string[] = [];
        const params: any[] = [];

        if (groupId) {
          whereClauses.push('group_id = ?');
          params.push(groupId);
        }

        const whereClause =
          whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM turnus_groups_assign ${whereClause}`;
        const [countRows] = await connection.execute(countQuery, params);
        const total = (countRows as any)[0].total;

        // Get paginated data
        const dataQuery = `SELECT * FROM turnus_groups_assign ${whereClause} ORDER BY turnus_id ASC LIMIT ? OFFSET ?`;
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
      console.error('Greška pri učitavanju dodela turnusa:', error);
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }

  async getAllDaysTicketing(groupId?: number, page = 1, limit = 50) {
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

        // Za turnus_days, trebamo JOIN sa turnus_groups_assign da filtriramo po group_id
        let query = 'SELECT td.* FROM turnus_days td';
        const params: any[] = [];

        if (groupId) {
          query += ` INNER JOIN turnus_groups_assign tga ON td.turnus_id = tga.turnus_id WHERE tga.group_id = ?`;
          params.push(groupId);
        }

        // Get total count
        const countQuery = query.replace('SELECT td.*', 'SELECT COUNT(*) as total');
        const [countRows] = await connection.execute(countQuery, params);
        const total = (countRows as any)[0].total;

        // Get paginated data
        const dataQuery = `${query} ORDER BY td.turnus_id ASC LIMIT ? OFFSET ?`;
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
      console.error('Greška pri učitavanju dana turnusa:', error);
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }

  // ========== GLAVNI SERVER (NAŠA SMARTCITY_DEV BAZA) ==========

  async getAllGroupsMain(page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const total = await this.prisma.turnusGroupsName.count();

      // Get paginated data
      const data = await this.prisma.turnusGroupsName.findMany({
        skip: offset,
        take: limit,
        orderBy: { id: 'asc' },
      });

      return {
        data,
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('Greška pri učitavanju grupa turnusa iz naše baze:', error);
      throw new InternalServerErrorException(
        `Greška pri učitavanju podataka: ${error.message}`,
      );
    }
  }

  async getAllAssignMain(groupId?: number, page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;

      const where = groupId ? { groupId } : {};

      // Get total count
      const total = await this.prisma.turnusGroupsAssign.count({ where });

      // Get paginated data
      const data = await this.prisma.turnusGroupsAssign.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { turnusId: 'asc' },
      });

      return {
        data,
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('Greška pri učitavanju dodela turnusa iz naše baze:', error);
      throw new InternalServerErrorException(
        `Greška pri učitavanju podataka: ${error.message}`,
      );
    }
  }

  async getAllDaysMain(groupId?: number, page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;

      let where = {};

      // Ako je groupId prosleđen, treba filtrirati preko turnus_groups_assign tabele
      if (groupId) {
        // Prvo pronađi sve turnusId koji pripadaju ovoj grupi
        const assignedTurnusi = await this.prisma.turnusGroupsAssign.findMany({
          where: { groupId },
          select: { turnusId: true },
        });

        const turnusIds = assignedTurnusi.map(a => a.turnusId);
        where = { turnusId: { in: turnusIds } };
      }

      // Get total count
      const total = await this.prisma.turnusDays.count({ where });

      // Get paginated data
      const data = await this.prisma.turnusDays.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { turnusId: 'asc' },
      });

      return {
        data,
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('Greška pri učitavanju dana turnusa iz naše baze:', error);
      throw new InternalServerErrorException(
        `Greška pri učitavanju podataka: ${error.message}`,
      );
    }
  }


  // ========== CITY SERVER (LEGACY CITY DATABASE) ==========

  // ========== TIKETING SERVER (LEGACY BAZA) ==========

  async getAllGroupsCity() {
    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna City Baza" nije pronađena',
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

  async getAllAssignCity(groupId?: number, page = 1, limit = 50) {
    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna City Baza" nije pronađena',
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

        if (groupId) {
          whereClauses.push('group_id = ?');
          params.push(groupId);
        }

        const whereClause =
          whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM turnus_groups_assign ${whereClause}`;
        const [countRows] = await connection.execute(countQuery, params);
        const total = (countRows as any)[0].total;

        // Get paginated data
        const dataQuery = `SELECT * FROM turnus_groups_assign ${whereClause} ORDER BY turnus_id ASC LIMIT ? OFFSET ?`;
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
      console.error('Greška pri učitavanju dodela turnusa:', error);
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }

  async getAllDaysCity(groupId?: number, page = 1, limit = 50) {
    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna City Baza" nije pronađena',
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

        // Za turnus_days, trebamo JOIN sa turnus_groups_assign da filtriramo po group_id
        let query = 'SELECT td.* FROM turnus_days td';
        const params: any[] = [];

        if (groupId) {
          query += ` INNER JOIN turnus_groups_assign tga ON td.turnus_id = tga.turnus_id WHERE tga.group_id = ?`;
          params.push(groupId);
        }

        // Get total count
        const countQuery = query.replace('SELECT td.*', 'SELECT COUNT(*) as total');
        const [countRows] = await connection.execute(countQuery, params);
        const total = (countRows as any)[0].total;

        // Get paginated data
        const dataQuery = `${query} ORDER BY td.turnus_id ASC LIMIT ? OFFSET ?`;
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
      console.error('Greška pri učitavanju dana turnusa:', error);
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }


  // ========== SINHRONIZACIJA ==========

  async syncAllFromCity(userId: number) {
    console.log(
      `🔄 Starting City Server sync for ALL turnusi data...`,
    );
    const overallStartTime = Date.now();

    // PRVO: Sinhronizuj turnus_groups_names
    console.log('📋 Step 1/3: Syncing turnus_groups_names...');
    const groupsNamesResult =
      await this.syncTurnusGroupsNamesFromCity();

    // DRUGO: Sinhronizuj turnus_groups_assign
    console.log('📋 Step 2/3: Syncing turnus_groups_assign...');
    const groupsAssignResult =
      await this.syncTurnusGroupsAssignFromCity();

    // TREĆE: Sinhronizuj turnus_days
    console.log('📋 Step 3/3: Syncing turnus_days...');
    const daysResult = await this.syncTurnusDaysFromCity();

    const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(2);
    console.log(`✅ Complete sync finished in ${totalDuration}s`);

    return {
      success: true,
      turnusGroupsNames: groupsNamesResult,
      turnusGroupsAssign: groupsAssignResult,
      turnusDays: daysResult,
      totalProcessed:
        groupsNamesResult.totalProcessed +
        groupsAssignResult.totalProcessed +
        daysResult.totalProcessed,
      message: `Sinhronizacija završena: turnus_groups_names (${groupsNamesResult.created}/${groupsNamesResult.updated}/${groupsNamesResult.skipped}), turnus_groups_assign (${groupsAssignResult.created}/${groupsAssignResult.updated}/${groupsAssignResult.skipped}), turnus_days (${daysResult.created}/${daysResult.updated}/${daysResult.skipped})`,
    };
  }

  // ========== TURNUS_GROUPS_NAMES SYNC ==========

  private async syncTurnusGroupsNamesFromCity(): Promise<SyncResult> {
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna City Baza" nije pronađena',
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
          "SHOW TABLES LIKE 'turnus_groups_names'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "turnus_groups_names" ne postoji u legacy bazi',
          );
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        const query = 'SELECT * FROM turnus_groups_names ORDER BY id ASC';
        const [rows] = await connection.execute(query);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(
          `📊 Found ${totalProcessed} turnus_groups_names record(s)`,
        );

        if (legacyRecords.length === 0) {
          console.warn(`⚠️ Nema podataka u tabeli turnus_groups_names`);
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        try {
          const result = await this.bulkInsertTurnusGroupsNames(legacyRecords);
          created += result.inserted;
          updated += result.updated;
        } catch (error) {
          errors += legacyRecords.length;
          console.error(`❌ Error processing turnus_groups_names:`, error.message);
        }
      } finally {
        await connection.end();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Turnus_groups_names sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { created, updated, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Turnus_groups_names sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji turnus_groups_names: ${error.message}`,
      );
    }
  }

  // ========== TURNUS_GROUPS_ASSIGN SYNC ==========

  private async syncTurnusGroupsAssignFromCity(): Promise<SyncResult> {
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna City Baza" nije pronađena',
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
          "SHOW TABLES LIKE 'turnus_groups_assign'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "turnus_groups_assign" ne postoji u legacy bazi',
          );
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        const query = 'SELECT * FROM turnus_groups_assign ORDER BY turnus_id ASC';
        const [rows] = await connection.execute(query);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(
          `📊 Found ${totalProcessed} turnus_groups_assign record(s)`,
        );

        // BULK INSERT - batch processing
        const BATCH_SIZE = 2000;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          try {
            const result = await this.bulkInsertTurnusGroupsAssign(batch);
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
      console.log(`✅ Turnus_groups_assign sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { created, updated, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Turnus_groups_assign sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji turnus_groups_assign: ${error.message}`,
      );
    }
  }

  // ========== TURNUS_DAYS SYNC ==========

  private async syncTurnusDaysFromCity(): Promise<SyncResult> {
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna City Baza" nije pronađena',
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
          "SHOW TABLES LIKE 'turnus_days'",
        );

        if ((tables as any[]).length === 0) {
          console.warn('⚠️ Tabela "turnus_days" ne postoji u legacy bazi');
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        const query = 'SELECT * FROM turnus_days ORDER BY turnus_id ASC';
        const [rows] = await connection.execute(query);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(
          `📊 Found ${totalProcessed} turnus_days record(s)`,
        );

        // BULK INSERT - batch processing
        const BATCH_SIZE = 2000;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          try {
            const result = await this.upsertTurnusDaysBatch(batch);
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
      console.log(`✅ Turnus_days sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { created, updated, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Turnus_days sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji turnus_days: ${error.message}`,
      );
    }
  }


  // ========== SINHRONIZACIJA ==========

  async syncAllFromTicketing(userId: number) {
    console.log(
      `🔄 Starting Ticketing Server sync for ALL turnusi data...`,
    );
    const overallStartTime = Date.now();

    // PRVO: Sinhronizuj turnus_groups_names
    console.log('📋 Step 1/3: Syncing turnus_groups_names...');
    const groupsNamesResult =
      await this.syncTurnusGroupsNamesFromTicketing();

    // DRUGO: Sinhronizuj turnus_groups_assign
    console.log('📋 Step 2/3: Syncing turnus_groups_assign...');
    const groupsAssignResult =
      await this.syncTurnusGroupsAssignFromTicketing();

    // TREĆE: Sinhronizuj turnus_days
    console.log('📋 Step 3/3: Syncing turnus_days...');
    const daysResult = await this.syncTurnusDaysFromTicketing();

    const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(2);
    console.log(`✅ Complete sync finished in ${totalDuration}s`);

    return {
      success: true,
      turnusGroupsNames: groupsNamesResult,
      turnusGroupsAssign: groupsAssignResult,
      turnusDays: daysResult,
      totalProcessed:
        groupsNamesResult.totalProcessed +
        groupsAssignResult.totalProcessed +
        daysResult.totalProcessed,
      message: `Sinhronizacija završena: turnus_groups_names (${groupsNamesResult.created}/${groupsNamesResult.updated}/${groupsNamesResult.skipped}), turnus_groups_assign (${groupsAssignResult.created}/${groupsAssignResult.updated}/${groupsAssignResult.skipped}), turnus_days (${daysResult.created}/${daysResult.updated}/${daysResult.skipped})`,
    };
  }

  // ========== TURNUS_GROUPS_NAMES SYNC ==========

  private async syncTurnusGroupsNamesFromTicketing(): Promise<SyncResult> {
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
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
          "SHOW TABLES LIKE 'turnus_groups_names'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "turnus_groups_names" ne postoji u legacy bazi',
          );
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        const query = 'SELECT * FROM turnus_groups_names ORDER BY id ASC';
        const [rows] = await connection.execute(query);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(
          `📊 Found ${totalProcessed} turnus_groups_names record(s)`,
        );

        if (legacyRecords.length === 0) {
          console.warn(`⚠️ Nema podataka u tabeli turnus_groups_names`);
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        try {
          const result = await this.bulkInsertTurnusGroupsNames(legacyRecords);
          created += result.inserted;
          updated += result.updated;
        } catch (error) {
          errors += legacyRecords.length;
          console.error(`❌ Error processing turnus_groups_names:`, error.message);
        }
      } finally {
        await connection.end();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Turnus_groups_names sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { created, updated, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Turnus_groups_names sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji turnus_groups_names: ${error.message}`,
      );
    }
  }

  // ========== TURNUS_GROUPS_ASSIGN SYNC ==========

  private async syncTurnusGroupsAssignFromTicketing(): Promise<SyncResult> {
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
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
          "SHOW TABLES LIKE 'turnus_groups_assign'",
        );

        if ((tables as any[]).length === 0) {
          console.warn(
            '⚠️ Tabela "turnus_groups_assign" ne postoji u legacy bazi',
          );
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        const query = 'SELECT * FROM turnus_groups_assign ORDER BY turnus_id ASC';
        const [rows] = await connection.execute(query);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(
          `📊 Found ${totalProcessed} turnus_groups_assign record(s)`,
        );

        // BULK INSERT - batch processing
        const BATCH_SIZE = 2000;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          try {
            const result = await this.bulkInsertTurnusGroupsAssign(batch);
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
      console.log(`✅ Turnus_groups_assign sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { created, updated, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Turnus_groups_assign sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji turnus_groups_assign: ${error.message}`,
      );
    }
  }

  // ========== TURNUS_DAYS SYNC ==========

  private async syncTurnusDaysFromTicketing(): Promise<SyncResult> {
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
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
          "SHOW TABLES LIKE 'turnus_days'",
        );

        if ((tables as any[]).length === 0) {
          console.warn('⚠️ Tabela "turnus_days" ne postoji u legacy bazi');
          return { created: 0, updated: 0, skipped: 0, errors: 0, totalProcessed: 0 };
        }

        const query = 'SELECT * FROM turnus_days ORDER BY turnus_id ASC';
        const [rows] = await connection.execute(query);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(
          `📊 Found ${totalProcessed} turnus_days record(s)`,
        );

        // BULK INSERT - batch processing
        const BATCH_SIZE = 2000;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          try {
            const result = await this.upsertTurnusDaysBatch(batch);
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
      console.log(`✅ Turnus_days sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return { created, updated, skipped, errors, totalProcessed };
    } catch (error) {
      console.error('❌ Turnus_days sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji turnus_days: ${error.message}`,
      );
    }
  }

  // ========== BULK INSERT METHODS ==========

  private async bulkInsertTurnusGroupsNames(
    records: any[],
  ): Promise<{ inserted: number; updated: number }> {
    if (records.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    const values = records
      .map((r) => {
        return `(
          ${r.id},
          ${this.escapeSQLValue(r.name)},
          ${r.active ? 1 : 0},
          ${r.changed_by},
          ${this.escapeSQLValue(this.formatDateTimeForSQL(r.change_date))},
          ${this.escapeSQLValue(this.formatDateForSQL(r.date_valid_from))}
        )`;
      })
      .join(',\n');

    const insertSQL = `
      INSERT INTO turnus_groups_names (
        id, name, active, changed_by, change_date, date_valid_from
      ) VALUES ${values}
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        active = VALUES(active),
        changed_by = VALUES(changed_by),
        change_date = VALUES(change_date),
        date_valid_from = VALUES(date_valid_from)
    `;

    const result = await this.prisma.$executeRawUnsafe(insertSQL);
    return { inserted: result as number, updated: 0 };
  }

  private async bulkInsertTurnusGroupsAssign(
    records: any[],
  ): Promise<{ inserted: number; updated: number }> {
    if (records.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    const values = records
      .map((r) => {
        return `(
          ${r.turnus_id},
          ${r.group_id},
          ${r.changed_by},
          ${this.escapeSQLValue(this.formatDateTimeForSQL(r.change_date))},
          ${this.escapeSQLValue(this.formatDateTimeForSQL(r.date_from))},
          ${this.escapeSQLValue(this.formatDateTimeForSQL(r.date_to))}
        )`;
      })
      .join(',\n');

    const insertSQL = `
      INSERT INTO turnus_groups_assign (
        turnus_id, group_id, changed_by, change_date, date_from, date_to
      ) VALUES ${values}
      ON DUPLICATE KEY UPDATE
        changed_by = VALUES(changed_by),
        change_date = VALUES(change_date),
        date_to = VALUES(date_to)
    `;

    const result = await this.prisma.$executeRawUnsafe(insertSQL);
    return { inserted: result as number, updated: 0 };
  }

  /**
   * UPSERT pristup - zamena za bulkInsertTurnusDays
   * Koristi ON DUPLICATE KEY UPDATE za sigurnu sinhronizaciju bez gubitka podataka
   */
  private async upsertTurnusDaysBatch(
    records: any[],
  ): Promise<{ inserted: number; updated: number }> {
    if (records.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    const values = records
      .map((r) => {
        return `(
          ${r.turnus_id},
          ${this.escapeSQLValue(r.dayname)}
        )`;
      })
      .join(',\n');

    const upsertSQL = `
      INSERT INTO turnus_days (
        turnus_id, dayname
      ) VALUES ${values}
      ON DUPLICATE KEY UPDATE
        dayname = VALUES(dayname)
    `;

    const result = await this.prisma.$executeRawUnsafe(upsertSQL);
    return { inserted: result as number, updated: 0 };
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
