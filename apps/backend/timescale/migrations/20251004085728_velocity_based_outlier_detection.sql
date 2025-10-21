-- migrate:up
-- ==============================================================================
-- VELOCITY-BASED OUTLIER DETECTION
-- ==============================================================================
-- PROBLEM:
-- Fiksni pragovi (500m, 150km/h) brišu ispravne tačke tokom GPS bounce-a
--
-- REŠENJE:
-- Koristi rolling average brzine kao kontekst za validaciju
-- Očekivana_distanca = avg_brzina × vreme × buffer(2x)
-- Outlier = distanca > očekivana_distanca AND distanca > 500m
-- Čuva tačke blizu rute čak i tokom GPS bounce-a
-- ==============================================================================

-- 1. Ispravi process_gps_batch funkciju
DROP FUNCTION IF EXISTS process_gps_batch(timestamptz, timestamptz, integer, integer) CASCADE;

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

    v_batch_timestamp := extract(epoch from now())::bigint;

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

    UPDATE gps_processing_status
    SET total_rows_expected = v_expected_rows
    WHERE id = v_batch_id;

    IF v_expected_rows = 0 THEN
        UPDATE gps_processing_status
        SET status = 'completed', processing_completed_at = NOW(), rows_processed = 0
        WHERE id = v_batch_id;

        RETURN QUERY
        SELECT v_batch_id, 'completed'::text, 0::bigint, 0::bigint, 0::numeric;
        RETURN;
    END IF;

    -- Velocity-based validacija
    WITH lag_calc AS (
        SELECT
            g.*,
            LAG(location) OVER w as prev_location,
            LAG(time) OVER w as prev_time,
            CASE
                WHEN LAG(location) OVER w IS NOT NULL
                THEN ST_Distance(location::geography, LAG(location) OVER w::geography)
                ELSE 0
            END as distance_m,
            time - LAG(time) OVER w as time_diff,
            CASE
                WHEN LAG(time) OVER w IS NOT NULL AND (time - LAG(time) OVER w) > interval '0'
                THEN (ST_Distance(location::geography, LAG(location) OVER w::geography) / EXTRACT(EPOCH FROM (time - LAG(time) OVER w))) * 3.6
                ELSE 0
            END as calc_speed_kmh,
            AVG(
                CASE
                    WHEN LAG(time) OVER w IS NOT NULL AND (time - LAG(time) OVER w) > interval '0'
                    THEN (ST_Distance(location::geography, LAG(location) OVER w::geography) / EXTRACT(EPOCH FROM (time - LAG(time) OVER w))) * 3.6
                    ELSE NULL
                END
            ) OVER (PARTITION BY vehicle_id ORDER BY time ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) as avg_speed_last_5
        FROM gps_data g
        WHERE
            g.time >= p_start_time
            AND g.time < p_end_time
            AND (p_vehicle_id IS NULL OR g.vehicle_id = p_vehicle_id)
            AND NOT EXISTS (SELECT 1 FROM gps_data_lag_filtered f WHERE f.time = g.time AND f.vehicle_id = g.vehicle_id)
        WINDOW w AS (PARTITION BY vehicle_id ORDER BY time)
    ),
    outlier_calc AS (
        SELECT *,
            CASE
                WHEN avg_speed_last_5 IS NOT NULL AND avg_speed_last_5 > 0 AND time_diff > interval '0'
                     AND distance_m > (avg_speed_last_5 / 3.6) * EXTRACT(EPOCH FROM time_diff) * 2.0
                     AND distance_m > 500
                THEN true
                WHEN calc_speed_kmh > 150 THEN true
                WHEN distance_m > 1500 THEN true
                ELSE false
            END as is_outlier_flag
        FROM lag_calc
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
        false, NULL, NULL,
        v_batch_timestamp, NOW(), 3
    FROM outlier_calc
    WHERE NOT is_outlier_flag;

    GET DIAGNOSTICS v_rows_processed = ROW_COUNT;
    v_outliers_detected := v_expected_rows - v_rows_processed;

    UPDATE gps_processing_status
    SET status = 'completed', processing_completed_at = NOW(),
        rows_processed = v_rows_processed, rows_filtered = v_outliers_detected
    WHERE id = v_batch_id;

    INSERT INTO gps_processing_log(batch_id, log_level, message, details)
    VALUES (v_batch_id, 'info', 'Batch completed successfully',
        jsonb_build_object('rows_processed', v_rows_processed, 'outliers_detected', v_outliers_detected,
            'duration_seconds', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)), 'processing_version', 3));

    RETURN QUERY
    SELECT v_batch_id, 'completed'::text, v_rows_processed, v_outliers_detected,
        EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))::numeric;

