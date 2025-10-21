-- migrate:up
-- ==============================================================================
-- HIERARCHICAL VIEW-OVI ZA gps_data_5_minute_no_postgis AGREGAT
-- ==============================================================================
-- Kreiraju hourly, daily i monthly view-ove БEZ PostGIS funkcija
-- View-ovi se automatski ažuriraju kada se refresh-uje 5-min continuous aggregate
-- ==============================================================================

-- ==============================================================================
-- 1. HOURLY VIEW
-- ==============================================================================
CREATE VIEW hourly_view_gps_data_5_minute_no_postgis AS
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

    -- Lokacije (lat/lng БEZ PostGIS)
    first(first_lat, bucket_5min) as first_lat,
    first(first_lng, bucket_5min) as first_lng,
    last(last_lat, bucket_5min) as last_lat,
    last(last_lng, bucket_5min) as last_lng,

    -- Vremenske granice
    MIN(first_point_time) as first_point_time,
    MAX(last_point_time) as last_point_time,

    -- Prosečna nadmorska visina i kurs
    AVG(avg_altitude) as avg_altitude,
    AVG(avg_course) as avg_course

FROM gps_data_5_minute_no_postgis

GROUP BY
    time_bucket('1 hour', bucket_5min),
    vehicle_id,
    garage_no;

COMMENT ON VIEW hourly_view_gps_data_5_minute_no_postgis IS
'Hourly aggregate from 5-min buckets WITHOUT PostGIS. Auto-updates when 5-min continuous aggregate refreshes.';

-- ==============================================================================
-- 2. DAILY VIEW
-- ==============================================================================
CREATE VIEW daily_view_gps_data_5_minute_no_postgis AS
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
    first(first_lat, hour) as first_lat,
    first(first_lng, hour) as first_lng,
    last(last_lat, hour) as last_lat,
    last(last_lng, hour) as last_lng,

    -- Vremenske granice
    MIN(first_point_time) as first_point_time,
    MAX(last_point_time) as last_point_time,

    -- Prosečna nadmorska visina i kurs
    AVG(avg_altitude) as avg_altitude,
    AVG(avg_course) as avg_course

FROM hourly_view_gps_data_5_minute_no_postgis

GROUP BY
    DATE(hour),
    vehicle_id,
    garage_no;

COMMENT ON VIEW daily_view_gps_data_5_minute_no_postgis IS
'Daily aggregate from hourly view WITHOUT PostGIS. Auto-updates through hourly → 5-min aggregate chain.';

-- ==============================================================================
-- 3. MONTHLY VIEW
-- ==============================================================================
CREATE VIEW monthly_view_gps_data_5_minute_no_postgis AS
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
    first(first_lat, date) as first_lat,
    first(first_lng, date) as first_lng,
    last(last_lat, date) as last_lat,
    last(last_lng, date) as last_lng,

    -- Vremenske granice
    MIN(first_point_time) as first_point_time,
    MAX(last_point_time) as last_point_time,

    -- Prosečna nadmorska visina i kurs
    AVG(avg_altitude) as avg_altitude,
    AVG(avg_course) as avg_course

FROM daily_view_gps_data_5_minute_no_postgis

GROUP BY
    DATE_TRUNC('month', date),
    vehicle_id,
    garage_no;

COMMENT ON VIEW monthly_view_gps_data_5_minute_no_postgis IS
'Monthly aggregate from daily view WITHOUT PostGIS. Auto-updates through daily → hourly → 5-min aggregate chain.';

-- migrate:down

DROP VIEW IF EXISTS monthly_view_gps_data_5_minute_no_postgis CASCADE;
DROP VIEW IF EXISTS daily_view_gps_data_5_minute_no_postgis CASCADE;
DROP VIEW IF EXISTS hourly_view_gps_data_5_minute_no_postgis CASCADE;
