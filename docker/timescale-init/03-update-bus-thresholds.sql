-- ======================================
-- PRILAGOĐAVANJE PRAGOVA ZA AUTOBUSE
-- Blaži pragovi za teža vozila sa putnicima
-- ======================================

-- Drop stara funkcija
DROP FUNCTION IF EXISTS detect_aggressive_driving_batch(INTEGER, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ);

-- Nova funkcija sa pragovima za autobuse
CREATE OR REPLACE FUNCTION detect_aggressive_driving_batch(
    p_vehicle_id INTEGER,
    p_garage_no VARCHAR,
    p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
    p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_events INTEGER,
    acceleration_events INTEGER,
    braking_events INTEGER,
    severe_events INTEGER,
    moderate_events INTEGER,
    normal_events INTEGER
) AS $$
DECLARE
    v_start_process TIMESTAMPTZ;
BEGIN
    v_start_process := clock_timestamp();
    
    -- Obriši postojeće događaje za ovaj period
    DELETE FROM driving_events 
    WHERE vehicle_id = p_vehicle_id 
      AND time BETWEEN p_start_time AND p_end_time;
    
    -- Insert detektovanih događaja sa PRAGOVIMA ZA AUTOBUSE
    WITH gps_with_metrics AS (
        SELECT 
            time,
            vehicle_id,
            garage_no,
            lat,
            lng,
            location,
            speed,
            course,
            -- Kalkuliši prethodne vrednosti
            LAG(time) OVER (ORDER BY time) as prev_time,
            LAG(speed) OVER (ORDER BY time) as prev_speed,
            LAG(location) OVER (ORDER BY time) as prev_location,
            LAG(lat) OVER (ORDER BY time) as prev_lat,
            LAG(lng) OVER (ORDER BY time) as prev_lng
        FROM gps_data
        WHERE vehicle_id = p_vehicle_id
          AND time BETWEEN p_start_time AND p_end_time
          AND speed IS NOT NULL
        ORDER BY time
    ),
    acceleration_events AS (
        SELECT 
            time,
            vehicle_id,
            garage_no,
            lat,
            lng,
            location,
            speed,
            prev_speed,
            course,
            -- Kalkuliši vremensku razliku u sekundama
            EXTRACT(EPOCH FROM (time - prev_time)) as time_diff_seconds,
            -- Kalkuliši ubrzanje: Δv / Δt
            -- Brzina je u km/h, konvertuj u m/s: (km/h) / 3.6 = m/s
            ((speed - prev_speed) / 3.6) / NULLIF(EXTRACT(EPOCH FROM (time - prev_time)), 0) as acceleration_ms2,
            -- Kalkuliši distancu u metrima
            ST_Distance(prev_location::geography, location::geography) as distance_meters,
            -- Kalkuliši trajanje u milisekundama
            EXTRACT(EPOCH FROM (time - prev_time)) * 1000 as duration_ms,
            prev_lat,
            prev_lng
        FROM gps_with_metrics
        WHERE prev_time IS NOT NULL
          AND prev_speed IS NOT NULL
          AND EXTRACT(EPOCH FROM (time - prev_time)) BETWEEN 2 AND 10 -- Samo intervali 2-10 sekundi
          AND ABS((speed - prev_speed) / 3.6 / NULLIF(EXTRACT(EPOCH FROM (time - prev_time)), 0)) > 1.0 -- Prag od 1.0 m/s² za autobuse
    )
    INSERT INTO driving_events (
        time,
        vehicle_id,
        garage_no,
        event_type,
        severity,
        acceleration_value,
        speed_before,
        speed_after,
        duration_ms,
        distance_meters,
        lat,
        lng,
        heading,
        confidence,
        start_lat,
        start_lng,
        end_lat,
        end_lng
    )
    SELECT 
        time,
        vehicle_id,
        garage_no,
        -- Tip događaja
        CASE 
            WHEN acceleration_ms2 > 0 THEN 'acceleration'::event_type
            WHEN acceleration_ms2 < 0 THEN 'braking'::event_type
            ELSE 'acceleration'::event_type
        END as event_type,
        -- PRAGOVI ZA AUTOBUSE (blaži od automobila)
        CASE 
            -- Za ubrzanje
            WHEN acceleration_ms2 > 0 AND acceleration_ms2 > 2.5 THEN 'severe'::severity_level
            WHEN acceleration_ms2 > 0 AND acceleration_ms2 > 1.5 THEN 'moderate'::severity_level
            WHEN acceleration_ms2 > 0 THEN 'normal'::severity_level
            -- Za kočenje (negativne vrednosti)
            WHEN acceleration_ms2 < 0 AND acceleration_ms2 < -3.5 THEN 'severe'::severity_level
            WHEN acceleration_ms2 < 0 AND acceleration_ms2 < -2.0 THEN 'moderate'::severity_level
            ELSE 'normal'::severity_level
        END as severity,
        acceleration_ms2 as acceleration_value,
        prev_speed as speed_before,
        speed as speed_after,
        duration_ms,
        distance_meters,
        lat,
        lng,
        course as heading,
        -- Confidence na osnovu kvaliteta podataka
        CASE 
            WHEN time_diff_seconds BETWEEN 2.5 AND 3.5 THEN 1.0  -- Idealan interval
            WHEN time_diff_seconds BETWEEN 2 AND 4 THEN 0.9      -- Dobar interval
            WHEN time_diff_seconds BETWEEN 4 AND 6 THEN 0.7      -- Prihvatljiv interval
            ELSE 0.5                                              -- Manja pouzdanost
        END as confidence,
        prev_lat as start_lat,
        prev_lng as start_lng,
        lat as end_lat,
        lng as end_lng
    FROM acceleration_events
    WHERE ABS(acceleration_ms2) > 1.0; -- Minimalni prag za autobuse
    
    -- Vrati statistiku
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_events,
        COUNT(*) FILTER (WHERE event_type = 'acceleration')::INTEGER as acceleration_events,
        COUNT(*) FILTER (WHERE event_type = 'braking')::INTEGER as braking_events,
        COUNT(*) FILTER (WHERE severity = 'severe')::INTEGER as severe_events,
        COUNT(*) FILTER (WHERE severity = 'moderate')::INTEGER as moderate_events,
        COUNT(*) FILTER (WHERE severity = 'normal')::INTEGER as normal_events
    FROM driving_events
    WHERE vehicle_id = p_vehicle_id
      AND time BETWEEN p_start_time AND p_end_time;
      
