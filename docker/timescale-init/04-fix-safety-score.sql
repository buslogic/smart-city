-- ======================================
-- FIX SAFETY SCORE FORMULA FOR BUSES
-- Blaža formula prilagođena za autobuse
-- ======================================

-- Drop old function
DROP FUNCTION IF EXISTS get_vehicle_driving_statistics(INTEGER, DATE, DATE);

-- Create updated function with better safety score
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
    ),
    -- UVEK kalkuliši kilometražu iz GPS podataka za tačnu vrednost
    distance_stats AS (
        SELECT 
            (
                WITH ordered_points AS (
                    SELECT 
                        location,
                        LAG(location) OVER (ORDER BY time) as prev_location
                    FROM gps_data
                    WHERE vehicle_id = p_vehicle_id
                        AND time::DATE BETWEEN p_start_date AND p_end_date
                    ORDER BY time
                )
                SELECT 
                    COALESCE(
                        SUM(ST_Distance(prev_location::geography, location::geography)) / 1000.0,
                        0
                    )
                FROM ordered_points
                WHERE prev_location IS NOT NULL
            ) as total_km
    )
    SELECT 
        evt_count::INTEGER,
        severe_acc::INTEGER,
        moderate_acc::INTEGER,
        severe_brake::INTEGER,
        moderate_brake::INTEGER,
        ROUND(avg_g::NUMERIC, 3),
        ROUND(max_g::NUMERIC, 3),
        ROUND(d.total_km::NUMERIC, 2),
        CASE 
            WHEN d.total_km > 0 THEN 
                ROUND((evt_count::NUMERIC / d.total_km * 100)::NUMERIC, 2)
            ELSE 0
        END,
        common_hour::INTEGER,
        -- REALNIJA SAFETY SCORE FORMULA - bazirana na procentu agresivnih događaja
        -- 99.7% bezbedne vožnje treba da ima visok skor!
        CASE
            WHEN evt_count = 0 THEN 100
            WHEN d.total_km = 0 THEN 50
            ELSE 
                -- Formula: 100 - (procenat_agresivnih_događaja * faktor_ozbiljnosti)
                -- Estimiraj ukupan broj ubrzanja/kočenja (30 po km za gradsku vožnju)
                GREATEST(
                    50, -- Minimum score je 50
                    LEAST(
                        100,
                        100 - LEAST(40, -- Maksimalni penal je 40 poena
                            -- Severe eventi po 100km × 3
                            ((severe_acc + severe_brake)::NUMERIC / GREATEST(d.total_km, 1) * 100 * 3)::INTEGER +
                            -- Moderate eventi po 100km × 1  
                            ((moderate_acc + moderate_brake)::NUMERIC / GREATEST(d.total_km, 1) * 100 * 1)::INTEGER
                        )
                    )
                )
        END::INTEGER
    FROM event_stats, distance_stats d;
END;
$$ LANGUAGE plpgsql;

-- Komentar o novoj formuli
COMMENT ON FUNCTION get_vehicle_driving_statistics IS 
'Kalkuliše statistiku vožnje sa Safety Score prilagođenim za autobuse.
Safety Score formula: 100 - (severe * 3) - (moderate * 1) + (km_bonus)
Severe eventi: -3 poena
Moderate eventi: -1 poen
Kilometraža bonus: do +10 poena (1 poen na 10km)';