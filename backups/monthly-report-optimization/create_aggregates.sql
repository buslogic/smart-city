-- Create Continuous Aggregates for Monthly Report Optimization
-- Date: 03.09.2025

-- Drop existing aggregates if needed (for testing)
-- DROP MATERIALIZED VIEW IF EXISTS monthly_vehicle_raw_stats CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS monthly_vehicle_distance CASCADE;

-- 1. MONTHLY RAW STATISTICS (bez safety score!)
CREATE MATERIALIZED VIEW monthly_vehicle_raw_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 month', time) AS month,
    vehicle_id,
    -- Event counts by severity
    COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity >= 4) as severe_accelerations,
    COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity = 3) as moderate_accelerations,
    COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity >= 4) as severe_brakings,
    COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity = 3) as moderate_brakings,
    -- Aggregate metrics
    AVG(g_force)::NUMERIC(5,3) as avg_g_force,
    MAX(g_force)::NUMERIC(5,3) as max_g_force,
    COUNT(*) as total_events,
    -- Most common hour
    MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM time))::INTEGER as most_common_hour
FROM driving_events
WHERE time >= '2025-01-01'  -- Start from beginning of year
GROUP BY time_bucket('1 month', time), vehicle_id
WITH NO DATA;

-- 2. MONTHLY DISTANCE STATISTICS
-- Koristi hourly stats koji već postoje i agregiraju ih na mesečni nivo
CREATE MATERIALIZED VIEW monthly_vehicle_distance
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 month', hour) AS month,
    vehicle_id,
    SUM(distance_km)::NUMERIC(10,2) as total_distance_km,
    COUNT(DISTINCT DATE(hour)) as active_days,
    SUM(point_count) as total_gps_points
FROM vehicle_hourly_stats
WHERE hour >= '2025-01-01'
GROUP BY time_bucket('1 month', hour), vehicle_id
WITH NO DATA;

-- 3. WEEKLY STATISTICS (za brže testiranje)
CREATE MATERIALIZED VIEW weekly_vehicle_raw_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 week', time) AS week,
    vehicle_id,
    COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity >= 4) as severe_accelerations,
    COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity = 3) as moderate_accelerations,
    COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity >= 4) as severe_brakings,
    COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity = 3) as moderate_brakings,
    AVG(g_force)::NUMERIC(5,3) as avg_g_force,
    MAX(g_force)::NUMERIC(5,3) as max_g_force,
    COUNT(*) as total_events,
    MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM time))::INTEGER as most_common_hour
FROM driving_events
WHERE time >= '2025-01-01'
GROUP BY time_bucket('1 week', time), vehicle_id
WITH NO DATA;

-- 4. Refresh sa podacima
SELECT add_continuous_aggregate_policy('monthly_vehicle_raw_stats',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('monthly_vehicle_distance',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour', 
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('weekly_vehicle_raw_stats',
    start_offset => INTERVAL '2 months',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes',
    if_not_exists => TRUE
);

-- 5. Initial data refresh
CALL refresh_continuous_aggregate('monthly_vehicle_raw_stats', '2025-01-01', '2025-10-01');
CALL refresh_continuous_aggregate('monthly_vehicle_distance', '2025-01-01', '2025-10-01');
CALL refresh_continuous_aggregate('weekly_vehicle_raw_stats', '2025-07-01', '2025-10-01');

-- 6. Create indexes on aggregates
CREATE INDEX idx_monthly_raw_stats_vehicle 
ON monthly_vehicle_raw_stats (vehicle_id, month DESC);

CREATE INDEX idx_monthly_distance_vehicle 
ON monthly_vehicle_distance (vehicle_id, month DESC);

-- 7. Grant permissions
GRANT SELECT ON monthly_vehicle_raw_stats TO smartcity_ts;
GRANT SELECT ON monthly_vehicle_distance TO smartcity_ts;
GRANT SELECT ON weekly_vehicle_raw_stats TO smartcity_ts;