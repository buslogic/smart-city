-- migrate:up
-- Kreiranje poboljšanog daily aggregate bez departure_id ograničenja

-- 1. Obriši postojeći koji ne radi
DROP MATERIALIZED VIEW IF EXISTS daily_mileage CASCADE;

-- 2. Kreiraj novi sa boljim parametrima
CREATE MATERIALIZED VIEW daily_vehicle_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', time) AS day,
    vehicle_id,
    garage_no,
    -- Osnovne metrike
    COUNT(*) as total_points,
    COUNT(DISTINCT DATE_TRUNC('hour', time)) as active_hours,
    
    -- Brzina statistike
    AVG(speed)::NUMERIC(5,2) as avg_speed,
    MAX(speed)::NUMERIC(5,2) as max_speed,
    MIN(CASE WHEN speed > 0 THEN speed END)::NUMERIC(5,2) as min_moving_speed,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY speed)::NUMERIC(5,2) as median_speed,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY speed)::NUMERIC(5,2) as speed_95th_percentile,
    STDDEV(speed)::NUMERIC(5,2) as speed_std_dev,
    
    -- Kilometraža sa PostGIS
    ROUND(ST_Length(
        ST_MakeLine(location ORDER BY time)::geography
    ) / 1000.0, 2) as total_km,
    
    -- Vremenska analiza
    MIN(time) as first_point_time,
    MAX(time) as last_point_time,
    EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) / 3600.0 as total_hours,
    
    -- Prostorna analiza
    ST_Extent(location)::TEXT as daily_bounds,
    ST_X(ST_Centroid(ST_Collect(location)))::NUMERIC(10,6) as center_lng,
    ST_Y(ST_Centroid(ST_Collect(location)))::NUMERIC(10,6) as center_lat,
    
    -- Eventi
    COUNT(CASE WHEN speed > 50 THEN 1 END) as speeding_points,
    COUNT(CASE WHEN speed = 0 THEN 1 END) as stopped_points,
    COUNT(CASE WHEN speed BETWEEN 1 AND 5 THEN 1 END) as slow_moving_points
    
FROM gps_data
WHERE vehicle_id IS NOT NULL  -- Samo osnovni uslov
GROUP BY day, vehicle_id, garage_no
WITH DATA;  -- Odmah popuni sa istorijskim podacima

-- 3. Dodaj refresh policy za automatsko ažuriranje
SELECT add_continuous_aggregate_policy(
    'daily_vehicle_stats',
    start_offset => INTERVAL '3 months',    -- Gleda 3 meseca unazad
    end_offset => INTERVAL '1 hour',        -- Do pre 1 sat
    schedule_interval => INTERVAL '1 hour',  -- Osvežava svaki sat
    if_not_exists => true
);

-- 4. Kreiraj indekse za brže upite
CREATE INDEX IF NOT EXISTS idx_daily_stats_vehicle_day 
ON daily_vehicle_stats(vehicle_id, day DESC);

CREATE INDEX IF NOT EXISTS idx_daily_stats_day 
ON daily_vehicle_stats(day DESC);

-- 5. Dodaj komentar
COMMENT ON MATERIALIZED VIEW daily_vehicle_stats IS 
'Dnevna statistika vozila sa retroaktivnim podacima. Automatski se ažurira svaki sat.';

-- 6. Verifikuj da radi
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM daily_vehicle_stats;
    
    IF row_count > 0 THEN
        RAISE NOTICE '✅ Continuous aggregate kreiran sa % redova', row_count;
    ELSE
        RAISE WARNING '⚠️ Continuous aggregate kreiran ali je prazan';
    END IF;
END $$;

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS daily_vehicle_stats CASCADE;

-- Vrati stari aggregate (koji ne radi)
CREATE MATERIALIZED VIEW daily_mileage
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', time) AS day,
    vehicle_id,
    garage_no,
    line_number,
    departure_id,
    COUNT(*) as gps_points,
    AVG(speed)::NUMERIC(5,2) as avg_speed,
    MAX(speed) as max_speed,
    ST_Length(
        ST_MakeLine(location ORDER BY time)::geography
    ) / 1000.0 as total_km,
    ST_Extent(location) as route_bounds,
    ST_Centroid(ST_Collect(location)) as route_center,
    SUM(people_in) as total_people_in,
    SUM(people_out) as total_people_out
FROM gps_data
WHERE speed > 0 AND departure_id IS NOT NULL
GROUP BY day, vehicle_id, garage_no, line_number, departure_id
WITH NO DATA;