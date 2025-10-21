-- migrate:up
-- ==============================================================================
-- BATCH PROCESSING FUNCTIONS
-- ==============================================================================
-- Funkcije za batch procesiranje GPS podataka iz gps_data u gps_data_lag_filtered
-- sa LAG() kalkulacijama i outlier detekcijom
-- ==============================================================================

-- ==============================================================================
-- GLAVNA PROCESSING FUNKCIJA
-- ==============================================================================
CREATE OR REPLACE FUNCTION process_gps_batch(
    p_start_time timestamptz,
    p_end_time timestamptz,
    p_vehicle_id integer DEFAULT NULL,
    p_batch_size integer DEFAULT 100000
) RETURNS TABLE(
    batch_id integer,
    status text,
    rows_processed bigint,
    outliers_detected bigint,
    duration_seconds numeric
) AS $$
DECLARE
    v_batch_id integer;
    v_batch_timestamp bigint;
    v_rows_processed bigint := 0;
    v_outliers_detected bigint := 0;
    v_start_time timestamptz := clock_timestamp();
    v_expected_rows bigint;
BEGIN
    -- Kreiraj batch entry
    INSERT INTO gps_processing_status(
        start_time, end_time, vehicle_id, batch_type, status
    ) VALUES (
        p_start_time, p_end_time, p_vehicle_id, 'time', 'processing'
    )
    ON CONFLICT (start_time, end_time, vehicle_id)
    DO UPDATE SET
        status = 'processing',
        processing_started_at = NOW(),
        retry_count = gps_processing_status.retry_count + 1
    RETURNING id INTO v_batch_id;

    -- Generiši unique batch timestamp
    v_batch_timestamp := extract(epoch from now())::bigint;

    -- Proveri koliko ima redova za procesiranje
    SELECT COUNT(*) INTO v_expected_rows
    FROM gps_data g
    WHERE
        g.time >= p_start_time
        AND g.time < p_end_time
        AND (p_vehicle_id IS NULL OR g.vehicle_id = p_vehicle_id)
        AND NOT EXISTS (
            SELECT 1 FROM gps_data_lag_filtered f
            WHERE f.time = g.time AND f.vehicle_id = g.vehicle_id
        );

    -- Ažuriraj očekivani broj redova
    UPDATE gps_processing_status
    SET total_rows_expected = v_expected_rows
    WHERE id = v_batch_id;

    -- Ako nema podataka, završi
    IF v_expected_rows = 0 THEN
        UPDATE gps_processing_status
        SET
            status = 'completed',
            processing_completed_at = NOW(),
            rows_processed = 0
        WHERE id = v_batch_id;

        RETURN QUERY
        SELECT
            v_batch_id,
            'completed'::text,
            0::bigint,
            0::bigint,
            0::numeric;
        RETURN;
    END IF;

    -- Glavni INSERT sa LAG() logikom
    WITH lag_calc AS (
        SELECT
            g.*,
            LAG(location) OVER w as prev_location,
            LAG(time) OVER w as prev_time,

            -- Distanca u metrima
            CASE
                WHEN LAG(location) OVER w IS NOT NULL
                THEN ST_Distance(
                    location::geography,
                    LAG(location) OVER w::geography
                )
                ELSE 0
            END as distance_m,

            -- Vreme između tačaka
            time - LAG(time) OVER w as time_diff,

            -- Brzina km/h
            CASE
                WHEN LAG(time) OVER w IS NOT NULL
                    AND (time - LAG(time) OVER w) > interval '0'
                THEN (
                    ST_Distance(
                        location::geography,
                        LAG(location) OVER w::geography
                    ) / EXTRACT(EPOCH FROM (time - LAG(time) OVER w))
                ) * 3.6
                ELSE 0
            END as calc_speed_kmh

        FROM gps_data g
        WHERE
            g.time >= p_start_time
            AND g.time < p_end_time
            AND (p_vehicle_id IS NULL OR g.vehicle_id = p_vehicle_id)
            AND NOT EXISTS (
                SELECT 1 FROM gps_data_lag_filtered f
                WHERE f.time = g.time AND f.vehicle_id = g.vehicle_id
            )
        WINDOW w AS (PARTITION BY vehicle_id ORDER BY time)
    )
    INSERT INTO gps_data_lag_filtered (
        time, vehicle_id, garage_no, lat, lng, location, speed,
        course, alt, state, in_route, line_number, departure_id,
        people_in, people_out, data_source,
        prev_location, prev_time, distance_from_prev, time_from_prev,
        calculated_speed_kmh, is_outlier, outlier_type, outlier_severity,
        batch_id, processed_at, processing_version
    )
    SELECT
        time, vehicle_id, garage_no, lat, lng, location, speed,
        course, alt, state, in_route, line_number, departure_id,
        people_in, people_out, data_source,
        prev_location, prev_time, distance_m, time_diff, calc_speed_kmh,

        -- Outlier detekcija
        CASE
            WHEN distance_m > 500 THEN true        -- 500m jump
            WHEN calc_speed_kmh > 150 THEN true    -- 150 km/h
            WHEN distance_m > 200 AND time_diff < interval '3 seconds' THEN true
            ELSE false
        END as is_outlier,

        -- Outlier type
        CASE
            WHEN distance_m > 500 THEN 'distance_jump'
            WHEN calc_speed_kmh > 150 THEN 'speed_spike'
            WHEN distance_m > 200 AND time_diff < interval '3 seconds' THEN 'teleport'
            ELSE NULL
        END as outlier_type,

        -- Severity
        CASE
            WHEN distance_m > 1000 OR calc_speed_kmh > 200 THEN 'high'
            WHEN distance_m > 500 OR calc_speed_kmh > 150 THEN 'medium'
            WHEN distance_m > 300 OR calc_speed_kmh > 120 THEN 'low'
            ELSE NULL
        END as outlier_severity,

        v_batch_timestamp as batch_id,
        NOW() as processed_at,
        1 as processing_version

    FROM lag_calc;

    GET DIAGNOSTICS v_rows_processed = ROW_COUNT;

    -- Broj outlier-a
    SELECT COUNT(*) INTO v_outliers_detected
    FROM gps_data_lag_filtered
    WHERE batch_id = v_batch_timestamp AND is_outlier = true;

    -- Update final status
    UPDATE gps_processing_status
    SET
        status = 'completed',
        processing_completed_at = NOW(),
        rows_processed = v_rows_processed,
        rows_filtered = v_outliers_detected
    WHERE id = v_batch_id;

    -- Log u processing_log
    INSERT INTO gps_processing_log(batch_id, log_level, message, details)
    VALUES (v_batch_id, 'info', 'Batch completed successfully',
        jsonb_build_object(
            'rows_processed', v_rows_processed,
            'outliers_detected', v_outliers_detected,
            'duration_seconds', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))
        ));

    RETURN QUERY
    SELECT
        v_batch_id,
        'completed'::text,
        v_rows_processed,
        v_outliers_detected,
        EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))::numeric;

