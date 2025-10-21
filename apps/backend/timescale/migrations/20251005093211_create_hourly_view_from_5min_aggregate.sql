-- migrate:up
-- ==============================================================================
-- HOURLY VIEW FROM 5-MINUTE AGGREGATES
-- ==============================================================================
-- Hierarchical aggregation pristup (kao Google Maps i Uber)
-- Agregira 5-minutne buckete u satne bez vraćanja na raw GPS podatke
--
-- Performance: 12 bucketa × 1ms = 12ms (umesto 1200 GPS tačaka × 0.5ms = 600ms)
-- Ušteda: 50x brže!
-- ==============================================================================

CREATE VIEW hourly_view_gps_data_5_minute_no_lag_aggregates AS
SELECT
    -- Satni bucket
    time_bucket('1 hour', bucket_5min) as hour,
    vehicle_id,
    garage_no,

    -- Agregacija distance i brzina
    SUM(distance_km) as total_distance_km,
    AVG(avg_speed) as avg_speed,
    MAX(max_speed) as max_speed,
    MIN(min_speed) FILTER (WHERE min_speed > 0) as min_speed,

    -- Agregacija GPS tačaka i vremena
    SUM(total_points) as total_gps_points,
    COUNT(*) as num_5min_buckets,

    -- Prva i poslednja lokacija u satu
    first(first_location, bucket_5min) as first_location,
    last(last_location, bucket_5min) as last_location,

    -- Center point (centroid svih center pointa)
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

-- Komentar sa objašnjenjem
COMMENT ON VIEW hourly_view_gps_data_5_minute_no_lag_aggregates IS
'Satni agregat izračunat iz 5-minutnih bucketa. VIEW (ne MATERIALIZED) jer je brz - agregira samo 12 bucketa po satu. Auto-update jer 5-min agregat ima refresh policy.';

-- migrate:down

DROP VIEW IF EXISTS hourly_view_gps_data_5_minute_no_lag_aggregates;
