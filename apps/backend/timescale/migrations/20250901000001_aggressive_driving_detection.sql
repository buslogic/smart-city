-- migrate:up
-- Dodaje funkcionalnost za detekciju agresivne vožnje

-- 1. Dodaj kolone koje nedostaju u driving_events tabeli
ALTER TABLE driving_events 
ADD COLUMN IF NOT EXISTS acceleration_value DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS g_force DOUBLE PRECISION;

-- 2. Kreiraj funkciju za batch detekciju agresivne vožnje
CREATE OR REPLACE FUNCTION detect_aggressive_driving_batch(
    p_vehicle_id INTEGER,
    p_garage_no VARCHAR,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
) RETURNS TABLE(
    total_events INTEGER,
    acceleration_events INTEGER,
    braking_events INTEGER,
    moderate_events INTEGER,
    severe_events INTEGER
) AS $$
DECLARE
    v_inserted_count INTEGER := 0;
    v_actual_vehicle_id INTEGER;
BEGIN
    -- Koristi prosleđeni vehicle_id
    v_actual_vehicle_id := p_vehicle_id;
    
    -- Analiziraj GPS podatke i detektuj agresivnu vožnju
    WITH speed_analysis AS (
        SELECT 
            time,
            garage_no,
            speed,
            lat,
            lng,
            location,
            LAG(speed) OVER (PARTITION BY garage_no ORDER BY time) as prev_speed,
            LAG(time) OVER (PARTITION BY garage_no ORDER BY time) as prev_time,
            LAG(location) OVER (PARTITION BY garage_no ORDER BY time) as prev_location
        FROM gps_data
        WHERE garage_no = p_garage_no
            AND time BETWEEN p_start_time AND p_end_time
            AND speed IS NOT NULL
            AND speed > 0
        ORDER BY time
    ),
    events AS (
        SELECT 
            time,
            garage_no,
            speed,
            prev_speed,
            lat,
            lng,
            location,
            EXTRACT(EPOCH FROM (time - prev_time)) as time_diff,
            -- Računaj ubrzanje u m/s^2
            CASE 
                WHEN prev_speed IS NOT NULL AND EXTRACT(EPOCH FROM (time - prev_time)) > 0 THEN
                    ((speed - prev_speed) * 0.27778) / EXTRACT(EPOCH FROM (time - prev_time))
                ELSE NULL
            END as acceleration_ms2
        FROM speed_analysis
        WHERE prev_time IS NOT NULL
            AND EXTRACT(EPOCH FROM (time - prev_time)) BETWEEN 1 AND 30
    ),
    detected_events AS (
        SELECT
            time,
            v_actual_vehicle_id as vehicle_id,
            garage_no,
            CASE 
                WHEN acceleration_ms2 > 2.5 THEN 'harsh_acceleration'::driving_event_type
                WHEN acceleration_ms2 < -3.5 THEN 'harsh_braking'::driving_event_type
            END as event_type,
            CASE 
                WHEN ABS(acceleration_ms2) < 3.5 THEN 2
                WHEN ABS(acceleration_ms2) < 5.0 THEN 3
                WHEN ABS(acceleration_ms2) < 6.5 THEN 4
                ELSE 5
            END as severity,
            ABS(acceleration_ms2) as acceleration_value,
            ABS(acceleration_ms2) / 9.81 as g_force,
            prev_speed as speed_before,
            speed as speed_after,
            acceleration_ms2,
            location,
            lat,
            lng,
            time_diff * 1000 as duration_ms,
            CASE 
                WHEN acceleration_ms2 > 0 THEN 2.5
                ELSE 3.5
            END as threshold_value
        FROM events
        WHERE ABS(acceleration_ms2) > 2.5
    )
    -- Ubaci događaje u driving_events tabelu
    INSERT INTO driving_events (
        time,
        vehicle_id,
        garage_no,
        event_type,
        severity,
        speed_before,
        speed_after,
        acceleration,
        acceleration_value,
        g_force,
        location,
        lat,
        lng,
        duration_ms,
        threshold_value,
        actual_value
    )
    SELECT 
        time,
        vehicle_id,
        garage_no,
        event_type,
        severity,
        speed_before,
        speed_after,
        acceleration_ms2,
        acceleration_value,
        g_force,
        location,
        lat,
        lng,
        duration_ms,
        threshold_value,
        acceleration_value as actual_value
    FROM detected_events
    ON CONFLICT (vehicle_id, time, event_type) DO NOTHING;
    
    -- Vrati statistiku
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_events,
        COUNT(CASE WHEN event_type = 'harsh_acceleration' THEN 1 END)::INTEGER as acceleration_events,
        COUNT(CASE WHEN event_type = 'harsh_braking' THEN 1 END)::INTEGER as braking_events,
        COUNT(CASE WHEN severity <= 3 THEN 1 END)::INTEGER as moderate_events,
        COUNT(CASE WHEN severity >= 4 THEN 1 END)::INTEGER as severe_events
    FROM detected_events;
END;
$$ LANGUAGE plpgsql;

-- 3. Dodaj komentar
COMMENT ON FUNCTION detect_aggressive_driving_batch IS 
'Analizira GPS podatke za period i detektuje agresivnu vožnju (ubrzanja > 2.5 m/s², kočenja > 3.5 m/s²)';

-- migrate:down
DROP FUNCTION IF EXISTS detect_aggressive_driving_batch CASCADE;
ALTER TABLE driving_events 
DROP COLUMN IF EXISTS acceleration_value,
DROP COLUMN IF EXISTS g_force;