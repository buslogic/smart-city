-- migrate:up
-- =====================================================
-- Poboljšanje praćenja progresa migracije
-- Datum: 16.09.2025
-- Cilj: Omogućiti real-time praćenje tokom migracije
-- =====================================================

-- Kreiraj novu proceduru koja ažurira status češće
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
    v_estimated_total BIGINT;
    v_chunk_count INTEGER := 0;
    v_chunk_size INTEGER := 10000;  -- Manji chunk za češće ažuriranje
    v_daily_processed BIGINT;
BEGIN
    RAISE NOTICE 'Starting migration from % to %', p_start_date, p_end_date;

    -- Računaj ukupan broj dana
    v_total_days := (p_end_date - p_start_date) + 1;

    -- Estimiraj ukupan broj zapisa (brža aproksimacija)
    -- Koristi prosek zapisa po danu umesto COUNT(*)
    v_estimated_total := v_total_days * 1400000;  -- Prosečno ~1.4M zapisa po danu

    -- Update početni status
    UPDATE migration_status
    SET
        status = 'running',
        started_at = NOW(),
        total_batches = v_total_days,
        current_batch = 0,
        total_records = v_estimated_total,
        records_processed = 0,
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{estimated_total}',
            to_jsonb(v_estimated_total)
        )
    WHERE migration_name = 'timezone_fix_2025';

    PERFORM log_migration_progress(
        'timezone_fix_2025',
        'MIGRATION_START',
        FORMAT('Starting migration from %s to %s (%s days, ~%s records)',
               p_start_date, p_end_date, v_total_days, v_estimated_total),
        NULL
    );

    -- Iteriraj kroz dane
    v_current_date := p_start_date;
    v_start_time := clock_timestamp();

    WHILE v_current_date <= p_end_date LOOP
        v_batch_time := clock_timestamp();
        v_current_day := v_current_day + 1;
        v_daily_processed := 0;

        RAISE NOTICE 'Processing date: %', v_current_date;

        -- Procesuj dan u manjim chunk-ovima za češće ažuriranje
        DECLARE
            v_offset INTEGER := 0;
            v_chunk_inserted INTEGER;
            v_empty_chunks_in_row INTEGER := 0;
            v_max_empty_chunks INTEGER := 5; -- Prekini nakon 5 praznih chunk-ova zaredom
        BEGIN
            LOOP
                -- Prekini ako je offset prevelik (optimizacija)
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
                WHERE time >= v_current_date::timestamp
                  AND time < (v_current_date + INTERVAL '1 day')::timestamp
                ORDER BY time
                LIMIT v_chunk_size
                OFFSET v_offset
                ON CONFLICT (time, vehicle_id) DO NOTHING;

                GET DIAGNOSTICS v_chunk_inserted = ROW_COUNT;

                -- Praćenje praznih chunk-ova
                IF v_chunk_inserted = 0 THEN
                    v_empty_chunks_in_row := v_empty_chunks_in_row + 1;
                    -- Ako ima previše praznih chunk-ova zaredom, verovatno nema više podataka
                    IF v_empty_chunks_in_row >= v_max_empty_chunks THEN
                        EXIT;
                    END IF;
                ELSE
                    v_empty_chunks_in_row := 0; -- Reset counter kada nađemo podatke
                END IF;

                -- Ažuriraj brojače
                v_daily_processed := v_daily_processed + v_chunk_inserted;
                v_total_migrated := v_total_migrated + v_chunk_inserted;
                v_chunk_count := v_chunk_count + 1;

                -- Ažuriraj status nakon svakog chunk-a za real-time progres
                UPDATE migration_status
                SET
                    records_processed = v_total_migrated,
                    processing_date = v_current_date,
                    last_update = NOW(),
                    metadata = jsonb_set(
                        jsonb_set(
                            jsonb_set(
                                COALESCE(metadata, '{}'::jsonb),
                                '{current_chunk}',
                                to_jsonb(v_chunk_count)
                            ),
                            '{chunks_per_second}',
                            to_jsonb(ROUND(v_chunk_count::numeric /
                                    NULLIF(EXTRACT(EPOCH FROM clock_timestamp() - v_start_time), 0), 2))
                        ),
                        '{last_chunk_size}',
                        to_jsonb(v_chunk_inserted)
                    )
                WHERE migration_name = 'timezone_fix_2025';

                -- Log progres svakih 5 chunk-ova (češće jer su manji)
                IF v_chunk_count % 5 = 0 AND v_chunk_count > 0 THEN
                    RAISE NOTICE 'Progress: Day % - % records migrated (% %% of estimated)',
                        v_current_day,
                        v_total_migrated,
                        ROUND((v_total_migrated::numeric / NULLIF(v_estimated_total, 0)) * 100, 2);
                END IF;

                v_offset := v_offset + v_chunk_size;
            END LOOP;
        END;

        v_daily_count := v_daily_processed;

        -- Log završetak dana
        PERFORM log_migration_progress(
            'timezone_fix_2025',
            'DAY_COMPLETED',
            FORMAT('Date %s migrated: %s records (%s sec)',
                   v_current_date,
                   v_daily_count,
                   ROUND(EXTRACT(EPOCH FROM clock_timestamp() - v_batch_time)::numeric, 2)),
            v_daily_count::INTEGER
        );

        -- Update status sa završenim danom
        UPDATE migration_status
        SET
            current_batch = v_current_day,
            records_processed = v_total_migrated,
            processing_date = v_current_date,
            last_update = NOW()
        WHERE migration_name = 'timezone_fix_2025';

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

    RAISE NOTICE 'Migration completed: % records in %', v_total_migrated, clock_timestamp() - v_start_time;

EXCEPTION WHEN OTHERS THEN
    -- U slučaju greške
    UPDATE migration_status
    SET
        status = 'error',
        error_message = SQLERRM,
        last_update = NOW()
    WHERE migration_name = 'timezone_fix_2025';

    PERFORM log_migration_progress(
        'timezone_fix_2025',
        'ERROR',
        FORMAT('Migration failed: %s', SQLERRM),
        NULL
    );

    RAISE;
END;
$$;

-- migrate:down
-- Vrati staru verziju procedure
DROP PROCEDURE IF EXISTS migrate_gps_data_by_date_range(DATE, DATE, INTEGER);
