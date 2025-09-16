-- migrate:up
-- =====================================================
-- MIGRACIJA 2: Batch procedura za migraciju podataka
-- Datum: 16.09.2025
-- Cilj: Procedura koja migrira podatke po batch-ovima
-- =====================================================

-- 1. Glavna procedura za batch migraciju
CREATE OR REPLACE PROCEDURE migrate_gps_data_by_date_range(
    p_start_date DATE,
    p_end_date DATE,
    p_batch_size INTEGER DEFAULT 100000
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_date DATE;
    v_batch_count INTEGER := 0;
    v_total_migrated BIGINT := 0;
    v_daily_count BIGINT;
    v_start_time TIMESTAMP;
    v_batch_time TIMESTAMP;
    v_total_days INTEGER;
    v_current_day INTEGER := 0;
BEGIN
    -- Računaj ukupan broj dana
    v_total_days := (p_end_date - p_start_date) + 1;

    -- Update početni status
    UPDATE migration_status
    SET
        status = 'running',
        started_at = NOW(),
        total_batches = v_total_days,
        current_batch = 0,
        total_records = (SELECT approximate_row_count('gps_data'))
    WHERE migration_name = 'timezone_fix_2025';

    PERFORM log_migration_progress(
        'timezone_fix_2025',
        'MIGRATION_START',
        FORMAT('Starting migration from %s to %s (%s days)',
               p_start_date, p_end_date, v_total_days),
        NULL
    );

    -- Iteriraj kroz dane
    v_current_date := p_start_date;
    v_start_time := clock_timestamp();

    WHILE v_current_date <= p_end_date LOOP
        v_batch_time := clock_timestamp();
        v_current_day := v_current_day + 1;

        -- Migriraj podatke za trenutni dan
        BEGIN
            -- Kreiraj privremenu tabelu za batch
            CREATE TEMP TABLE IF NOT EXISTS temp_batch AS
            SELECT
                time - INTERVAL '2 hours' as time,  -- TIMEZONE FIX: -2 sata
                vehicle_id,
                garage_no,
                lat,
                lng,
                location,
                speed,
                course,
                alt,
                state,
                in_route,
                line_number,
                departure_id,
                people_in,
                people_out,
                data_source
            FROM gps_data
            WHERE time >= v_current_date::timestamp
              AND time < (v_current_date + INTERVAL '1 day')::timestamp;

            GET DIAGNOSTICS v_daily_count = ROW_COUNT;

            -- Insert u novu tabelu iz temp tabele
            IF v_daily_count > 0 THEN
                INSERT INTO gps_data_fixed
                SELECT * FROM temp_batch
                ON CONFLICT (time, vehicle_id) DO NOTHING;

                v_total_migrated := v_total_migrated + v_daily_count;
            END IF;

            -- Očisti temp tabelu
            DROP TABLE IF EXISTS temp_batch;

            -- Log uspeh
            PERFORM log_migration_progress(
                'timezone_fix_2025',
                'DAY_COMPLETED',
                FORMAT('Date %s migrated: %s records (%s sec)',
                       v_current_date,
                       v_daily_count,
                       ROUND(EXTRACT(EPOCH FROM clock_timestamp() - v_batch_time)::numeric, 2)),
                v_daily_count::INTEGER
            );

            -- Update status
            UPDATE migration_status
            SET
                current_batch = v_current_day,
                records_processed = v_total_migrated,
                processing_date = v_current_date,
                last_update = NOW()
            WHERE migration_name = 'timezone_fix_2025';

            -- Ne možemo koristiti COMMIT ovde zbog PostgreSQL ograničenja

        EXCEPTION WHEN OTHERS THEN
            -- Log grešku
            PERFORM log_migration_progress(
                'timezone_fix_2025',
                'ERROR',
                FORMAT('Error on date %s: %s', v_current_date, SQLERRM),
                NULL
            );

            -- Update status sa greškom
            UPDATE migration_status
            SET
                status = 'error',
                error_message = SQLERRM,
                last_update = NOW()
            WHERE migration_name = 'timezone_fix_2025';

            RAISE;
        END;

        -- Pauza između batch-ova (1 sekund)
        PERFORM pg_sleep(1);

        -- Sledeći dan
        v_current_date := v_current_date + 1;
    END LOOP;

    -- Finalni update statusa
    UPDATE migration_status
    SET
        status = 'completed',
        completed_at = NOW(),
        records_processed = v_total_migrated
    WHERE migration_name = 'timezone_fix_2025';

    PERFORM log_migration_progress(
        'timezone_fix_2025',
        'MIGRATION_COMPLETED',
        FORMAT('Migration completed: %s records in %s',
               v_total_migrated,
               age(clock_timestamp(), v_start_time)),
        v_total_migrated::INTEGER
    );
END;
$$;

-- 2. Helper procedura za pokretanje migracije po mesecima
CREATE OR REPLACE PROCEDURE migrate_month_by_month(
    p_start_month DATE DEFAULT '2025-06-01',
    p_end_month DATE DEFAULT CURRENT_DATE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_month DATE;
    v_month_end DATE;
BEGIN
    v_current_month := date_trunc('month', p_start_month);

    WHILE v_current_month <= p_end_month LOOP
        v_month_end := (v_current_month + INTERVAL '1 month - 1 day')::DATE;

        -- Pozovi migraciju za trenutni mesec
        CALL migrate_gps_data_by_date_range(
            v_current_month::DATE,
            LEAST(v_month_end, p_end_month)
        );

        v_current_month := v_current_month + INTERVAL '1 month';
    END LOOP;
END;
$$;

-- 3. Procedura za proveru progresa
CREATE OR REPLACE FUNCTION check_migration_progress()
RETURNS TABLE (
    status VARCHAR,
    progress_percent NUMERIC,
    records_migrated BIGINT,
    estimated_total BIGINT,
    processing_date DATE,
    running_time INTERVAL,
    records_per_second BIGINT,
    eta INTERVAL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    SELECT * INTO v_rec FROM v_migration_progress
    WHERE migration_name = 'timezone_fix_2025';

    status := v_rec.status;
    progress_percent := v_rec.progress_percent;
    records_migrated := v_rec.records_processed;
    estimated_total := v_rec.total_records;
    processing_date := (SELECT ms.processing_date FROM migration_status ms
                        WHERE ms.migration_name = 'timezone_fix_2025');
    running_time := v_rec.duration;
    records_per_second := v_rec.records_per_second;

    -- Računaj ETA
    IF v_rec.records_per_second > 0 AND v_rec.total_records > 0 THEN
        eta := make_interval(secs =>
            (v_rec.total_records - v_rec.records_processed) / v_rec.records_per_second
        );
    ELSE
        eta := NULL;
    END IF;

    RETURN NEXT;
END;
$$;

-- 4. Procedura za verifikaciju migrirane tabele
CREATE OR REPLACE FUNCTION verify_migration()
RETURNS TABLE (
    check_name VARCHAR,
    original_table_value TEXT,
    fixed_table_value TEXT,
    status VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Provera broja zapisa
    RETURN QUERY
    SELECT
        'Record Count'::VARCHAR,
        (SELECT COUNT(*)::TEXT FROM gps_data),
        (SELECT COUNT(*)::TEXT FROM gps_data_fixed),
        CASE
            WHEN (SELECT COUNT(*) FROM gps_data) = (SELECT COUNT(*) FROM gps_data_fixed)
            THEN 'OK'::VARCHAR
            ELSE 'MISMATCH'::VARCHAR
        END;

    -- Provera time range-a
    RETURN QUERY
    SELECT
        'Time Range'::VARCHAR,
        (SELECT FORMAT('[%s - %s]', MIN(time), MAX(time)) FROM gps_data),
        (SELECT FORMAT('[%s - %s]',
                MIN(time + INTERVAL '2 hours'),  -- Prikaži kao da je originalno vreme
                MAX(time + INTERVAL '2 hours'))
         FROM gps_data_fixed),
        'CHECK'::VARCHAR;

    -- Provera broja vozila
    RETURN QUERY
    SELECT
        'Unique Vehicles'::VARCHAR,
        (SELECT COUNT(DISTINCT vehicle_id)::TEXT FROM gps_data),
        (SELECT COUNT(DISTINCT vehicle_id)::TEXT FROM gps_data_fixed),
        CASE
            WHEN (SELECT COUNT(DISTINCT vehicle_id) FROM gps_data) =
                 (SELECT COUNT(DISTINCT vehicle_id) FROM gps_data_fixed)
            THEN 'OK'::VARCHAR
            ELSE 'MISMATCH'::VARCHAR
        END;
END;
$$;

-- 5. Procedura za prekid migracije
CREATE OR REPLACE PROCEDURE abort_migration()
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE migration_status
    SET
        status = 'aborted',
        completed_at = NOW(),
        error_message = 'Migration aborted by user'
    WHERE migration_name = 'timezone_fix_2025'
      AND status = 'running';

    PERFORM log_migration_progress(
        'timezone_fix_2025',
        'ABORTED',
        'Migration aborted by user request',
        NULL
    );

    RAISE NOTICE 'Migration aborted. You can resume it later.';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON PROCEDURE migrate_gps_data_by_date_range TO PUBLIC;
GRANT EXECUTE ON PROCEDURE migrate_month_by_month TO PUBLIC;
GRANT EXECUTE ON FUNCTION check_migration_progress TO PUBLIC;
GRANT EXECUTE ON FUNCTION verify_migration TO PUBLIC;
GRANT EXECUTE ON PROCEDURE abort_migration TO PUBLIC;

-- migrate:down
-- Rollback: Obriši procedure
DROP PROCEDURE IF EXISTS abort_migration CASCADE;
DROP FUNCTION IF EXISTS verify_migration CASCADE;
DROP FUNCTION IF EXISTS check_migration_progress CASCADE;
DROP PROCEDURE IF EXISTS migrate_month_by_month CASCADE;
DROP PROCEDURE IF EXISTS migrate_gps_data_by_date_range CASCADE;