EXCEPTION WHEN OTHERS THEN
    -- Error handling
    UPDATE gps_processing_status
    SET
        status = 'failed',
        error_message = SQLERRM,
        processing_completed_at = NOW()
    WHERE id = v_batch_id;

    INSERT INTO gps_processing_log(batch_id, log_level, message, details)
    VALUES (v_batch_id, 'error', 'Batch failed',
        jsonb_build_object('error', SQLERRM));

    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- FIND NEXT BATCH TO PROCESS
-- ==============================================================================
CREATE OR REPLACE FUNCTION find_next_batch_to_process()
RETURNS TABLE(
    start_time timestamptz,
    end_time timestamptz,
    estimated_rows bigint
) AS $$
BEGIN
    RETURN QUERY
    WITH last_processed AS (
        -- Nađi poslednji uspešno procesiran batch
        SELECT MAX(end_time) as last_time
        FROM gps_processing_status
        WHERE status = 'completed'
    ),
    next_batch AS (
        SELECT
            COALESCE(
                (SELECT last_time FROM last_processed),
                (SELECT MIN(time)::date FROM gps_data WHERE time >= '2025-09-01')
            ) as batch_start,
            LEAST(
                COALESCE(
                    (SELECT last_time FROM last_processed),
                    (SELECT MIN(time)::date FROM gps_data WHERE time >= '2025-09-01')
                ) + interval '1 hour',
                NOW()
            ) as batch_end
    )
    SELECT
        nb.batch_start,
        nb.batch_end,
        (SELECT COUNT(*)
         FROM gps_data
         WHERE time >= nb.batch_start
           AND time < nb.batch_end
           AND NOT EXISTS (
               SELECT 1 FROM gps_data_lag_filtered f
               WHERE f.time = gps_data.time
               AND f.vehicle_id = gps_data.vehicle_id
           )) as estimated_rows
    FROM next_batch nb
    WHERE nb.batch_start < NOW() - interval '5 minutes';  -- Ne procesirati najnovije podatke
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- RETRY FAILED BATCHES
-- ==============================================================================
CREATE OR REPLACE FUNCTION retry_failed_batches(
    p_max_retries integer DEFAULT 3
) RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT * FROM gps_processing_status
        WHERE status = 'failed'
          AND retry_count < p_max_retries
        ORDER BY start_time
    LOOP
        -- Log retry attempt
        INSERT INTO gps_processing_log(batch_id, log_level, message)
        VALUES (r.id, 'info', 'Retrying failed batch');

        -- Pokreni ponovo
        PERFORM process_gps_batch(r.start_time, r.end_time, r.vehicle_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- VALIDATE PROCESSING FOR A DATE
-- ==============================================================================
CREATE OR REPLACE FUNCTION validate_processing(
    p_date date
) RETURNS TABLE(
    check_name text,
    status text,
    details jsonb
) AS $$
BEGIN
    -- Check 1: All raw data processed
    RETURN QUERY
    SELECT
        'Raw data coverage'::text,
        CASE
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END,
        jsonb_build_object(
            'missing_count', COUNT(*),
            'sample_times', (array_agg(time ORDER BY time))[1:10]
        )
    FROM gps_data g
    WHERE
        DATE(time AT TIME ZONE 'Europe/Belgrade') = p_date
        AND NOT EXISTS (
            SELECT 1 FROM gps_data_lag_filtered f
            WHERE f.time = g.time AND f.vehicle_id = g.vehicle_id
        );

    -- Check 2: Outlier rate reasonable
    RETURN QUERY
    WITH outlier_stats AS (
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_outlier) as outliers
        FROM gps_data_lag_filtered
        WHERE DATE(time AT TIME ZONE 'Europe/Belgrade') = p_date
    )
    SELECT
        'Outlier rate'::text,
        CASE
            WHEN total = 0 THEN 'NO_DATA'
            WHEN outliers::numeric / total * 100 < 10 THEN 'PASS'
            ELSE 'WARNING'
        END,
        jsonb_build_object(
            'total_points', total,
            'outliers', outliers,
            'rate_percent', CASE
                WHEN total > 0 THEN ROUND(outliers::numeric / total * 100, 2)
                ELSE 0
            END
        )
    FROM outlier_stats;

    -- Check 3: Processing completeness
    RETURN QUERY
    SELECT
        'Processing completeness'::text,
        CASE
            WHEN COUNT(*) > 0 THEN 'PASS'
            ELSE 'FAIL'
        END,
        jsonb_build_object(
            'total_batches', COUNT(*),
            'completed', COUNT(*) FILTER (WHERE status = 'completed'),
            'failed', COUNT(*) FILTER (WHERE status = 'failed')
        )
    FROM gps_processing_status
    WHERE DATE(start_time AT TIME ZONE 'Europe/Belgrade') = p_date
       OR DATE(end_time AT TIME ZONE 'Europe/Belgrade') = p_date;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- CLEANUP OLD PROCESSING LOGS