END;
$$ LANGUAGE plpgsql;

-- Ažuriraj postojeće funkcije za statistike sa novim pragovima
CREATE OR REPLACE FUNCTION get_vehicle_driving_statistics(
    p_vehicle_id INTEGER,
    p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_events BIGINT,
    severe_accelerations BIGINT,
    moderate_accelerations BIGINT,
    severe_brakings BIGINT,
    moderate_brakings BIGINT,
    avg_g_force NUMERIC,
    max_g_force NUMERIC,
    total_distance_km NUMERIC,
    events_per_100km NUMERIC,
    most_common_hour INTEGER,
    safety_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) as total_events,
            COUNT(*) FILTER (WHERE event_type = 'acceleration' AND severity = 'severe') as severe_acc,
            COUNT(*) FILTER (WHERE event_type = 'acceleration' AND severity = 'moderate') as moderate_acc,
            COUNT(*) FILTER (WHERE event_type = 'braking' AND severity = 'severe') as severe_brake,
            COUNT(*) FILTER (WHERE event_type = 'braking' AND severity = 'moderate') as moderate_brake,
            AVG(g_force) as avg_g,
            MAX(g_force) as max_g,
            SUM(distance_meters) / 1000.0 as total_km
        FROM driving_events
        WHERE vehicle_id = p_vehicle_id
          AND time BETWEEN p_start_time AND p_end_time
    ),
    hour_stats AS (
        SELECT EXTRACT(HOUR FROM time)::INTEGER as hour
        FROM driving_events
        WHERE vehicle_id = p_vehicle_id
          AND time BETWEEN p_start_time AND p_end_time
        GROUP BY EXTRACT(HOUR FROM time)
        ORDER BY COUNT(*) DESC
        LIMIT 1
    )
    SELECT 
        s.total_events,
        s.severe_acc,
        s.moderate_acc,
        s.severe_brake,
        s.moderate_brake,
        ROUND(s.avg_g, 3),
        ROUND(s.max_g, 3),
        ROUND(s.total_km, 2),
        CASE 
            WHEN s.total_km > 0 THEN ROUND((s.total_events::NUMERIC / s.total_km) * 100, 2)
            ELSE 0
        END as events_per_100km,
        COALESCE(h.hour, 0),
        -- Safety score prilagođen za autobuse
        CASE 
            WHEN s.total_events = 0 THEN 100
            ELSE GREATEST(0, 100 - 
                (s.severe_acc * 15 +      -- Ozbiljna ubrzanja (blaži faktor)
                 s.severe_brake * 15 +     -- Ozbiljna kočenja (blaži faktor)
                 s.moderate_acc * 5 +      -- Umerena ubrzanja
                 s.moderate_brake * 5))    -- Umerena kočenja
        END as safety_score
    FROM stats s
    LEFT JOIN hour_stats h ON true;
END;
$$ LANGUAGE plpgsql;

-- Komentar o promenama
COMMENT ON FUNCTION detect_aggressive_driving_batch IS 
'Batch procesiranje GPS podataka za detekciju agresivne vožnje AUTOBUSA.
Pragovi prilagođeni za teža vozila:
- Ubrzanje: Normal (1.0-1.5), Moderate (1.5-2.5), Severe (>2.5) m/s²
- Kočenje: Normal (-1.0 do -2.0), Moderate (-2.0 do -3.5), Severe (<-3.5) m/s²';