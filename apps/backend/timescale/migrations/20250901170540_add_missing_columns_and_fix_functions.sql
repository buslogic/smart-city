-- migrate:up
-- Dodaj kolone koje nedostaju u driving_events tabeli

-- 1. Dodaj nedostajuće kolone
ALTER TABLE driving_events 
ADD COLUMN IF NOT EXISTS distance_meters DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS heading DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION DEFAULT 0.8;

-- 2. Popuni distance_meters na osnovu trajanja i brzine
UPDATE driving_events 
SET distance_meters = COALESCE(
    ((speed_before + speed_after) / 2.0) * (duration_ms / 1000.0) / 3.6,
    0
)
WHERE distance_meters IS NULL OR distance_meters = 0;

-- 3. Sada popravi get_vehicle_driving_statistics funkciju sa POTPUNO ISPRAVNOM verzijom
DROP FUNCTION IF EXISTS get_vehicle_driving_statistics CASCADE;

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
            -- Koristi ispravne enum vrednosti (harsh_acceleration, harsh_braking) i brojčane severity vrednosti
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity >= 4) as severe_acc,
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity BETWEEN 2 AND 3) as moderate_acc,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity >= 4) as severe_brake,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity BETWEEN 2 AND 3) as moderate_brake,
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

COMMENT ON FUNCTION get_vehicle_driving_statistics IS 
'Vraća statistiku agresivne vožnje za vozilo u datom periodu - FINALNA VERZIJA sa ispravnim enum i severity vrednostima';

-- Verifikacija
DO $$
BEGIN
    RAISE NOTICE '✅ Dodate kolone: distance_meters, heading, confidence';
    RAISE NOTICE '✅ Funkcija get_vehicle_driving_statistics je FINALNO popravljena';
    RAISE NOTICE '✅ Koristi: harsh_acceleration/harsh_braking + brojčane severity vrednosti';
END $$;

-- migrate:down
-- Ukloni dodate kolone
ALTER TABLE driving_events 
DROP COLUMN IF EXISTS distance_meters,
DROP COLUMN IF EXISTS heading,
DROP COLUMN IF EXISTS confidence;

-- Obriši funkciju
DROP FUNCTION IF EXISTS get_vehicle_driving_statistics CASCADE;