-- migrate:up
-- ==============================================================================
-- KREIRANJE 5-MINUTNOG AGREGATA (CLEAN RECREATE)
-- ==============================================================================
-- Kreira continuous aggregate ispočetka nakon DROP-ovanja verzije sa duplikatima.
-- GROUP BY u continuous aggregate garantuje jedinstvene kombinacije (bucket, vehicle, garage).
-- ==============================================================================

-- ==============================================================================
-- 1. Kreiraj 5-MINUTNI CONTINUOUS AGGREGATE SA BELGRADE METADATA
-- ==============================================================================
CREATE MATERIALIZED VIEW gps_data_5_minute_no_LAG_aggregate
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

-- ==============================================================================
-- 2. PERFORMANCE INDEKSI
-- ==============================================================================
-- Index za pretragu po vozilu i vremenu (najčešća query)
CREATE INDEX idx_5min_no_lag_vehicle_bucket
ON gps_data_5_minute_no_LAG_aggregate(vehicle_id, bucket_5min DESC);

-- Index za pretragu po garažnom broju
CREATE INDEX idx_5min_no_lag_garage
ON gps_data_5_minute_no_LAG_aggregate(garage_no, bucket_5min DESC);

-- ==============================================================================
-- 4. REFRESH POLICY - automatski refresh svakih 5 minuta
-- ==============================================================================
SELECT add_continuous_aggregate_policy('gps_data_5_minute_no_LAG_aggregate',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => true
);

-- ==============================================================================
-- 6. HOURLY VIEW SA BELGRADE METADATA
-- ==============================================================================
CREATE VIEW hourly_view_gps_data_5_minute_no_lag_aggregates AS
SELECT
    time_bucket('1 hour', bucket_5min) as hour,
    vehicle_id,
    garage_no,

    -- Belgrade metadata (agregacija iz 5-min bucketa)
    MIN(year_belgrade) as year_belgrade,
    MIN(month_belgrade) as month_belgrade,
    MIN(day_belgrade) as day_belgrade,
    MIN(hour_belgrade) as hour_belgrade,

    -- Agregacija distance i brzina
    SUM(distance_km) as total_distance_km,
    AVG(avg_speed) as avg_speed,
    MAX(max_speed) as max_speed,
    MIN(min_speed) FILTER (WHERE min_speed > 0) as min_speed,

    -- Agregacija GPS tačaka
    SUM(total_points) as total_gps_points,
    COUNT(*) as num_5min_buckets,

    -- Lokacije
    first(first_location, bucket_5min) as first_location,
    last(last_location, bucket_5min) as last_location,
    ST_Centroid(ST_Collect(center_point::geometry))::geography as center_point,

    -- Vremenske granice
    MIN(first_point_time) as first_point_time,
    MAX(last_point_time) as last_point_time,

    -- Prosečna nadmorska visina i kurs
    AVG(avg_altitude) as avg_altitude,
    AVG(avg_course) as avg_course

FROM gps_data_5_minute_no_lag_aggregate

GROUP BY
    time_bucket('1 hour', bucket_5min),
    vehicle_id,
    garage_no;

COMMENT ON VIEW hourly_view_gps_data_5_minute_no_lag_aggregates IS
'Satni agregat sa Belgrade timezone metadata iz 5-min bucketa. Auto-update kroz 5-min continuous aggregate.';

