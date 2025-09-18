-- migrate:up
-- Finalna verzija paralelne timezone migracije
-- Ova migracija kreira sve potrebne funkcije samo ako ne postoje

-- ============================================
-- 1. PROVERI I KREIRAJ migrate_single_day AKO NE POSTOJI
-- ============================================
DO $$
BEGIN
    -- Proveri da li postoji bilo koja verzija funkcije/procedure
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'migrate_single_day'
    ) THEN
        -- Kreiraj novu optimizovanu proceduru
        CREATE PROCEDURE migrate_single_day(
            IN p_date DATE,
            OUT out_records_migrated BIGINT,
            OUT out_duration INTERVAL,
            IN p_batch_size INTEGER DEFAULT 400000
        )
        LANGUAGE plpgsql
        AS $proc$
        DECLARE
            v_start_time TIMESTAMP;
            v_last_processed_time TIMESTAMP;
            v_chunk_inserted INTEGER;
            v_daily_processed BIGINT := 0;
            v_empty_chunks_in_row INTEGER := 0;
            v_max_empty_chunks INTEGER := 3;
            v_start_ts TIMESTAMP;
            v_end_ts TIMESTAMP;
        BEGIN
            v_start_time := clock_timestamp();
            out_records_migrated := 0;
            v_start_ts := p_date::timestamp;
            v_end_ts := (p_date + INTERVAL '1 day')::timestamp;
            v_last_processed_time := v_start_ts - INTERVAL '1 second';

            RAISE NOTICE 'Starting optimized migration for date % (batch_size: %)', p_date, p_batch_size;

            LOOP
                INSERT INTO gps_data_fixed
                SELECT
                    time - INTERVAL '2 hours' as time,
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
                  AND time < v_end_ts
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
                    v_daily_processed := v_daily_processed + v_chunk_inserted;

                    SELECT MAX(time) INTO v_last_processed_time
                    FROM (
                        SELECT time
                        FROM gps_data
                        WHERE time > v_last_processed_time
                          AND time < v_end_ts
                        ORDER BY time
                        LIMIT p_batch_size
                    ) t;
                END IF;
            END LOOP;

            out_records_migrated := v_daily_processed;
            out_duration := clock_timestamp() - v_start_time;
            RAISE NOTICE 'Completed: % records in %', out_records_migrated, out_duration;
        END;
        $proc$;

        RAISE NOTICE 'Created migrate_single_day procedure';
    ELSE
        RAISE NOTICE 'migrate_single_day already exists';
    END IF;
END
$$;

-- ============================================
-- 2. PROVERI I KREIRAJ split_day_into_ranges AKO NE POSTOJI
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'split_day_into_ranges'
    ) THEN
        CREATE FUNCTION split_day_into_ranges(
            p_date DATE,
            p_parts INTEGER DEFAULT 4
        ) RETURNS TABLE (
            range_id INTEGER,
            range_name TEXT,
            start_time TIMESTAMP,
            end_time TIMESTAMP
        ) AS $func$
        DECLARE
            v_hours_per_part INTEGER;
            v_start_of_day TIMESTAMP;
            i INTEGER;
        BEGIN
            v_start_of_day := p_date::timestamp;
            v_hours_per_part := 24 / p_parts;

            FOR i IN 0..(p_parts - 1) LOOP
                range_id := i + 1;
                start_time := v_start_of_day + (i * v_hours_per_part * INTERVAL '1 hour');
                end_time := v_start_of_day + ((i + 1) * v_hours_per_part * INTERVAL '1 hour');
                range_name := format('Part_%s_%s:00-%s:00',
                    (i + 1)::text,
                    LPAD((i * v_hours_per_part)::text, 2, '0'),
                    LPAD(((i + 1) * v_hours_per_part)::text, 2, '0'));
                RETURN NEXT;
            END LOOP;
        END;
        $func$ LANGUAGE plpgsql;

        RAISE NOTICE 'Created split_day_into_ranges function';
    ELSE
        RAISE NOTICE 'split_day_into_ranges already exists';
    END IF;
