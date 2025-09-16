import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { createTimescalePool } from '../common/config/timescale.config';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  private timescalePool: Pool;

  constructor() {
    this.timescalePool = createTimescalePool();
  }

  async getMigrationStatus() {
    try {
      const result = await this.timescalePool.query(
        `SELECT * FROM check_migration_progress()`
      );

      if (result.rows.length === 0) {
        return {
          status: 'not_started',
          progressPercent: 0,
          recordsMigrated: 0,
          estimatedTotal: 304000000,
          message: 'Migration has not been started yet'
        };
      }

      const status = result.rows[0];

      // Dohvati poslednje logove
      const logsResult = await this.timescalePool.query(`
        SELECT * FROM migration_log
        WHERE migration_name = 'timezone_fix_2025'
        ORDER BY created_at DESC
        LIMIT 10
      `);

      // Dohvati datumski opseg iz metadata
      const metadataResult = await this.timescalePool.query(`
        SELECT metadata FROM migration_status
        WHERE migration_name = 'timezone_fix_2025'
      `);

      const dateRange = metadataResult.rows[0]?.metadata?.date_range;

      return {
        status: status.status,
        progressPercent: parseFloat(status.progress_percent || 0),
        recordsMigrated: parseInt(status.records_migrated || 0),
        estimatedTotal: parseInt(status.estimated_total || 304000000),
        currentDate: status.processing_date,
        runningTime: status.running_time,
        recordsPerSecond: parseInt(status.records_per_second || 0),
        eta: status.eta,
        startDate: dateRange?.start_date,
        endDate: dateRange?.end_date,
        lastLogs: logsResult.rows.map(log => ({
          id: log.id,
          action: log.action,
          message: log.message,
          recordsAffected: log.records_affected,
          createdAt: log.created_at
        }))
      };
    } catch (error) {
      this.logger.error('Error getting migration status:', error);
      throw error;
    }
  }

  private async runDayByDayMigration(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(startDate);
    let totalMigrated = 0;
    let currentDay = 0;
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const startTime = Date.now();
    const batchSize = 200000; // Povećan batch size sa 50k na 200k za velike dataset-e (17M+ zapisa dnevno)

    this.logger.log(`Will process ${totalDays} days with batch size ${batchSize}`);

    // Log početak migracije
    await this.timescalePool.query(`
      SELECT log_migration_progress(
        'timezone_fix_2025',
        'MIGRATION_START',
        $1,
        NULL
      )
    `, [`Starting migration from ${startDate} to ${endDate} (${totalDays} days)`]);

    while (current <= end) {
      const currentDateStr = current.toISOString().split('T')[0];
      currentDay++;

      try {
        this.logger.log(`Processing day ${currentDay}/${totalDays}: ${currentDateStr}`);

        // Prebroj zapise u gps_data_fixed pre migracije SAMO za trenutni dan
        const beforeCountResult = await this.timescalePool.query(`
          SELECT COUNT(*) as count
          FROM gps_data_fixed
          WHERE time >= $1::date - INTERVAL '2 hours'
            AND time < ($1::date + INTERVAL '1 day') - INTERVAL '2 hours'
        `, [currentDateStr]);
        const beforeCount = parseInt(beforeCountResult.rows[0].count);

        this.logger.log(`Day ${currentDateStr} - Before migration: ${beforeCount} records`);

        // Pozovi migrate_single_day proceduru za jedan dan
        const procResult = await this.timescalePool.query(`
          CALL migrate_single_day($1::date, NULL, NULL, $2)
        `, [currentDateStr, batchSize]);

        // Prebroj zapise u gps_data_fixed posle migracije SAMO za trenutni dan
        const afterCountResult = await this.timescalePool.query(`
          SELECT COUNT(*) as count
          FROM gps_data_fixed
          WHERE time >= $1::date - INTERVAL '2 hours'
            AND time < ($1::date + INTERVAL '1 day') - INTERVAL '2 hours'
        `, [currentDateStr]);
        const afterCount = parseInt(afterCountResult.rows[0].count);

        // Izračunaj koliko je stvarno migrirano za ovaj dan
        const dayRecords = afterCount - beforeCount;
        totalMigrated += dayRecords;

        this.logger.log(`Day ${currentDateStr} - After migration: ${afterCount} records (migrated: ${dayRecords})`);

        // Log završetak dana
        await this.timescalePool.query(`
          SELECT log_migration_progress(
            'timezone_fix_2025',
            'DAY_COMPLETED',
            $1,
            $2::integer
          )
        `, [`Date ${currentDateStr} migrated: ${dayRecords} records`, dayRecords]);

        // Update status
        await this.timescalePool.query(`
          UPDATE migration_status
          SET
            current_batch = $1,
            records_processed = $2,
            processing_date = $3::date,
            last_update = NOW()
          WHERE migration_name = 'timezone_fix_2025'
        `, [currentDay, totalMigrated, currentDateStr]);

        this.logger.log(`Day ${currentDateStr} completed: ${dayRecords} records`);

      } catch (error) {
        this.logger.error(`Error processing date ${currentDateStr}:`, error);

        // Log grešku ali nastavi sa sledećim danom
        await this.timescalePool.query(`
          SELECT log_migration_progress(
            'timezone_fix_2025',
            'DAY_ERROR',
            $1,
            NULL
          )
        `, [`Error on date ${currentDateStr}: ${error.message}`]);
      }

      // Prelazi na sledeći dan
      current.setDate(current.getDate() + 1);
    }

    // Završi migraciju
    const duration = (Date.now() - startTime) / 1000;
    await this.timescalePool.query(`
      UPDATE migration_status
      SET
        status = 'completed',
        completed_at = NOW(),
        records_processed = $1,
        last_update = NOW()
      WHERE migration_name = 'timezone_fix_2025'
    `, [totalMigrated]);

    await this.timescalePool.query(`
      SELECT log_migration_progress(
        'timezone_fix_2025',
        'MIGRATION_COMPLETED',
        $1,
        $2::integer
      )
    `, [`Migration completed: ${totalMigrated} records in ${duration} seconds`, totalMigrated]);

    this.logger.log(`Migration completed: ${totalMigrated} records in ${duration} seconds`);
  }

  async startMigration(startDate?: string, endDate?: string, resume: boolean = false) {
    try {
      this.logger.log(`=== START MIGRATION CALLED ===`);
      this.logger.log(`Received startDate: ${startDate}, endDate: ${endDate}, resume: ${resume}`);

      // Definiši datume na početku
      const migrationStartDate = startDate || '2025-06-16';
      const migrationEndDate = endDate || new Date().toISOString().split('T')[0];

      this.logger.log(`Using dates: ${migrationStartDate} to ${migrationEndDate}`);

      // Proveri da li migracija već radi
      const statusResult = await this.timescalePool.query(`
        SELECT status, processing_date, metadata FROM migration_status
        WHERE migration_name = 'timezone_fix_2025'
      `);

      this.logger.log(`Current status: ${statusResult.rows[0]?.status || 'NOT FOUND'}`);

      if (statusResult.rows.length > 0) {
        const currentStatus = statusResult.rows[0].status;
        const lastProcessedDate = statusResult.rows[0].processing_date;
        const metadata = statusResult.rows[0].metadata;

        if (currentStatus === 'running') {
          return {
            success: false,
            message: 'Migration is already running'
          };
        }

        // Ako je resume i ima poslednji datum, nastavi odatle
        let actualStartDate = migrationStartDate;
        if (resume && lastProcessedDate && currentStatus === 'aborted') {
          // Nastavi od sledećeg dana nakon poslednjeg obrađenog
          const nextDate = new Date(lastProcessedDate);
          nextDate.setDate(nextDate.getDate() + 1);
          actualStartDate = nextDate.toISOString().split('T')[0];
          this.logger.log(`Resuming from ${actualStartDate} (last processed: ${lastProcessedDate})`);
        } else if (!resume) {
          // Reset ako nije resume
          await this.timescalePool.query(`
            UPDATE migration_status
            SET status = 'initialized',
                started_at = NULL,
                completed_at = NULL,
                current_batch = 0,
                records_processed = 0,
                processing_date = NULL,
                error_message = NULL,
                last_update = NOW(),
                total_batches = 0,
                total_records = 0,
                metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{date_range}',
                  jsonb_build_object(
                    'start_date', $1::text,
                    'end_date', $2::text
                  )
                )
            WHERE migration_name = 'timezone_fix_2025'
          `, [migrationStartDate, migrationEndDate]);

          this.logger.log(`Reset migration for new date range: ${migrationStartDate} to ${migrationEndDate}`);
        }
      } else {
        // Ako ne postoji uopšte, kreiraj novi zapis
        await this.timescalePool.query(`
          INSERT INTO migration_status (migration_name, status, metadata)
          VALUES ('timezone_fix_2025', 'initialized', jsonb_build_object(
            'date_range', jsonb_build_object(
              'start_date', $1::text,
              'end_date', $2::text
            )
          ))
        `, [migrationStartDate, migrationEndDate]);

        // NE BRIŠI - prva migracija će samo dodati podatke
        this.logger.log('First migration - table ready');
      }

      this.logger.log(`Starting migration from ${migrationStartDate} to ${migrationEndDate}`);

      // Prvo update-uj status na 'running'
      await this.timescalePool.query(`
        UPDATE migration_status
        SET status = 'running',
            started_at = NOW(),
            last_update = NOW()
        WHERE migration_name = 'timezone_fix_2025'
      `);

      // Pokreni migraciju u pozadini sa custom datumima
      // NAPOMENA: Ovo će pokrenuti dugotrajan proces
      // Radimo dan-po-dan sa commit-om između dana
      // Koristi actualStartDate ako je resume
      const finalStartDate = resume && statusResult.rows[0]?.processing_date
        ? (() => {
            const nextDate = new Date(statusResult.rows[0].processing_date);
            nextDate.setDate(nextDate.getDate() + 1);
            return nextDate.toISOString().split('T')[0];
          })()
        : migrationStartDate;

      this.logger.log(`Starting day-by-day migration from ${finalStartDate} to ${migrationEndDate}`);

      this.runDayByDayMigration(finalStartDate, migrationEndDate)
      .then(() => {
        this.logger.log('Migration completed successfully');
      }).catch(error => {
        this.logger.error('Migration background process error:', error);
        this.logger.error('Error details:', error.stack);
        // Update status to error
        this.timescalePool.query(`
          UPDATE migration_status
          SET status = 'error',
              error_message = $1,
              last_update = NOW()
          WHERE migration_name = 'timezone_fix_2025'
        `, [error.message]);
      });

      this.logger.log('Migration started successfully');

      return {
        success: true,
        message: 'Migration started successfully',
        startDate: migrationStartDate,
        endDate: migrationEndDate,
        note: 'Migration is running in background. Check status for progress.'
      };
    } catch (error) {
      this.logger.error('Error starting migration:', error);
      throw error;
    }
  }

  async abortMigration() {
    try {
      await this.timescalePool.query(`CALL abort_migration()`);

      return {
        success: true,
        message: 'Migration aborted successfully'
      };
    } catch (error) {
      this.logger.error('Error aborting migration:', error);
      throw error;
    }
  }

  async verifyMigration() {
    try {
      const result = await this.timescalePool.query(
        `SELECT * FROM verify_migration()`
      );

      return {
        checks: result.rows.map(row => ({
          checkName: row.check_name,
          originalValue: row.original_table_value,
          fixedValue: row.fixed_table_value,
          status: row.status
        }))
      };
    } catch (error) {
      this.logger.error('Error verifying migration:', error);
      throw error;
    }
  }

  async getMigrationLogs(limit: number = 50) {
    try {
      const result = await this.timescalePool.query(`
        SELECT * FROM migration_log
        WHERE migration_name = 'timezone_fix_2025'
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);

      return {
        logs: result.rows.map(log => ({
          id: log.id,
          action: log.action,
          message: log.message,
          recordsAffected: log.records_affected,
          durationMs: log.duration_ms,
          createdAt: log.created_at
        }))
      };
    } catch (error) {
      this.logger.error('Error getting migration logs:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.timescalePool.end();
  }
}