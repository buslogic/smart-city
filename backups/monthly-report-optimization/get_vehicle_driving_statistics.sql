CREATE OR REPLACE FUNCTION public.get_vehicle_driving_statistics(p_vehicle_id integer, p_start_date date, p_end_date date)
 RETURNS TABLE(total_events integer, severe_accelerations integer, moderate_accelerations integer, severe_brakings integer, moderate_brakings integer, avg_g_force numeric, max_g_force numeric, total_distance_km numeric, events_per_100km numeric, most_common_hour integer, safety_score integer)
 LANGUAGE plpgsql
AS $function$
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
$function$
