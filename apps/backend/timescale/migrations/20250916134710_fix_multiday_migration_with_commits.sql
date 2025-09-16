-- migrate:up
-- =====================================================
-- Ispravka za multi-day migracije sa COMMIT nakon svakog dana
-- Datum: 16.09.2025
-- Problem: Velike transakcije pucaju kada se radi više dana odjednom
-- Rešenje: Dan-po-dan procesiranje sa eksplicitnim COMMIT
-- =====================================================

-- Prvo kreiraj helper proceduru za migraciju jednog dana
CREATE OR REPLACE PROCEDURE migrate_single_day(
    p_date DATE,
    OUT out_records_migrated BIGINT,
    OUT out_duration INTERVAL,
    p_batch_size INTEGER DEFAULT 10000
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_chunk_count INTEGER := 0;
    v_daily_processed BIGINT := 0;
    v_offset INTEGER := 0;
    v_chunk_inserted INTEGER;
    v_empty_chunks_in_row INTEGER := 0;
    v_max_empty_chunks INTEGER := 5;
BEGIN
    v_start_time := clock_timestamp();
    out_records_migrated := 0;

    RAISE NOTICE 'Starting migration for date: %', p_date;

    -- Procesuj dan u chunk-ovima
    LOOP
        -- Prekini ako je offset prevelik
        IF v_offset > 2000000 THEN
            EXIT;
        END IF;

        -- Migriraj chunk podataka
        INSERT INTO gps_data_fixed
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
        WHERE time >= p_date::timestamp
          AND time < (p_date + INTERVAL '1 day')::timestamp
        ORDER BY time
        LIMIT p_batch_size
        OFFSET v_offset
        ON CONFLICT (time, vehicle_id) DO NOTHING;

        GET DIAGNOSTICS v_chunk_inserted = ROW_COUNT;

        -- Praćenje praznih chunk-ova
        IF v_chunk_inserted = 0 THEN
            v_empty_chunks_in_row := v_empty_chunks_in_row + 1;
            IF v_empty_chunks_in_row >= v_max_empty_chunks THEN
                EXIT;
            END IF;
        ELSE
            v_empty_chunks_in_row := 0;
        END IF;

        v_daily_processed := v_daily_processed + v_chunk_inserted;
        v_chunk_count := v_chunk_count + 1;

        -- Log progres svakih 10 chunk-ova
        IF v_chunk_count % 10 = 0 AND v_chunk_inserted > 0 THEN
            RAISE NOTICE 'Date %: Chunk % processed, % records so far',
                p_date, v_chunk_count, v_daily_processed;
        END IF;

        v_offset := v_offset + p_batch_size;
    END LOOP;

    out_records_migrated := v_daily_processed;
    out_duration := clock_timestamp() - v_start_time;

    RAISE NOTICE 'Completed date %: % records in %',
        p_date, out_records_migrated, out_duration;

END;
$$;

-- Glavna procedura koja poziva single day proceduru sa COMMIT-om
CREATE OR REPLACE PROCEDURE migrate_gps_data_by_date_range(
    p_start_date DATE,
    p_end_date DATE,
    p_batch_size INTEGER DEFAULT 10000
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_date DATE;
    v_total_migrated BIGINT := 0;
    v_daily_count BIGINT;
    v_daily_duration INTERVAL;
    v_start_time TIMESTAMP;
    v_total_days INTEGER;
    v_current_day INTEGER := 0;
    v_estimated_total BIGINT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Starting migration from % to %', p_start_date, p_end_date;
    RAISE NOTICE '========================================';

    -- Računaj ukupan broj dana
    v_total_days := (p_end_date - p_start_date) + 1;
    v_estimated_total := v_total_days * 1400000;  -- Prosečno ~1.4M zapisa po danu
    v_start_time := clock_timestamp();

    -- Update početni status
    UPDATE migration_status
    SET
        status = 'running',
        started_at = NOW(),
        total_batches = v_total_days,
        current_batch = 0,
        total_records = v_estimated_total,
        records_processed = 0,
        metadata = jsonb_build_object(
            'estimated_total', v_estimated_total,
            'date_range', jsonb_build_object(
                'start_date', p_start_date::text,
                'end_date', p_end_date::text
            )
        ),
        last_update = NOW()
    WHERE migration_name = 'timezone_fix_2025';

    -- Log početak
    PERFORM log_migration_progress(
        'timezone_fix_2025',
        'MIGRATION_START',
        FORMAT('Starting migration from %s to %s (%s days, ~%s records)',
               p_start_date, p_end_date, v_total_days, v_estimated_total),
        NULL
    );

    -- COMMIT početni status
    COMMIT;

    -- Iteriraj kroz dane
    v_current_date := p_start_date;

    WHILE v_current_date <= p_end_date LOOP
        v_current_day := v_current_day + 1;

        BEGIN
            RAISE NOTICE '';
            RAISE NOTICE '>>> Processing day % of %: %', v_current_day, v_total_days, v_current_date;

            -- Pozovi single day proceduru
            CALL migrate_single_day(
                v_current_date,
                v_daily_count,
                v_daily_duration,
                p_batch_size
            );

            v_total_migrated := v_total_migrated + v_daily_count;

            -- Log završetak dana
            PERFORM log_migration_progress(
                'timezone_fix_2025',
                'DAY_COMPLETED',
                FORMAT('Date %s migrated: %s records (%s)',
                       v_current_date,
                       v_daily_count,
                       v_daily_duration),
                v_daily_count::INTEGER
            );

            -- Update status
            UPDATE migration_status
            SET
                current_batch = v_current_day,
                records_processed = v_total_migrated,
                processing_date = v_current_date,
                last_update = NOW(),
                metadata = jsonb_set(
                    jsonb_set(
                        COALESCE(metadata, '{}'::jsonb),
                        '{last_day_records}',
                        to_jsonb(v_daily_count)
                    ),
                    '{last_day_duration}',
                    to_jsonb(v_daily_duration::text)
                )
            WHERE migration_name = 'timezone_fix_2025';

            -- VAŽNO: COMMIT nakon svakog dana
            COMMIT;

            RAISE NOTICE '<<< Day % completed. Total so far: % records', v_current_date, v_total_migrated;
            RAISE NOTICE '----------------------------------------';

        EXCEPTION WHEN OTHERS THEN
            -- Ako jedan dan pukne, loguj grešku ali nastavi sa sledećim
            RAISE WARNING 'Error processing date %: %', v_current_date, SQLERRM;

            PERFORM log_migration_progress(
                'timezone_fix_2025',
                'DAY_ERROR',
                FORMAT('Error on date %s: %s', v_current_date, SQLERRM),
                NULL
            );

            -- ROLLBACK samo tog dana
            ROLLBACK;

            -- Ali nastavi sa sledećim danom
        END;

        -- Prelazi na sledeći dan
        v_current_date := v_current_date + 1;
    END LOOP;

    -- Markiraj kao završeno
    UPDATE migration_status
    SET
        status = 'completed',
        completed_at = NOW(),
        records_processed = v_total_migrated,
        last_update = NOW()
    WHERE migration_name = 'timezone_fix_2025';

    PERFORM log_migration_progress(
        'timezone_fix_2025',
        'MIGRATION_COMPLETED',
        FORMAT('Migration completed: %s records in %s',
               v_total_migrated,
               clock_timestamp() - v_start_time),
        v_total_migrated::INTEGER
    );

    -- Final COMMIT
    COMMIT;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Total records: %', v_total_migrated;
    RAISE NOTICE 'Total time: %', clock_timestamp() - v_start_time;
    RAISE NOTICE '========================================';

EXCEPTION WHEN OTHERS THEN
    -- U slučaju fatalne greške
    UPDATE migration_status
    SET
        status = 'error',
        error_message = SQLERRM,
        last_update = NOW()
    WHERE migration_name = 'timezone_fix_2025';

    PERFORM log_migration_progress(
        'timezone_fix_2025',
        'FATAL_ERROR',
        FORMAT('Migration failed: %s', SQLERRM),
        NULL
    );

    -- ROLLBACK trenutne transakcije
    ROLLBACK;

    RAISE;
END;
$$;

-- migrate:down
-- Vrati staru verziju procedure
DROP PROCEDURE IF EXISTS migrate_single_day(DATE, INTEGER, OUT BIGINT, OUT INTERVAL);
DROP PROCEDURE IF EXISTS migrate_gps_data_by_date_range(DATE, DATE, INTEGER);

