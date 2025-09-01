-- Fix the statistics function
DROP FUNCTION IF EXISTS get_vehicle_driving_statistics;

CREATE OR REPLACE FUNCTION get_vehicle_driving_statistics(
    p_vehicle_id INTEGER,
    p_start_date DATE DEFAULT CURRENT_DATE - 30,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
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
            COUNT(*) FILTER (WHERE event_type = 'acceleration' AND severity = 'severe') as severe_acc,
            COUNT(*) FILTER (WHERE event_type = 'acceleration' AND severity = 'moderate') as moderate_acc,
            COUNT(*) FILTER (WHERE event_type = 'braking' AND severity = 'severe') as severe_brake,
            COUNT(*) FILTER (WHERE event_type = 'braking' AND severity = 'moderate') as moderate_brake,
            AVG(g_force) as avg_g,
            MAX(g_force) as max_g,
            SUM(distance_meters) / 1000.0 as total_dist_km,
            MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM time)) as common_hour
        FROM driving_events
        WHERE vehicle_id = p_vehicle_id
            AND time::DATE BETWEEN p_start_date AND p_end_date
    )
    SELECT 
        evt_count::INTEGER,
        severe_acc::INTEGER,
        moderate_acc::INTEGER,
        severe_brake::INTEGER,
        moderate_brake::INTEGER,
        ROUND(avg_g::NUMERIC, 3),
        ROUND(max_g::NUMERIC, 3),
        ROUND(total_dist_km::NUMERIC, 2),
        CASE 
            WHEN total_dist_km > 0 THEN 
                ROUND((evt_count::NUMERIC / total_dist_km * 100)::NUMERIC, 2)
            ELSE 0
        END,
        common_hour::INTEGER,
        -- Safety Score: 100 - (severe * 5 + moderate * 2) capped at 0
        GREATEST(0, 100 - (severe_acc + severe_brake) * 5 - (moderate_acc + moderate_brake) * 2)::INTEGER
    FROM event_stats;
END;
$$ LANGUAGE plpgsql;