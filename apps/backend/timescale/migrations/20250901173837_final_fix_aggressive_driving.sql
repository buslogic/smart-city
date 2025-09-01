-- migrate:up
-- FINALNA POPRAVKA - usklađivanje course/heading problema

-- 1. Popravi detect_aggressive_driving_batch da koristi 'course' umesto 'heading'
DROP FUNCTION IF EXISTS detect_aggressive_driving_batch CASCADE;

CREATE FUNCTION detect_aggressive_driving_batch(
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
    v_detected_count INTEGER := 0;
BEGIN
    -- Detektuj agresivna ubrzanja/kočenja
    WITH speed_changes AS (
        SELECT 
            time,
            speed,
            LAG(speed) OVER (ORDER BY time) as prev_speed,
            LAG(time) OVER (ORDER BY time) as prev_time,
            LAG(lat) OVER (ORDER BY time) as prev_lat,
            LAG(lng) OVER (ORDER BY time) as prev_lng,
            lat,
            lng,
            course  -- Koristi COURSE umesto HEADING
        FROM gps_data
        WHERE vehicle_id = p_vehicle_id
            AND time BETWEEN p_start_time AND p_end_time
            AND speed IS NOT NULL
        ORDER BY time
    ),
    detected AS (
        SELECT 
            time,
            prev_time,
            speed,
            prev_speed,
            EXTRACT(EPOCH FROM (time - prev_time)) as time_diff_seconds,
            -- Računa ubrzanje u m/s²
            ((speed - prev_speed) * 0.27778) / NULLIF(EXTRACT(EPOCH FROM (time - prev_time)), 0) as acceleration_ms2,
            lat,
            lng,
            prev_lat,
            prev_lng,
            course
        FROM speed_changes
        WHERE prev_speed IS NOT NULL
            AND prev_time IS NOT NULL
            AND EXTRACT(EPOCH FROM (time - prev_time)) BETWEEN 1 AND 10
            -- Samo značajne promene brzine
            AND ABS(speed - prev_speed) > 2
    ),
    events_to_insert AS (
        SELECT 
            time,
            p_vehicle_id as vehicle_id,
            p_garage_no as garage_no,
            CASE 
                WHEN acceleration_ms2 > 0 THEN 'harsh_acceleration'::driving_event_type
                ELSE 'harsh_braking'::driving_event_type
            END as event_type,
            -- Mapiranje na INTEGER severity
            CASE 
                -- Za ubrzanja
                WHEN acceleration_ms2 > 2.5 THEN 5  -- severe acceleration
                WHEN acceleration_ms2 > 1.5 THEN 3  -- moderate acceleration
                WHEN acceleration_ms2 > 1.0 THEN 1  -- normal acceleration
                -- Za kočenja
                WHEN acceleration_ms2 < -3.5 THEN 5  -- severe braking
                WHEN acceleration_ms2 < -2.0 THEN 3  -- moderate braking
                WHEN acceleration_ms2 < -1.0 THEN 1  -- normal braking
                ELSE 1
            END as severity,
            prev_speed as speed_before,
            speed as speed_after,
            acceleration_ms2 as acceleration_value,
            ABS(acceleration_ms2) / 9.81 as g_force,
            (time_diff_seconds * 1000)::INTEGER as duration_ms,
            -- Računa približnu distancu
            ((prev_speed + speed) / 2.0) * time_diff_seconds / 3.6 as distance_meters,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326) as location,
            lat,
            lng,
            course as heading,  -- Mapiraj course na heading
            0.95 as confidence
        FROM detected
        WHERE 
            -- Filtriraj samo značajne događaje
            (acceleration_ms2 > 1.0 OR acceleration_ms2 < -1.0)
    )
    -- Insert događaje koji još ne postoje
    INSERT INTO driving_events (
        time, vehicle_id, garage_no, event_type, severity,
        speed_before, speed_after, acceleration_value, g_force,
        duration_ms, distance_meters, location, lat, lng, heading, confidence
    )
    SELECT DISTINCT ON (time, vehicle_id)
        time, vehicle_id, garage_no, event_type, severity,
        speed_before, speed_after, acceleration_value, g_force,
        duration_ms, distance_meters, location, lat, lng, heading, confidence
    FROM events_to_insert e
    WHERE NOT EXISTS (
        SELECT 1 FROM driving_events de 
        WHERE de.vehicle_id = e.vehicle_id 
            AND de.time = e.time
    )
    ON CONFLICT DO NOTHING;
    
    -- Vrati statistiku
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_events,
        COUNT(CASE WHEN event_type = 'harsh_acceleration' THEN 1 END)::INTEGER as acceleration_events,
        COUNT(CASE WHEN event_type = 'harsh_braking' THEN 1 END)::INTEGER as braking_events,
        COUNT(CASE WHEN severity = 3 THEN 1 END)::INTEGER as moderate_events,
        COUNT(CASE WHEN severity = 5 THEN 1 END)::INTEGER as severe_events
    FROM driving_events
    WHERE vehicle_id = p_vehicle_id
        AND time BETWEEN p_start_time AND p_end_time;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_aggressive_driving_batch IS 
'Detektuje agresivnu vožnju iz GPS podataka - FINALNA VERZIJA koja koristi course umesto heading';

-- Verifikacija
DO $$
BEGIN
    RAISE NOTICE '✅ Funkcija detect_aggressive_driving_batch je popravljena';
    RAISE NOTICE '✅ Sada koristi course kolonu iz gps_data tabele';
    RAISE NOTICE '✅ Severity mapiranje: 1=normal, 3=moderate, 5=severe';
END $$;

-- migrate:down
DROP FUNCTION IF EXISTS detect_aggressive_driving_batch CASCADE;