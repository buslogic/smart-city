-- migrate:up
-- Fix issue where vehicles with ID 1 and 2 are missing from daily_vehicle_stats aggregate
-- The aggregate seems to skip these vehicles during refresh, so we recreate it

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

-- Step 4: Log instructions for manual refresh
DO $$
BEGIN
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'daily_vehicle_stats aggregate recreated successfully (empty)';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: Manual refresh required after migration!';
    RAISE NOTICE '';
    RAISE NOTICE 'Run this command separately (not in transaction):';
    RAISE NOTICE 'CALL refresh_continuous_aggregate(''daily_vehicle_stats'', NULL, NULL);';
    RAISE NOTICE '';
    RAISE NOTICE 'Or use the refresh script: ./refresh_aggregates.sh';
    RAISE NOTICE '================================================================================';
END $$;

-- migrate:down
-- Rollback is not practical for this migration as we're fixing a bug
-- The old aggregate was missing data for vehicles 1 and 2
DO $$
BEGIN
    RAISE EXCEPTION 'This migration cannot be rolled back. The previous aggregate was missing data for vehicles 1 and 2.';
END $$;
