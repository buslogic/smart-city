-- migrate:up
-- ==============================================================================
-- DAILY VIEW FROM HOURLY AGGREGATES
-- ==============================================================================
-- Hierarchical aggregation - nivo 3
-- Agregira 24 satna zapisa u jedan dnevni zapis
--
-- Performance: 24 sata × 1ms = 24ms
-- Umesto: 17,280 GPS tačaka × 0.5ms = 8,640ms
-- Ušteda: 360x brže!
-- ==============================================================================

CREATE VIEW daily_view_gps_data_5_minute_no_lag_aggregates AS
SELECT
    -- Dnevni bucket
    DATE(hour) as date,
    vehicle_id,
    garage_no,

    -- Agregacija distance i brzina
    SUM(total_distance_km) as total_distance_km,
    AVG(avg_speed) as avg_speed,
    MAX(max_speed) as max_speed,
    MIN(min_speed) FILTER (WHERE min_speed > 0) as min_speed,

    -- Agregacija GPS tačaka i vremena
    SUM(total_gps_points) as total_gps_points,
    COUNT(*) as num_hours,
    SUM(num_5min_buckets) as num_5min_buckets,

    -- Prva i poslednja lokacija u danu
    first(first_location, hour) as first_location,
    last(last_location, hour) as last_location,

    -- Center point (centroid svih satnih center pointa)
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

-- Komentar sa objašnjenjem
COMMENT ON VIEW daily_view_gps_data_5_minute_no_lag_aggregates IS
'Dnevni agregat izračunat iz satnih zapisa. VIEW (ne MATERIALIZED) jer je brz - agregira samo 24 satna zapisa. Auto-update kroz hourly view → 5-min agregat.';

-- migrate:down

DROP VIEW IF EXISTS daily_view_gps_data_5_minute_no_lag_aggregates;
