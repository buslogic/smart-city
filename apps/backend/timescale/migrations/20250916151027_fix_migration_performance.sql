-- migrate:up
-- =====================================================
-- Poboljšanje performansi migracije za velike dataset-e
-- Datum: 16.09.2025
-- Problem:
--   1. Hardkodovan limit od 2M zapisa prekida migraciju pre kraja
--   2. Mali batch size (50k) usporava migraciju za 17.6M zapisa dnevno
-- Rešenje:
--   1. Uklanjanje offset limita
--   2. Povećanje default batch size-a na 200,000
-- =====================================================

-- Prvo briši stare verzije procedura
DROP PROCEDURE IF EXISTS migrate_single_day(DATE, OUT BIGINT, OUT INTERVAL, INTEGER);
DROP PROCEDURE IF EXISTS migrate_gps_data_by_date_range(DATE, DATE, INTEGER);

-- Kreiraj optimizovanu proceduru za migraciju jednog dana
CREATE OR REPLACE PROCEDURE migrate_single_day(
    p_date DATE,
    OUT out_records_migrated BIGINT,
    OUT out_duration INTERVAL,
    p_batch_size INTEGER DEFAULT 200000  -- POVEĆAN sa 10k/50k na 200k
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
    v_max_empty_chunks INTEGER := 10;  -- Povećan sa 5 na 10 jer su veći chunk-ovi
    v_total_records BIGINT;
BEGIN
    v_start_time := clock_timestamp();
    out_records_migrated := 0;

    -- Prvo prebroj ukupan broj zapisa za ovaj dan (brža varijanta sa EXPLAIN)
    SELECT COUNT(*) INTO v_total_records
    FROM gps_data
    WHERE time >= p_date::timestamp
      AND time < (p_date + INTERVAL '1 day')::timestamp;

    RAISE NOTICE 'Starting migration for date: %, total records: %', p_date, v_total_records;

    -- Procesuj dan u velikim chunk-ovima
    LOOP
        -- NEMA VIŠE HARDKODOVAN LIMIT!
        -- Prekidamo samo kada nema više podataka

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
                RAISE NOTICE 'No more data found after % empty chunks. Processed % of % records',
                    v_max_empty_chunks, v_daily_processed, v_total_records;
                EXIT;
            END IF;
        ELSE
            v_empty_chunks_in_row := 0;
        END IF;

        v_daily_processed := v_daily_processed + v_chunk_inserted;
        v_chunk_count := v_chunk_count + 1;

        -- Log progres svakih 5 chunk-ova (ređe jer su veći)
        IF v_chunk_count % 5 = 0 AND v_chunk_inserted > 0 THEN
            RAISE NOTICE 'Date %: Chunk % processed, % of % records (%.1f%%)',
                p_date, v_chunk_count, v_daily_processed, v_total_records,
                (v_daily_processed::numeric / NULLIF(v_total_records, 0)) * 100;
        END IF;

        v_offset := v_offset + p_batch_size;

        -- Dodatna optimizacija: prekini ako smo obradili sve
        IF v_daily_processed >= v_total_records THEN
            RAISE NOTICE 'All records processed for date %', p_date;
            EXIT;
        END IF;
    END LOOP;

    out_records_migrated := v_daily_processed;
    out_duration := clock_timestamp() - v_start_time;

    RAISE NOTICE 'Completed date %: % of % records in % (%.1f records/sec)',
        p_date, out_records_migrated, v_total_records, out_duration,
        out_records_migrated::numeric / NULLIF(EXTRACT(EPOCH FROM out_duration), 0);

END;
$$;

-- Glavna procedura koja poziva single day proceduru sa COMMIT-om
CREATE OR REPLACE PROCEDURE migrate_gps_data_by_date_range(
    p_start_date DATE,
    p_end_date DATE,
    p_batch_size INTEGER DEFAULT 200000  -- POVEĆAN default batch size
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
    RAISE NOTICE 'Batch size: % records', p_batch_size;
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
            'batch_size', p_batch_size,
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
        FORMAT('Starting migration from %s to %s (%s days, batch size: %s)',
               p_start_date, p_end_date, v_total_days, p_batch_size),
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

            -- Pozovi single day proceduru sa velikim batch size-om
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
-- Vrati stare verzije procedura (ne preporučuje se)
DROP PROCEDURE IF EXISTS migrate_single_day(DATE, OUT BIGINT, OUT INTERVAL, INTEGER);
DROP PROCEDURE IF EXISTS migrate_gps_data_by_date_range(DATE, DATE, INTEGER);