-- ==============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_processing_logs(
    p_days_to_keep integer DEFAULT 30
) RETURNS void AS $$
BEGIN
    -- Briši stare logove
    DELETE FROM gps_processing_log
    WHERE log_time < NOW() - (p_days_to_keep || ' days')::interval;

    -- Briši stare failed batch-eve
    DELETE FROM gps_processing_status
    WHERE status = 'failed'
      AND processing_completed_at < NOW() - (p_days_to_keep || ' days')::interval
      AND retry_count >= 3;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PROCESSING STATISTICS FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_processing_stats(
    p_start_date date DEFAULT CURRENT_DATE - 7,
    p_end_date date DEFAULT CURRENT_DATE
) RETURNS TABLE(
    date date,
    total_batches bigint,
    completed_batches bigint,
    failed_batches bigint,
    total_rows bigint,
    total_outliers bigint,
    avg_processing_time_seconds numeric,
    outlier_percentage numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(ps.start_time AT TIME ZONE 'Europe/Belgrade') as date,
        COUNT(*) as total_batches,
        COUNT(*) FILTER (WHERE ps.status = 'completed') as completed_batches,
        COUNT(*) FILTER (WHERE ps.status = 'failed') as failed_batches,
        SUM(ps.rows_processed) as total_rows,
        SUM(ps.rows_filtered) as total_outliers,
        AVG(EXTRACT(EPOCH FROM (ps.processing_completed_at - ps.processing_started_at)))::numeric(10,2) as avg_processing_time_seconds,
        CASE
            WHEN SUM(ps.rows_processed) > 0
            THEN ROUND((SUM(ps.rows_filtered)::numeric / SUM(ps.rows_processed) * 100), 2)
            ELSE 0
        END as outlier_percentage
    FROM gps_processing_status ps
    WHERE DATE(ps.start_time AT TIME ZONE 'Europe/Belgrade') BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(ps.start_time AT TIME ZONE 'Europe/Belgrade')
    ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- GRANTS (ako treba)
-- ==============================================================================
-- GRANT EXECUTE ON FUNCTION process_gps_batch TO gps_processor;
-- GRANT EXECUTE ON FUNCTION find_next_batch_to_process TO gps_processor;

COMMENT ON FUNCTION process_gps_batch IS
'Glavna funkcija za batch procesiranje GPS podataka sa LAG() kalkulacijama.
Procesira podatke iz gps_data u gps_data_lag_filtered sa outlier detekcijom.';

COMMENT ON FUNCTION find_next_batch_to_process IS
'Pronalazi sledeći batch za procesiranje na osnovu poslednjeg uspešnog batch-a.';

COMMENT ON FUNCTION retry_failed_batches IS
'Ponovo pokreće neuspešne batch-eve do maksimalnog broja pokušaja.';

-- migrate:down
DROP FUNCTION IF EXISTS get_processing_stats(date, date) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_processing_logs(integer) CASCADE;
DROP FUNCTION IF EXISTS validate_processing(date) CASCADE;
DROP FUNCTION IF EXISTS retry_failed_batches(integer) CASCADE;
DROP FUNCTION IF EXISTS find_next_batch_to_process() CASCADE;
DROP FUNCTION IF EXISTS process_gps_batch(timestamptz, timestamptz, integer, integer) CASCADE;

