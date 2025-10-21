-- migrate:up
-- ==============================================================================
-- FIX OUTLIER FILTERING - ISKLJUČI OUTLIERE IZ INSERTA
-- ==============================================================================
-- PROBLEM: Trenutno se SVI GPS podaci upisuju u gps_data_lag_filtered tabelu
--          sa is_outlier flagom. Outlieri treba da budu POTPUNO ISKLJUČENI.
--
-- REŠENJE: Dodaj WHERE filter na INSERT koji isključuje redove gde je is_outlier = true
-- ==============================================================================

-- 1. Ispravi process_gps_batch funkciju
-- Prvo DROP pa CREATE zbog potencijalnih dependency problema
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

    -- Glavni INSERT sa LAG() logikom i outlier detekcijom
    -- BITNO: Outlieri se ISKLJUČUJU iz inserta pomoću WHERE filtera
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
    ),
    outlier_calc AS (
        -- Kalkuliši outlier flag za svaki red
        SELECT
            *,
            CASE
                WHEN distance_m > 500 THEN true        -- 500m jump
                WHEN calc_speed_kmh > 150 THEN true    -- 150 km/h
                WHEN distance_m > 200 AND time_diff < interval '3 seconds' THEN true
                ELSE false
            END as is_outlier_flag,

            CASE
                WHEN distance_m > 500 THEN 'distance_jump'
                WHEN calc_speed_kmh > 150 THEN 'speed_spike'
                WHEN distance_m > 200 AND time_diff < interval '3 seconds' THEN 'teleport'
                ELSE NULL
            END as outlier_type_val,

            CASE
                WHEN distance_m > 1000 OR calc_speed_kmh > 200 THEN 'high'
                WHEN distance_m > 500 OR calc_speed_kmh > 150 THEN 'medium'
                WHEN distance_m > 300 OR calc_speed_kmh > 120 THEN 'low'
                ELSE NULL
            END as outlier_severity_val
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
        false as is_outlier,  -- Svi upisani redovi su validni
        NULL as outlier_type,
        NULL as outlier_severity,
        v_batch_timestamp as batch_id,
        NOW() as processed_at,
        1 as processing_version
    FROM outlier_calc
    WHERE NOT is_outlier_flag;  -- KLJUČNI FILTER: Isključi outliere!

    GET DIAGNOSTICS v_rows_processed = ROW_COUNT;

    -- Broj outlier-a = total rows - processed rows
    v_outliers_detected := v_expected_rows - v_rows_processed;

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
        processing_completed_at = NOW(),
        error_message = SQLERRM
    WHERE id = v_batch_id;

    RETURN QUERY
    SELECT
        v_batch_id,
        'failed'::text,
        0::bigint,
        0::bigint,
        0::numeric;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_gps_batch IS
'Procesira GPS batch podatke sa LAG() kalkulacijama i outlier detekcijom.
VAŽNO: Outlieri se ISKLJUČUJU iz inserta - samo validni podaci se upisuju u gps_data_lag_filtered.';

-- 2. Ispravi process_gps_batch_simple funkciju
-- Prvo DROP pa CREATE zbog potencijalnih dependency problema
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
    -- Generiši unique batch timestamp
    v_batch_timestamp := extract(epoch from now())::bigint;

    -- Prebrojimo ukupan broj redova koji treba da se procesira
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

    -- Glavni INSERT sa LAG() logikom i outlier detekcijom
    -- BITNO: Outlieri se ISKLJUČUJU iz inserta pomoću WHERE filtera
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
    ),
    outlier_calc AS (
        -- Kalkuliši outlier flag za svaki red
        SELECT
            *,
            CASE
                WHEN distance_m > 500 THEN true        -- 500m jump
                WHEN calc_speed_kmh > 150 THEN true    -- 150 km/h
                WHEN distance_m > 200 AND time_diff < interval '3 seconds' THEN true
                ELSE false
            END as is_outlier_flag,

            CASE
                WHEN distance_m > 500 THEN 'distance_jump'
                WHEN calc_speed_kmh > 150 THEN 'speed_spike'
                WHEN distance_m > 200 AND time_diff < interval '3 seconds' THEN 'teleport'
                ELSE NULL
            END as outlier_type_val,

            CASE
                WHEN distance_m > 1000 OR calc_speed_kmh > 200 THEN 'high'
                WHEN distance_m > 500 OR calc_speed_kmh > 150 THEN 'medium'
                WHEN distance_m > 300 OR calc_speed_kmh > 120 THEN 'low'
                ELSE NULL
            END as outlier_severity_val
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
        false as is_outlier,  -- Svi upisani redovi su validni
        NULL as outlier_type,
        NULL as outlier_severity,
        v_batch_timestamp as batch_id,
        NOW() as processed_at,
        1 as processing_version
    FROM outlier_calc
    WHERE NOT is_outlier_flag;  -- KLJUČNI FILTER: Isključi outliere!

    GET DIAGNOSTICS v_rows_processed = ROW_COUNT;

    -- Broj outlier-a = total rows - processed rows
    v_outliers_detected := v_expected_rows - v_rows_processed;

    RETURN QUERY
    SELECT
        v_rows_processed,
        v_outliers_detected,
        EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))::numeric;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_gps_batch_simple IS
'Jednostavna verzija batch procesiranja bez status tracking-a.
VAŽNO: Outlieri se ISKLJUČUJU iz inserta - samo validni podaci se upisuju u gps_data_lag_filtered.';

-- migrate:down
-- Vraćamo stare verzije funkcija (bez outlier filtriranja)
-- Ne implementiramo down migraciju jer ne želimo da se vrati bug
