-- migrate:up
-- Popravka get_vehicle_driving_statistics funkcije - koristi ispravne enum vrednosti

CREATE OR REPLACE FUNCTION get_vehicle_driving_statistics(
    p_vehicle_id INTEGER,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE(
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
    safety_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH event_stats AS (
        SELECT 
            COUNT(*) as total_events,
            COUNT(CASE WHEN event_type = 'harsh_acceleration' AND severity >= 4 THEN 1 END) as severe_accelerations,
            COUNT(CASE WHEN event_type = 'harsh_acceleration' AND severity BETWEEN 2 AND 3 THEN 1 END) as moderate_accelerations,
            COUNT(CASE WHEN event_type = 'harsh_braking' AND severity >= 4 THEN 1 END) as severe_brakings,
            COUNT(CASE WHEN event_type = 'harsh_braking' AND severity BETWEEN 2 AND 3 THEN 1 END) as moderate_brakings,
            AVG(g_force) as avg_g_force,
            MAX(g_force) as max_g_force,
            MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM time)) as most_common_hour
        FROM driving_events
        WHERE vehicle_id = p_vehicle_id
            AND time >= p_start_date
            AND time < (p_end_date + INTERVAL '1 day')
    ),
    distance_stats AS (
        SELECT 
            COALESCE(
                ROUND(CAST(ST_Length(
                    ST_MakeLine(location ORDER BY time)::geography
                ) / 1000.0 AS NUMERIC), 2),
                0
            ) as total_distance_km
        FROM gps_data
        WHERE vehicle_id = p_vehicle_id
            AND time >= p_start_date
            AND time < (p_end_date + INTERVAL '1 day')
            AND location IS NOT NULL
    )
    SELECT 
        COALESCE(es.total_events, 0),
        COALESCE(es.severe_accelerations, 0),
        COALESCE(es.moderate_accelerations, 0),
        COALESCE(es.severe_brakings, 0),
        COALESCE(es.moderate_brakings, 0),
        ROUND(COALESCE(es.avg_g_force, 0), 2),
        ROUND(COALESCE(es.max_g_force, 0), 2),
        COALESCE(ds.total_distance_km, 0),
        CASE 
            WHEN ds.total_distance_km > 0 THEN 
                ROUND((es.total_events::NUMERIC / ds.total_distance_km) * 100, 2)
            ELSE 0
        END as events_per_100km,
        COALESCE(es.most_common_hour::INTEGER, 0),
        GREATEST(0, LEAST(100, 
            100 - (COALESCE(es.severe_accelerations, 0) * 5) - 
            (COALESCE(es.severe_brakings, 0) * 5) - 
            (COALESCE(es.moderate_accelerations, 0) * 2) - 
            (COALESCE(es.moderate_brakings, 0) * 2)
        ))::INTEGER as safety_score
    FROM event_stats es, distance_stats ds;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_vehicle_driving_statistics IS 
'Vraća statistiku agresivne vožnje za vozilo u datom periodu - koristi ispravne enum vrednosti (harsh_acceleration, harsh_braking)';

-- migrate:down
-- Vraćanje na staru verziju (sa pogrešnim enum vrednostima)
CREATE OR REPLACE FUNCTION get_vehicle_driving_statistics(
    p_vehicle_id INTEGER,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE(
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
    safety_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH event_stats AS (
        SELECT 
            COUNT(*) as total_events,
            COUNT(CASE WHEN event_type = 'acceleration' AND severity >= 4 THEN 1 END) as severe_accelerations,
            COUNT(CASE WHEN event_type = 'acceleration' AND severity BETWEEN 2 AND 3 THEN 1 END) as moderate_accelerations,
            COUNT(CASE WHEN event_type = 'braking' AND severity >= 4 THEN 1 END) as severe_brakings,
            COUNT(CASE WHEN event_type = 'braking' AND severity BETWEEN 2 AND 3 THEN 1 END) as moderate_brakings,
            AVG(g_force) as avg_g_force,
            MAX(g_force) as max_g_force,
            MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM time)) as most_common_hour
        FROM driving_events
        WHERE vehicle_id = p_vehicle_id
            AND time >= p_start_date
            AND time < (p_end_date + INTERVAL '1 day')
    ),
    distance_stats AS (
        SELECT 
            COALESCE(
                ROUND(CAST(ST_Length(
                    ST_MakeLine(location ORDER BY time)::geography
                ) / 1000.0 AS NUMERIC), 2),
                0
            ) as total_distance_km
        FROM gps_data
        WHERE vehicle_id = p_vehicle_id
            AND time >= p_start_date
            AND time < (p_end_date + INTERVAL '1 day')
            AND location IS NOT NULL
    )
    SELECT 
        COALESCE(es.total_events, 0),
        COALESCE(es.severe_accelerations, 0),
        COALESCE(es.moderate_accelerations, 0),
        COALESCE(es.severe_brakings, 0),
        COALESCE(es.moderate_brakings, 0),
        ROUND(COALESCE(es.avg_g_force, 0), 2),
        ROUND(COALESCE(es.max_g_force, 0), 2),
        COALESCE(ds.total_distance_km, 0),
        CASE 
            WHEN ds.total_distance_km > 0 THEN 
                ROUND((es.total_events::NUMERIC / ds.total_distance_km) * 100, 2)
            ELSE 0
        END as events_per_100km,
        COALESCE(es.most_common_hour::INTEGER, 0),
        GREATEST(0, LEAST(100, 
            100 - (COALESCE(es.severe_accelerations, 0) * 5) - 
            (COALESCE(es.severe_brakings, 0) * 5) - 
            (COALESCE(es.moderate_accelerations, 0) * 2) - 
            (COALESCE(es.moderate_brakings, 0) * 2)
        ))::INTEGER as safety_score
    FROM event_stats es, distance_stats ds;
END;
$$ LANGUAGE plpgsql;