-- ==============================================================================
-- 7. DAILY VIEW SA BELGRADE METADATA
-- ==============================================================================
CREATE VIEW daily_view_gps_data_5_minute_no_lag_aggregates AS
SELECT
    DATE(hour) as date,
    vehicle_id,
    garage_no,

    -- Belgrade metadata (iz hourly view-a)
    MIN(year_belgrade) as year_belgrade,
    MIN(month_belgrade) as month_belgrade,
    MIN(day_belgrade) as day_belgrade,

    -- Agregacija distance i brzina
    SUM(total_distance_km) as total_distance_km,
    AVG(avg_speed) as avg_speed,
    MAX(max_speed) as max_speed,
    MIN(min_speed) FILTER (WHERE min_speed > 0) as min_speed,

    -- Agregacija GPS tačaka
    SUM(total_gps_points) as total_gps_points,
    COUNT(*) as num_hours,
    SUM(num_5min_buckets) as num_5min_buckets,

    -- Lokacije
    first(first_location, hour) as first_location,
    last(last_location, hour) as last_location,
    ST_Centroid(ST_Collect(center_point::geometry))::geography as center_point,

    -- Vremenske granice
    MIN(first_point_time) as first_point_time,
    MAX(last_point_time) as last_point_time,

    -- Prosečna nadmorska visina i kurs
    AVG(avg_altitude) as avg_altitude,
    AVG(avg_course) as avg_course

FROM hourly_view_gps_data_5_minute_no_lag_aggregates

GROUP BY
    DATE(hour),
    vehicle_id,
    garage_no;

COMMENT ON VIEW daily_view_gps_data_5_minute_no_lag_aggregates IS
'Dnevni agregat sa Belgrade timezone metadata. Auto-update kroz hourly view → 5-min agregat.';

-- ==============================================================================
-- 8. MONTHLY VIEW SA BELGRADE METADATA
-- ==============================================================================
CREATE VIEW monthly_view_gps_data_5_minute_no_lag_aggregates AS
SELECT
    DATE_TRUNC('month', date)::date as month,
    vehicle_id,
    garage_no,

    -- Belgrade metadata (iz daily view-a)
    MIN(year_belgrade) as year_belgrade,
    MIN(month_belgrade) as month_belgrade,

    -- Agregacija distance i brzina
    SUM(total_distance_km) as total_distance_km,
    AVG(avg_speed) as avg_speed,
    MAX(max_speed) as max_speed,
    MIN(min_speed) FILTER (WHERE min_speed > 0) as min_speed,

    -- Agregacija GPS tačaka
    SUM(total_gps_points) as total_gps_points,
    COUNT(*) as num_days,
    SUM(num_hours) as num_hours,
    SUM(num_5min_buckets) as num_5min_buckets,

    -- Lokacije
    first(first_location, date) as first_location,
    last(last_location, date) as last_location,
    ST_Centroid(ST_Collect(center_point::geometry))::geography as center_point,

    -- Vremenske granice
    MIN(first_point_time) as first_point_time,
    MAX(last_point_time) as last_point_time,

    -- Prosečna nadmorska visina i kurs
    AVG(avg_altitude) as avg_altitude,
    AVG(avg_course) as avg_course

FROM daily_view_gps_data_5_minute_no_lag_aggregates

GROUP BY
    DATE_TRUNC('month', date),
    vehicle_id,
    garage_no;

COMMENT ON VIEW monthly_view_gps_data_5_minute_no_lag_aggregates IS
'Mesečni agregat sa Belgrade timezone metadata. Auto-update kroz daily → hourly → 5-min agregat.';

-- ==============================================================================
-- NAPOMENA: Agregat JE PRAZAN (WITH NO DATA)
--
-- ⚠️ MANUELNO pokreni PUN REFRESH posle migracije:
-- CALL refresh_continuous_aggregate('gps_data_5_minute_no_LAG_aggregate', NULL, NULL);
--
-- (Ne može biti u migraciji jer ne radi unutar transakcije)
--
-- GROUP BY garantuje jedinstvene kombinacije (bucket, vehicle_id, garage_no).
-- Refresh se može pozivati više puta - TimescaleDB automatski zamenjuje podatke.
-- ==============================================================================

-- migrate:down

-- Rollback - briše sve strukture
DROP VIEW IF EXISTS monthly_view_gps_data_5_minute_no_lag_aggregates CASCADE;
DROP VIEW IF EXISTS daily_view_gps_data_5_minute_no_lag_aggregates CASCADE;
DROP VIEW IF EXISTS hourly_view_gps_data_5_minute_no_lag_aggregates CASCADE;
DROP MATERIALIZED VIEW IF EXISTS gps_data_5_minute_no_LAG_aggregate CASCADE;
