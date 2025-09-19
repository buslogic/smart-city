-- migrate:up

-- Kreiranje PAMETNE migracione procedure koja detektuje da li treba ispravka
-- Za 11. septembar 2025: pre 10:00 UTC treba korekcija, posle ne treba

CREATE OR REPLACE PROCEDURE migrate_time_range_smart(
    IN p_start_time TIMESTAMP,
    IN p_end_time TIMESTAMP,
    IN p_range_name TEXT,
    OUT out_records_migrated BIGINT,
    OUT out_duration INTERVAL,
    IN p_batch_size INTEGER DEFAULT 400000,
    IN p_cutoff_time TIMESTAMP DEFAULT '2025-09-11 10:00:00'::TIMESTAMP  -- Prelomni momenat
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    v_start_time TIMESTAMP;
    v_last_processed_time TIMESTAMP;
    v_chunk_inserted INTEGER;
    v_total_processed BIGINT := 0;
    v_empty_chunks_in_row INTEGER := 0;
    v_max_empty_chunks INTEGER := 3;
BEGIN
    v_start_time := clock_timestamp();
    out_records_migrated := 0;
    v_last_processed_time := p_start_time - INTERVAL '1 second';

    RAISE NOTICE '[%] Starting SMART migration for range % to %',
        COALESCE(p_range_name, 'RANGE'), p_start_time, p_end_time;

    RAISE NOTICE 'Cutoff time for timezone fix: %', p_cutoff_time;

    LOOP
        -- PAMETNA MIGRACIJA: proveri da li treba pomerati vreme
        INSERT INTO gps_data_fixed
        SELECT
            CASE
                -- Ako je pre cutoff vremena, pomeri za -2 sata
                WHEN time < p_cutoff_time THEN time - INTERVAL '2 hours'
                -- Inače ostavi kako jeste
                ELSE time
            END as time,
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
        WHERE time > v_last_processed_time
          AND time < p_end_time
        ORDER BY time
        LIMIT p_batch_size
        ON CONFLICT (time, vehicle_id) DO NOTHING;

        GET DIAGNOSTICS v_chunk_inserted = ROW_COUNT;

        IF v_chunk_inserted = 0 THEN
            v_empty_chunks_in_row := v_empty_chunks_in_row + 1;
            IF v_empty_chunks_in_row >= v_max_empty_chunks THEN
                EXIT;
            END IF;
        ELSE
            v_empty_chunks_in_row := 0;
            v_total_processed := v_total_processed + v_chunk_inserted;

            -- Pronađi poslednji obrađen timestamp
            SELECT MAX(time) INTO v_last_processed_time
            FROM (
                SELECT time
                FROM gps_data
                WHERE time > v_last_processed_time
                  AND time < p_end_time
                ORDER BY time
                LIMIT p_batch_size
            ) t;

            -- Loguj napredak svakih 100k zapisa
            IF v_total_processed % 100000 = 0 THEN
                RAISE NOTICE '[%] Processed % records, last time: %',
                    COALESCE(p_range_name, 'RANGE'), v_total_processed, v_last_processed_time;
            END IF;
        END IF;
    END LOOP;

    out_records_migrated := v_total_processed;
    out_duration := clock_timestamp() - v_start_time;

    -- Loguj završetak
    INSERT INTO migration_log (
        migration_name,
        action,
        message,
        records_affected,
        duration_ms,
        created_at
    ) VALUES (
        'smart_timezone_fix_2025',
        'RANGE_COMPLETED',
        format('[%s] SMART migrated range %s to %s (cutoff: %s)',
            COALESCE(p_range_name, 'RANGE'), p_start_time, p_end_time, p_cutoff_time),
        v_total_processed,
        EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000,
        NOW()
    );

    RAISE NOTICE '[%] Completed: % records in %',
        COALESCE(p_range_name, 'RANGE'), v_total_processed, out_duration;
END;
$procedure$;

-- Kreiranje wrapper procedure za 11. septembar sa automatskom detekcijom
CREATE OR REPLACE PROCEDURE migrate_september_11_smart(
    OUT out_records_migrated BIGINT,
    OUT out_duration INTERVAL
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    v_start_time TIMESTAMP;
    v_records BIGINT;
    v_duration INTERVAL;
BEGIN
    v_start_time := clock_timestamp();
    out_records_migrated := 0;

    RAISE NOTICE 'Starting SMART migration for September 11, 2025';
    RAISE NOTICE 'Data before 10:00 UTC will be shifted -2 hours';
    RAISE NOTICE 'Data after 10:00 UTC will be copied as-is';

    -- Pozovi pametnu migraciju za ceo 11. septembar
    -- Cutoff je 10:00 UTC (12:00 lokalno vreme)
    CALL migrate_time_range_smart(
        p_start_time := '2025-09-11 00:00:00'::TIMESTAMP,
        p_end_time := '2025-09-12 00:00:00'::TIMESTAMP,
        p_range_name := 'SEP-11-SMART',
        p_cutoff_time := '2025-09-11 10:00:00'::TIMESTAMP,
        out_records_migrated := v_records,
        out_duration := v_duration
    );

    out_records_migrated := v_records;
    out_duration := clock_timestamp() - v_start_time;

    RAISE NOTICE 'September 11 SMART migration completed: % records in %',
        out_records_migrated, out_duration;
END;
$procedure$;

-- Testna procedura za proveru logike
CREATE OR REPLACE FUNCTION test_smart_migration_logic(
    p_test_time TIMESTAMP,
    p_cutoff_time TIMESTAMP DEFAULT '2025-09-11 10:00:00'::TIMESTAMP
)
RETURNS TABLE(
    original_time TIMESTAMP,
    migrated_time TIMESTAMP,
    time_shift INTERVAL,
    needs_correction BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p_test_time as original_time,
        CASE
            WHEN p_test_time < p_cutoff_time THEN p_test_time - INTERVAL '2 hours'
            ELSE p_test_time
        END as migrated_time,
        CASE
            WHEN p_test_time < p_cutoff_time THEN INTERVAL '-2 hours'
            ELSE INTERVAL '0 hours'
        END as time_shift,
        p_test_time < p_cutoff_time as needs_correction;
END;
$$;

-- Test primeri
DO $$
DECLARE
    test_result RECORD;
BEGIN
    RAISE NOTICE '=== Testing SMART migration logic ===';

    SELECT * INTO test_result FROM test_smart_migration_logic('2025-09-11 08:00:00'::TIMESTAMP);
    RAISE NOTICE 'Test 1: 11.09 08:00 UTC (pre cutoff) - Original: %, Migrated: %, Shift: %',
        test_result.original_time, test_result.migrated_time, test_result.time_shift;

    SELECT * INTO test_result FROM test_smart_migration_logic('2025-09-11 09:59:59'::TIMESTAMP);
    RAISE NOTICE 'Test 2: 11.09 09:59 UTC (pre cutoff) - Original: %, Migrated: %, Shift: %',
        test_result.original_time, test_result.migrated_time, test_result.time_shift;

    SELECT * INTO test_result FROM test_smart_migration_logic('2025-09-11 10:00:00'::TIMESTAMP);
    RAISE NOTICE 'Test 3: 11.09 10:00 UTC (na cutoff) - Original: %, Migrated: %, Shift: %',
        test_result.original_time, test_result.migrated_time, test_result.time_shift;

    SELECT * INTO test_result FROM test_smart_migration_logic('2025-09-11 12:00:00'::TIMESTAMP);
    RAISE NOTICE 'Test 4: 11.09 12:00 UTC (posle cutoff) - Original: %, Migrated: %, Shift: %',
        test_result.original_time, test_result.migrated_time, test_result.time_shift;
END $$;

-- migrate:down

DROP PROCEDURE IF EXISTS migrate_september_11_smart;
DROP PROCEDURE IF EXISTS migrate_time_range_smart;
DROP FUNCTION IF EXISTS test_smart_migration_logic;