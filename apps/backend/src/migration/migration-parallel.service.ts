import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { createTimescalePool } from '../common/config/timescale.config';

export interface TimeRange {
  rangeId: number;
  rangeName: string;
  startTime: Date;
  endTime: Date;
}

export interface ParallelMigrationOptions {
  date: string;
  parts?: number; // 4, 6, ili 8 delova
  maxConcurrent?: number; // Maksimalan broj paralelnih procesa
  batchSize?: number; // Batch size po procesu
}

@Injectable()
export class MigrationParallelService {
  private readonly logger = new Logger(MigrationParallelService.name);
  private timescalePool: Pool;
  private runningMigrations: Map<string, boolean> = new Map();

  constructor() {
    this.timescalePool = createTimescalePool();
  }

  /**
   * Pokreće paralelnu migraciju za jedan dan podeljenu na više vremenskih intervala
   */
  async runParallelDayMigration(options: ParallelMigrationOptions) {
    const { date, parts = 4, maxConcurrent = 2, batchSize = 400000 } = options;

    this.logger.log(
      `Starting parallel migration for ${date} with ${parts} parts`,
    );

    try {
      // Dobavi range-ove za dan
      const ranges = await this.getDayRanges(date, parts);
      this.logger.log(`Day split into ${ranges.length} ranges`);

      // Log početak paralelne migracije
      await this.logMigrationEvent(
        'PARALLEL_START',
        `Starting parallel migration for ${date} with ${parts} parts`,
      );

      // Pokreni migracije u batch-ovima sa ograničenim brojem paralelnih procesa
      const results = await this.runMigrationsInBatches(
        ranges,
        maxConcurrent,
        batchSize,
      );

      // Sumiraj rezultate
      const totalRecords = results.reduce(
        (sum, r) => sum + r.recordsMigrated,
        0,
      );
      const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

      // Log završetak
      await this.logMigrationEvent(
        'PARALLEL_COMPLETED',
        `Completed parallel migration for ${date}: ${totalRecords} records`,
        totalRecords,
      );

      return {
        success: true,
        date,
        totalRecords,
        totalDurationMs: totalDuration,
        ranges: results,
      };
    } catch (error) {
      this.logger.error(`Error in parallel migration for ${date}:`, error);
      await this.logMigrationEvent(
        'PARALLEL_ERROR',
        `Error in parallel migration for ${date}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Pokreće migracije u kontrolisanim batch-ovima
   */
  private async runMigrationsInBatches(
    ranges: TimeRange[],
    maxConcurrent: number,
    batchSize: number,
  ): Promise<
    Array<{
      rangeName: string;
      recordsMigrated: number;
      durationMs: number;
      recordsPerSecond?: number;
      error?: string;
    }>
  > {
    const results: Array<{
      rangeName: string;
      recordsMigrated: number;
      durationMs: number;
      recordsPerSecond?: number;
      error?: string;
    }> = [];

    // Podeli range-ove u grupe za paralelno izvršavanje
    for (let i = 0; i < ranges.length; i += maxConcurrent) {
      const batch = ranges.slice(i, i + maxConcurrent);

      this.logger.log(
        `Processing batch ${Math.floor(i / maxConcurrent) + 1}: ${batch.map((r) => r.rangeName).join(', ')}`,
      );

      // Pokreni sve u batch-u paralelno
      const batchPromises = batch.map((range) =>
        this.migrateTimeRange(range, batchSize),
      );

      const batchResults = await Promise.allSettled(batchPromises);

      // Obradi rezultate
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const range = batch[j];

        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error(
            `Failed to migrate ${range.rangeName}:`,
            result.reason,
          );
          results.push({
            rangeName: range.rangeName,
            recordsMigrated: 0,
            durationMs: 0,
            error: result.reason?.message || 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  /**
   * Migrira pojedinačni vremenski interval
   */
  private async migrateTimeRange(range: TimeRange, batchSize: number) {
    const startTime = Date.now();
    const migrationKey = `${range.rangeName}_${range.startTime.toISOString()}`;

    // Proveri da li već radi
    if (this.runningMigrations.has(migrationKey)) {
      throw new Error(`Migration for ${range.rangeName} is already running`);
    }

    this.runningMigrations.set(migrationKey, true);

    try {
      this.logger.log(`Starting migration for ${range.rangeName}`);

      // Pozovi SMART proceduru za range sa automatskom detekcijom cutoff vremena
      const result = await this.timescalePool.query(
        `
        CALL migrate_time_range_smart(
          $1::timestamp,
          $2::timestamp,
          $3::text,
          NULL,
          NULL,
          $4::integer,
          '2025-09-11 10:00:00'::timestamp  -- Cutoff: pre ovoga -2h, posle bez izmene
        )
      `,
        [
          range.startTime.toISOString(),
          range.endTime.toISOString(),
          range.rangeName,
          batchSize,
        ],
      );

      const durationMs = Date.now() - startTime;

      // Dobavi broj migriranih zapisa iz loga
      const logResult = await this.timescalePool.query(
        `
        SELECT records_affected
        FROM migration_log
        WHERE migration_name = 'timezone_fix_2025'
          AND action = 'RANGE_COMPLETED'
          AND message LIKE $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
        [`%${range.rangeName}%`],
      );

      const recordsMigrated = logResult.rows[0]?.records_affected || 0;

      this.logger.log(
        `Completed ${range.rangeName}: ${recordsMigrated} records in ${durationMs}ms`,
      );

      return {
        rangeName: range.rangeName,
        recordsMigrated,
        durationMs,
        recordsPerSecond: Math.round(recordsMigrated / (durationMs / 1000)),
      };
    } finally {
      this.runningMigrations.delete(migrationKey);
    }
  }