EXCEPTION WHEN OTHERS THEN
    UPDATE gps_processing_status
    SET status = 'failed', processing_completed_at = NOW(), error_message = SQLERRM
    WHERE id = v_batch_id;
    RETURN QUERY SELECT v_batch_id, 'failed'::text, 0::bigint, 0::bigint, 0::numeric;
END;
$$ LANGUAGE plpgsql;

-- 2. Ispravi process_gps_batch_simple funkciju
DROP FUNCTION IF EXISTS process_gps_batch_simple(timestamptz, timestamptz, integer) CASCADE;

CREATE OR REPLACE FUNCTION process_gps_batch_simple(
    p_start_time timestamptz,
    p_end_time timestamptz,
    p_vehicle_id integer DEFAULT NULL
) RETURNS TABLE(
    rows_processed bigint,
    outliers_detected bigint,
    duration_seconds numeric
) AS $$
DECLARE
    v_batch_timestamp bigint;
    v_rows_processed bigint := 0;
    v_outliers_detected bigint := 0;
    v_expected_rows bigint := 0;
    v_start_time timestamptz := clock_timestamp();
BEGIN
    v_batch_timestamp := extract(epoch from now())::bigint;

    SELECT COUNT(*) INTO v_expected_rows
    FROM gps_data g
    WHERE
        g.time >= p_start_time AND g.time < p_end_time
        AND (p_vehicle_id IS NULL OR g.vehicle_id = p_vehicle_id)
        AND NOT EXISTS (SELECT 1 FROM gps_data_lag_filtered f WHERE f.time = g.time AND f.vehicle_id = g.vehicle_id);

    WITH lag_calc AS (
        SELECT
            g.*,
            LAG(location) OVER w as prev_location,
            LAG(time) OVER w as prev_time,
            CASE WHEN LAG(location) OVER w IS NOT NULL
                THEN ST_Distance(location::geography, LAG(location) OVER w::geography) ELSE 0 END as distance_m,
            time - LAG(time) OVER w as time_diff,
            CASE WHEN LAG(time) OVER w IS NOT NULL AND (time - LAG(time) OVER w) > interval '0'
                THEN (ST_Distance(location::geography, LAG(location) OVER w::geography) / EXTRACT(EPOCH FROM (time - LAG(time) OVER w))) * 3.6 ELSE 0 END as calc_speed_kmh,
            AVG(CASE WHEN LAG(time) OVER w IS NOT NULL AND (time - LAG(time) OVER w) > interval '0'
                THEN (ST_Distance(location::geography, LAG(location) OVER w::geography) / EXTRACT(EPOCH FROM (time - LAG(time) OVER w))) * 3.6 ELSE NULL END
            ) OVER (PARTITION BY vehicle_id ORDER BY time ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) as avg_speed_last_5
        FROM gps_data g
        WHERE g.time >= p_start_time AND g.time < p_end_time
            AND (p_vehicle_id IS NULL OR g.vehicle_id = p_vehicle_id)
            AND NOT EXISTS (SELECT 1 FROM gps_data_lag_filtered f WHERE f.time = g.time AND f.vehicle_id = g.vehicle_id)
        WINDOW w AS (PARTITION BY vehicle_id ORDER BY time)
    ),
    outlier_calc AS (
        SELECT *,
            CASE
                WHEN avg_speed_last_5 IS NOT NULL AND avg_speed_last_5 > 0 AND time_diff > interval '0'
                     AND distance_m > (avg_speed_last_5 / 3.6) * EXTRACT(EPOCH FROM time_diff) * 2.0 AND distance_m > 500
                THEN true
                WHEN calc_speed_kmh > 150 THEN true
                WHEN distance_m > 1500 THEN true
                ELSE false
            END as is_outlier_flag
        FROM lag_calc
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
        false, NULL, NULL, v_batch_timestamp, NOW(), 3
    FROM outlier_calc
    WHERE NOT is_outlier_flag;

    GET DIAGNOSTICS v_rows_processed = ROW_COUNT;
    v_outliers_detected := v_expected_rows - v_rows_processed;

    RETURN QUERY SELECT v_rows_processed, v_outliers_detected, EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))::numeric;
END;
$$ LANGUAGE plpgsql;

-- migrate:down
