-- migrate:up
-- Fix issue where vehicles with ID 1 and 2 are missing from vehicle_hourly_stats aggregate
-- This aggregate is used by getBatchMonthlyStatistics for calculating distance/km

-- Step 1: Drop existing continuous aggregate
DROP MATERIALIZED VIEW IF EXISTS vehicle_hourly_stats CASCADE;

-- Step 2: Recreate the continuous aggregate with same definition
CREATE MATERIALIZED VIEW vehicle_hourly_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS hour,
    vehicle_id,
    garage_no,
    COUNT(*) as point_count,
    AVG(speed)::NUMERIC(5,2) as avg_speed,
    MAX(speed)::NUMERIC(5,2) as max_speed,
    MIN(CASE WHEN speed > 0 THEN speed END)::NUMERIC(5,2) as min_moving_speed,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY speed)::NUMERIC(5,2) as speed_95th,
    STDDEV(speed)::NUMERIC(5,2) as speed_std_dev,
    -- Kilometraža - ključno za Monthly Report!
    ROUND(CAST(ST_Length(
        ST_MakeLine(location ORDER BY time)::geography
    ) / 1000.0 AS NUMERIC), 2) as distance_km,
    COUNT(CASE WHEN speed = 0 THEN 1 END) as stop_count,
    COUNT(CASE WHEN speed > 50 THEN 1 END) as speeding_count
FROM gps_data
WHERE vehicle_id IS NOT NULL
GROUP BY hour, vehicle_id, garage_no
WITH NO DATA;

-- Step 3: Add refresh policy (refresh last week every hour)
SELECT add_continuous_aggregate_policy(
    'vehicle_hourly_stats',
    start_offset => INTERVAL '1 week',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => true
);

-- Step 4: Log instructions for manual refresh
DO $$
BEGIN
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'vehicle_hourly_stats aggregate recreated successfully (empty)';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: Manual refresh required after migration!';
    RAISE NOTICE '';
    RAISE NOTICE 'Run this command separately (not in transaction):';
    RAISE NOTICE 'CALL refresh_continuous_aggregate(''vehicle_hourly_stats'', NULL, NULL);';
    RAISE NOTICE '';
    RAISE NOTICE 'Or use the refresh script: ./refresh_aggregates.sh';
    RAISE NOTICE '================================================================================';
END $$;

-- migrate:down
-- Rollback is not practical for this migration as we're fixing a bug
RAISE EXCEPTION 'This migration cannot be rolled back. The previous aggregate was missing data for vehicles 1 and 2.';

