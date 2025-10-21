-- migrate:up
-- ==============================================================================
-- NOVI 5-MINUTNI AGREGAT БEZ PostGIS
-- ==============================================================================
-- Koristi custom gps_total_distance agregat umesto ST_MakeLine/ST_Length
-- Parallelizable → radi sa kompresovanim chunk-ovima
-- ==============================================================================

CREATE MATERIALIZED VIEW gps_data_5_minute_no_postgis
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket_5min,
    vehicle_id,
    garage_no,

    -- Belgrade timezone metadata
    EXTRACT(YEAR FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as year_belgrade,
    EXTRACT(MONTH FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as month_belgrade,
    EXTRACT(DAY FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as day_belgrade,
    EXTRACT(HOUR FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as hour_belgrade,
    EXTRACT(MINUTE FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as minute_belgrade,

    -- GPS statistike
    COUNT(*) as total_points,
    AVG(speed) FILTER (WHERE speed > 0)::numeric(5,2) as avg_speed,
    MAX(speed)::numeric(5,2) as max_speed,
    MIN(speed) FILTER (WHERE speed > 0)::numeric(5,2) as min_speed,

    -- ✅ DISTANCE: Custom aggregate sa Haversine (БEZ PostGIS!)
    gps_total_distance(lat, lng, time)::NUMERIC(10,2) as distance_km,

    -- Lokacije - samo lat/lng (БEZ PostGIS geometry)
    first(lat, time) as first_lat,
    first(lng, time) as first_lng,
    last(lat, time) as last_lat,
    last(lng, time) as last_lng,

    -- Vremenske granice
    MIN(time) as first_point_time,
    MAX(time) as last_point_time,

    -- Prosečna nadmorska visina i kurs
    AVG(alt)::numeric(7,2) as avg_altitude,
    AVG(course)::numeric(5,2) as avg_course

FROM gps_data

WHERE vehicle_id IS NOT NULL
  AND speed > 0
  AND lat IS NOT NULL
  AND lng IS NOT NULL

GROUP BY
    time_bucket('5 minutes', time),
    vehicle_id,
    garage_no

WITH NO DATA;

-- Indeksi
CREATE INDEX idx_5min_no_postgis_vehicle_bucket
ON gps_data_5_minute_no_postgis(vehicle_id, bucket_5min DESC);

CREATE INDEX idx_5min_no_postgis_garage
ON gps_data_5_minute_no_postgis(garage_no, bucket_5min DESC);

CREATE INDEX idx_5min_no_postgis_bucket
ON gps_data_5_minute_no_postgis(bucket_5min DESC);

-- Refresh policy - svakih 5 minuta
SELECT add_continuous_aggregate_policy(
    'gps_data_5_minute_no_postgis',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

-- migrate:down

DROP MATERIALIZED VIEW IF EXISTS gps_data_5_minute_no_postgis CASCADE;
