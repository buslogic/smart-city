-- Optimized function for monthly statistics using aggregates
-- Date: 03.09.2025

CREATE OR REPLACE FUNCTION get_monthly_vehicle_stats_optimized(
    p_vehicle_id INTEGER,
    p_month DATE
)
RETURNS TABLE (
    vehicle_id INTEGER,
    month TIMESTAMPTZ,
    severe_accelerations BIGINT,
    moderate_accelerations BIGINT,
    severe_brakings BIGINT,
    moderate_brakings BIGINT,
    avg_g_force NUMERIC,
    max_g_force NUMERIC,
    total_events BIGINT,
    total_distance_km NUMERIC,
    active_days BIGINT,
    safety_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH event_stats AS (
        -- Get raw statistics from driving_events
        SELECT 
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity >= 4) as severe_acc,
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity = 3) as moderate_acc,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity >= 4) as severe_brake,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity = 3) as moderate_brake,
            AVG(g_force)::NUMERIC(5,3) as avg_g,
            MAX(g_force)::NUMERIC(5,3) as max_g,
            COUNT(*) as total_evts
        FROM driving_events
        WHERE vehicle_id = p_vehicle_id
            AND time >= p_month
            AND time < p_month + INTERVAL '1 month'
    ),
    distance_stats AS (
        -- Get distance from hourly stats (already calculated)
        SELECT 
            COALESCE(SUM(distance_km), 0)::NUMERIC(10,2) as total_km,
            COUNT(DISTINCT DATE(hour)) as days
        FROM vehicle_hourly_stats
        WHERE vehicle_id = p_vehicle_id
            AND hour >= p_month
            AND hour < p_month + INTERVAL '1 month'
    )
    SELECT 
        p_vehicle_id,
        p_month::TIMESTAMPTZ,
        COALESCE(severe_acc, 0),
        COALESCE(moderate_acc, 0),
        COALESCE(severe_brake, 0),
        COALESCE(moderate_brake, 0),
        COALESCE(avg_g, 0),
        COALESCE(max_g, 0),
        COALESCE(total_evts, 0),
        COALESCE(total_km, 0),
        COALESCE(days, 0),
        -- Safety score calculation (can be changed later)
        CASE
            WHEN total_evts = 0 OR total_km = 0 THEN 100
            ELSE 
                GREATEST(50,
                    LEAST(100,
                        100 - LEAST(40,
                            ((severe_acc + severe_brake)::NUMERIC / GREATEST(total_km, 1) * 100 * 3)::INTEGER +
                            ((moderate_acc + moderate_brake)::NUMERIC / GREATEST(total_km, 1) * 100 * 1)::INTEGER
                        )
                    )
                )
        END::INTEGER
    FROM event_stats, distance_stats;
END;
$$ LANGUAGE plpgsql;

-- Test the optimized function
EXPLAIN ANALYZE 
SELECT * FROM get_monthly_vehicle_stats_optimized(460, '2025-08-01'::date);