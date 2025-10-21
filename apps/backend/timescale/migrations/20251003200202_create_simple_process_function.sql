-- migrate:up
-- ==============================================================================
-- JEDNOSTAVNA VERZIJA process_gps_batch funkcije
-- ==============================================================================
-- Minimalna verzija koja radi bez komplikacija
-- ==============================================================================

-- Prvo, napravi jednostavnu verziju koja SAMO procesira podatke
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
    v_start_time timestamptz := clock_timestamp();
BEGIN
    -- Generiši unique batch timestamp
    v_batch_timestamp := extract(epoch from now())::bigint;

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

    RETURN QUERY
    SELECT
        v_rows_processed,
        v_outliers_detected,
        EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))::numeric;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_gps_batch_simple IS
'Jednostavna verzija batch procesiranja bez status tracking-a.
Samo procesira podatke i vraća rezultate.';

-- migrate:down
DROP FUNCTION IF EXISTS process_gps_batch_simple(timestamptz, timestamptz, integer) CASCADE;