-- migrate:up

-- Drop postojećeg view-a (kreiran bez WITH NO DATA pa je timeout-ovao)
DROP MATERIALIZED VIEW IF EXISTS gps_data_5_minute_no_LAG_aggregate CASCADE;

-- Kreiraj ispravan view sa WITH NO DATA
-- Identično kao 20251005053450 ali sa ispravkom
CREATE MATERIALIZED VIEW gps_data_5_minute_no_LAG_aggregate
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket_5min,
    vehicle_id,
    garage_no,
    COUNT(*) as total_points,
    AVG(speed) FILTER (WHERE speed > 0)::numeric(5,2) as avg_speed,
    MAX(speed)::numeric(5,2) as max_speed,
    MIN(speed) FILTER (WHERE speed > 0)::numeric(5,2) as min_speed,
    COALESCE(
        ST_Length(
            ST_MakeLine(location ORDER BY time)::geography
        ) / 1000.0,
        0
    )::NUMERIC(10,2) as distance_km,
    first(location, time)::geography as first_location,
    last(location, time)::geography as last_location,
    ST_Centroid(ST_Collect(location::geometry))::geography as center_point,
    MIN(time) as first_point_time,
    MAX(time) as last_point_time,
    AVG(alt)::numeric(7,2) as avg_altitude,
    AVG(course)::numeric(5,2) as avg_course
FROM gps_data
WHERE vehicle_id IS NOT NULL
  AND speed > 0
  AND location IS NOT NULL
GROUP BY
    time_bucket('5 minutes', time),
    vehicle_id,
    garage_no
WITH NO DATA;

-- Indeksi
CREATE INDEX IF NOT EXISTS idx_5min_no_lag_vehicle_bucket
ON gps_data_5_minute_no_LAG_aggregate(vehicle_id, bucket_5min DESC);

CREATE INDEX IF NOT EXISTS idx_5min_no_lag_garage
ON gps_data_5_minute_no_LAG_aggregate(garage_no, bucket_5min DESC);

-- Refresh policy (automatski refresh svakih 5 minuta)
SELECT add_continuous_aggregate_policy('gps_data_5_minute_no_LAG_aggregate',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => true
);

-- migrate:down

DROP MATERIALIZED VIEW IF EXISTS gps_data_5_minute_no_LAG_aggregate CASCADE;