END
$$;

-- ============================================
-- 3. PROVERI I KREIRAJ migrate_time_range AKO NE POSTOJI
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'migrate_time_range'
    ) THEN
        CREATE PROCEDURE migrate_time_range(
            IN p_start_time TIMESTAMP,
            IN p_end_time TIMESTAMP,
            IN p_range_name TEXT,
            OUT out_records_migrated BIGINT,
            OUT out_duration INTERVAL,
            IN p_batch_size INTEGER DEFAULT 400000
        )
        LANGUAGE plpgsql
        AS $proc$
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

            RAISE NOTICE '[%] Starting migration for range % to %',
                COALESCE(p_range_name, 'RANGE'), p_start_time, p_end_time;

            LOOP
                INSERT INTO gps_data_fixed
                SELECT
                    time - INTERVAL '2 hours' as time,
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

                    SELECT MAX(time) INTO v_last_processed_time
                    FROM (
                        SELECT time
                        FROM gps_data
                        WHERE time > v_last_processed_time
                          AND time < p_end_time
                        ORDER BY time
                        LIMIT p_batch_size
                    ) t;
                END IF;
            END LOOP;

            out_records_migrated := v_total_processed;
            out_duration := clock_timestamp() - v_start_time;

            INSERT INTO migration_log (
                migration_name,
                action,
                message,
                records_affected,
                duration_ms,
                created_at
            ) VALUES (
                'timezone_fix_2025',
                'RANGE_COMPLETED',
                format('[%s] Migrated range %s to %s',
                    COALESCE(p_range_name, 'RANGE'), p_start_time, p_end_time),
                v_total_processed,
                EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000,
                NOW()
            );
        END;
        $proc$;

        RAISE NOTICE 'Created migrate_time_range procedure';
    ELSE
        RAISE NOTICE 'migrate_time_range already exists';
    END IF;
END
$$;

-- ============================================
-- 4. PROVERI I KREIRAJ check_range_progress AKO NE POSTOJI
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'check_range_progress'
    ) THEN
        CREATE FUNCTION check_range_progress(p_date DATE)
        RETURNS TABLE (
            range_name TEXT,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            estimated_records BIGINT,
            migrated_records BIGINT,
            progress_percent NUMERIC
        ) AS $func$
        BEGIN
            RETURN QUERY
            WITH ranges AS (
                SELECT * FROM split_day_into_ranges(p_date, 4)
            ),
            source_counts AS (
                SELECT
                    r.range_name,
                    r.start_time,
                    r.end_time,
                    COUNT(*) as estimated_records
                FROM ranges r
                LEFT JOIN gps_data gd ON gd.time >= r.start_time AND gd.time < r.end_time
                GROUP BY r.range_name, r.start_time, r.end_time
            ),
            migrated_counts AS (
                SELECT
                    r.range_name,
                    COUNT(*) as migrated_records
                FROM ranges r
                LEFT JOIN gps_data_fixed gf
                    ON gf.time >= (r.start_time - INTERVAL '2 hours')
                    AND gf.time < (r.end_time - INTERVAL '2 hours')
                GROUP BY r.range_name
            )
            SELECT
                sc.range_name,
                sc.start_time,
                sc.end_time,
                sc.estimated_records,
                COALESCE(mc.migrated_records, 0) as migrated_records,
                CASE
                    WHEN sc.estimated_records > 0 THEN
                        ROUND((COALESCE(mc.migrated_records, 0)::numeric / sc.estimated_records) * 100, 2)
                    ELSE 0
                END as progress_percent
            FROM source_counts sc
            LEFT JOIN migrated_counts mc ON sc.range_name = mc.range_name
            ORDER BY sc.start_time;
        END;
        $func$ LANGUAGE plpgsql;

        RAISE NOTICE 'Created check_range_progress function';
    ELSE
        RAISE NOTICE 'check_range_progress already exists';
    END IF;
END
$$;

RAISE NOTICE 'Timezone parallel migration completed successfully!';

-- migrate:down
-- Ne briši funkcije jer su potrebne za aplikaciju