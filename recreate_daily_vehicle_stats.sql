-- Recreate daily_vehicle_stats continuous aggregate
-- This fixes the issue where vehicles 1 and 2 are missing from the aggregate

-- Step 1: Drop existing continuous aggregate
DROP MATERIALIZED VIEW IF EXISTS daily_vehicle_stats CASCADE;

-- Step 2: Recreate the continuous aggregate with same definition
CREATE MATERIALIZED VIEW daily_vehicle_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', time) AS day,
    vehicle_id,
    garage_no,
    COUNT(*) as total_points,
    COUNT(DISTINCT DATE_TRUNC('hour', time)) as active_hours,
    -- Brzina
    AVG(speed)::NUMERIC(5,2) as avg_speed,
    MAX(speed)::NUMERIC(5,2) as max_speed,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY speed)::NUMERIC(5,2) as median_speed,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY speed)::NUMERIC(5,2) as speed_95th,
    -- Kilometraža
    ROUND(CAST(ST_Length(
        ST_MakeLine(location ORDER BY time)::geography
    ) / 1000.0 AS NUMERIC), 2) as total_km,
    -- Vreme aktivnosti
    MIN(time) as first_point,
    MAX(time) as last_point,
    EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) / 3600.0 as active_hours_decimal,
    -- Eventi
    COUNT(CASE WHEN speed > 50 THEN 1 END) as speeding_points,
    COUNT(CASE WHEN speed = 0 THEN 1 END) as stopped_points
FROM gps_data
WHERE vehicle_id IS NOT NULL
GROUP BY day, vehicle_id, garage_no
WITH NO DATA;

-- Step 3: Add refresh policy (refresh last month every hour)
SELECT add_continuous_aggregate_policy(
    'daily_vehicle_stats',
    start_offset => INTERVAL '1 month',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => true
);

-- Step 4: Initial refresh for all data (this will take some time)
-- We'll do this in chunks to avoid timeout
CALL refresh_continuous_aggregate('daily_vehicle_stats', '2025-06-01'::timestamptz, '2025-07-01'::timestamptz);
CALL refresh_continuous_aggregate('daily_vehicle_stats', '2025-07-01'::timestamptz, '2025-08-01'::timestamptz);
CALL refresh_continuous_aggregate('daily_vehicle_stats', '2025-08-01'::timestamptz, '2025-09-01'::timestamptz);
CALL refresh_continuous_aggregate('daily_vehicle_stats', '2025-09-01'::timestamptz, NULL);

-- Step 5: Verify vehicles 1 and 2 are included
SELECT 
    vehicle_id, 
    COUNT(*) as days_with_data,
    SUM(total_km) as total_km_all_days
FROM daily_vehicle_stats 
WHERE vehicle_id IN (1, 2, 460)
GROUP BY vehicle_id
ORDER BY vehicle_id;