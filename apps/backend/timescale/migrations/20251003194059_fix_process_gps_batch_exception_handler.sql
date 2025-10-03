-- migrate:up
-- ==============================================================================
-- FIX: Exception handler u process_gps_batch funkciji
-- ==============================================================================
-- Problem: v_batch_id može biti NULL ako početni INSERT fail-uje
-- Rešenje: Proveri da li je v_batch_id NULL pre korišćenja
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
    -- FIX: Proveri da li je v_batch_id NULL
    IF v_batch_id IS NOT NULL THEN
        -- Update status u gps_processing_status
        UPDATE gps_processing_status
        SET
            status = 'failed',
            error_message = SQLERRM,
            processing_completed_at = NOW()
        WHERE id = v_batch_id;

        -- Log error sa batch_id
        INSERT INTO gps_processing_log(batch_id, log_level, message, details)
        VALUES (v_batch_id, 'error', 'Batch failed',
            jsonb_build_object('error', SQLERRM));
    ELSE
        -- Ako nemamo batch_id, samo logiraj bez foreign key reference
        -- Ovo će raditi jer batch_id može biti NULL u log tabeli
        INSERT INTO gps_processing_log(batch_id, log_level, message, details)
        VALUES (NULL, 'error', 'Batch creation failed',
            jsonb_build_object(
                'error', SQLERRM,
                'start_time', p_start_time,
                'end_time', p_end_time,
                'vehicle_id', p_vehicle_id
            ));
    END IF;

    RAISE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_gps_batch IS
'Glavna funkcija za batch procesiranje GPS podataka sa LAG() kalkulacijama.
Procesira podatke iz gps_data u gps_data_lag_filtered sa outlier detekcijom.
FIX: Exception handler sada proverava da li je batch_id NULL pre korišćenja.';

-- migrate:down
-- Vrati na prethodnu verziju (sa bugom)
-- Ova funkcija bi bila identična originalnoj verziji iz 20251003192450_create_process_gps_batch_functions.sql
-- Ali pošto je to kompleksna funkcija, samo ću ostaviti placeholder

-- DROP FUNCTION IF EXISTS process_gps_batch(timestamptz, timestamptz, integer, integer) CASCADE;
-- Zatim re-kreiraj originalnu verziju...