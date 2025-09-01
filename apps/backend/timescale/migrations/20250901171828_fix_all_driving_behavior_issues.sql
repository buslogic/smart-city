-- migrate:up
-- FINALNA POPRAVKA - usklađivanje tipova između backend-a i baze

-- 1. Prvo obriši postojeću funkciju
DROP FUNCTION IF EXISTS get_vehicle_driving_statistics CASCADE;

-- 2. Kreiraj ISPRAVNU funkciju koja koristi INTEGER severity i ispravne enum vrednosti
CREATE FUNCTION get_vehicle_driving_statistics(
    p_vehicle_id INTEGER,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE(
    total_events INTEGER,
    severe_accelerations INTEGER,
    moderate_accelerations INTEGER,
    severe_brakings INTEGER,
    moderate_brakings INTEGER,
    avg_g_force NUMERIC,
    max_g_force NUMERIC,
    total_distance_km NUMERIC,
    events_per_100km NUMERIC,
    most_common_hour INTEGER,
    safety_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH event_stats AS (
        SELECT 
            COUNT(*) as evt_count,
            -- Koristi INTEGER severity (5=severe, 3=moderate, 1=normal)
            -- i ispravne enum vrednosti (harsh_acceleration, harsh_braking)
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity >= 4) as severe_acc,
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity = 3) as moderate_acc,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity >= 4) as severe_brake,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity = 3) as moderate_brake,
            AVG(g_force) as avg_g,
            MAX(g_force) as max_g,
            SUM(COALESCE(distance_meters, 0)) / 1000.0 as total_dist_km,
            MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM time)) as common_hour
        FROM driving_events
        WHERE vehicle_id = p_vehicle_id
            AND time::DATE BETWEEN p_start_date AND p_end_date
    ),
    -- Kalkuliši kilometražu iz GPS podataka za tačnu vrednost
    distance_stats AS (
        SELECT 
            COALESCE(
                (
                    WITH ordered_points AS (
                        SELECT 
                            location,
                            LAG(location) OVER (ORDER BY time) as prev_location
                        FROM gps_data
                        WHERE vehicle_id = p_vehicle_id
                            AND time::DATE BETWEEN p_start_date AND p_end_date
                            AND location IS NOT NULL
                        ORDER BY time
                    )
                    SELECT 
                        SUM(ST_Distance(prev_location::geography, location::geography)) / 1000.0
                    FROM ordered_points
                    WHERE prev_location IS NOT NULL
                ),
                0
            ) as total_km
    )
    SELECT 
        COALESCE(evt_count, 0)::INTEGER,
        COALESCE(severe_acc, 0)::INTEGER,
        COALESCE(moderate_acc, 0)::INTEGER,
        COALESCE(severe_brake, 0)::INTEGER,
        COALESCE(moderate_brake, 0)::INTEGER,
        ROUND(COALESCE(avg_g, 0)::NUMERIC, 3),
        ROUND(COALESCE(max_g, 0)::NUMERIC, 3),
        ROUND(COALESCE(d.total_km, 0)::NUMERIC, 2),
        CASE 
            WHEN d.total_km > 0 THEN 
                ROUND((evt_count::NUMERIC / d.total_km * 100)::NUMERIC, 2)
            ELSE 0
        END,
        COALESCE(common_hour, 0)::INTEGER,
        -- Realnija safety score formula
        CASE
            WHEN evt_count = 0 OR d.total_km = 0 THEN 100
            ELSE 
                GREATEST(
                    50,
                    LEAST(
                        100,
                        100 - LEAST(40,
                            -- Severe eventi × 3 poena
                            ((severe_acc + severe_brake)::NUMERIC / GREATEST(d.total_km, 1) * 100 * 3)::INTEGER +
                            -- Moderate eventi × 1 poen  
                            ((moderate_acc + moderate_brake)::NUMERIC / GREATEST(d.total_km, 1) * 100 * 1)::INTEGER
                        )
                    )
                )
        END::INTEGER
    FROM event_stats, distance_stats d;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_vehicle_driving_statistics IS 
'FINALNA VERZIJA - koristi INTEGER severity (1=normal, 3=moderate, 5=severe) i ispravne enum vrednosti (harsh_acceleration, harsh_braking)';

-- 3. Popravi detect_aggressive_driving_batch funkciju
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
            heading
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
            heading
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
            heading,
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
'Detektuje agresivnu vožnju iz GPS podataka - FINALNA VERZIJA sa INTEGER severity';

-- Verifikacija
DO $$
BEGIN
    RAISE NOTICE '✅ Sve funkcije su ažurirane za rad sa INTEGER severity tipom';
    RAISE NOTICE '✅ Severity mapiranje: 1=normal, 3=moderate, 5=severe';
    RAISE NOTICE '✅ Event type: harsh_acceleration, harsh_braking';
END $$;

-- migrate:down
DROP FUNCTION IF EXISTS get_vehicle_driving_statistics CASCADE;
DROP FUNCTION IF EXISTS detect_aggressive_driving_batch CASCADE;