  /**
   * Dobavlja vremenske intervale za dan
   */
  private async getDayRanges(
    date: string,
    parts: number,
  ): Promise<TimeRange[]> {
    const result = await this.timescalePool.query(
      `
      SELECT * FROM split_day_into_ranges($1::date, $2)
      ORDER BY range_id
    `,
      [date, parts],
    );

    return result.rows.map((row) => ({
      rangeId: row.range_id,
      rangeName: row.range_name,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
    }));
  }

  /**
   * Proverava napredak migracije po range-ovima
   */
  async checkRangeProgress(date: string) {
    try {
      // Brža alternativa - koristi migration_log umesto COUNT-a
      const result = await this.timescalePool.query(
        `
        WITH ranges AS (
          SELECT * FROM split_day_into_ranges($1::date, 4)
        ),
        completed AS (
          SELECT
            substring(message from '\\[(.*?)\\]') as range_name,
            records_affected
          FROM migration_log
          WHERE migration_name = 'timezone_fix_2025'
            AND action = 'RANGE_COMPLETED'
            AND message LIKE '%' || $1 || '%'
            AND created_at > NOW() - INTERVAL '24 hours'
        )
        SELECT
          r.range_name,
          r.start_time::text,
          r.end_time::text,
          COALESCE(c.records_affected, 0) as migrated_records,
          CASE
            WHEN c.records_affected IS NOT NULL THEN 100.0
            ELSE 0.0
          END as progress_percent
        FROM ranges r
        LEFT JOIN completed c ON r.range_name = c.range_name
        ORDER BY r.range_id
      `,
        [date],
      );

      return result.rows.map((row) => ({
        rangeName: row.range_name,
        startTime: row.start_time,
        endTime: row.end_time,
        estimatedRecords: 0, // Ne računamo estimated da izbegnemo timeout
        migratedRecords: parseInt(row.migrated_records),
        progressPercent: parseFloat(row.progress_percent),
      }));
    } catch (error) {
      this.logger.error(`Error checking range progress for ${date}:`, error);
      // Vrati prazan niz ako query timeout-uje
      return [];
    }
  }

  /**
   * Pokreće optimizovanu migraciju za ceo dan (bez OFFSET-a)
   */
  async runOptimizedDayMigration(date: string, batchSize: number = 400000) {
    const startTime = Date.now();

    this.logger.log(`Starting optimized migration for ${date}`);

    try {
      // Pozovi optimizovanu proceduru
      const result = await this.timescalePool.query(
        `
        CALL migrate_single_day_optimized($1::date, NULL, NULL, $2)
      `,
        [date, batchSize],
      );

      const durationMs = Date.now() - startTime;

      // Dobavi statistike
      const statsResult = await this.timescalePool.query(
        `
        SELECT
          COUNT(*) as records_migrated
        FROM gps_data_fixed
        WHERE time >= $1::date - INTERVAL '2 hours'
          AND time < ($1::date + INTERVAL '1 day') - INTERVAL '2 hours'
      `,
        [date],
      );

      const recordsMigrated = parseInt(statsResult.rows[0].records_migrated);

      return {
        success: true,
        date,
        recordsMigrated,
        durationMs,
        recordsPerSecond: Math.round(recordsMigrated / (durationMs / 1000)),
      };
    } catch (error) {
      this.logger.error(`Error in optimized migration for ${date}:`, error);
      throw error;
    }
  }

  /**
   * Helper za logovanje događaja
   */
  private async logMigrationEvent(
    action: string,
    message: string,
    recordsAffected?: number,
  ) {
    await this.timescalePool.query(
      `
      INSERT INTO migration_log (
        migration_name,
        action,
        message,
        records_affected,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `,
      ['timezone_fix_2025', action, message, recordsAffected || null],
    );
  }

  /**
   * Proveri da li su svi range-ovi završeni za dan
   */
  async isDayFullyMigrated(date: string): Promise<boolean> {
    const progress = await this.checkRangeProgress(date);
    return progress.every((r) => r.progressPercent >= 99.9);
  }

  async onModuleDestroy() {
    await this.timescalePool.end();
  }
}
