-- migrate:up
-- ==============================================================================
-- MONTHLY VIEW FROM DAILY AGGREGATES
-- ==============================================================================
-- Hierarchical aggregation - nivo 4 (najviši nivo)
-- Agregira ~30 dnevnih zapisa u jedan mesečni zapis
--
-- Performance: 30 dana × 1ms = 30ms
-- Umesto: 518,400 GPS tačaka × 0.5ms = 259,200ms
-- Ušteda: 8,640x brže!
-- ==============================================================================

CREATE VIEW monthly_view_gps_data_5_minute_no_lag_aggregates AS
SELECT
    -- Mesečni bucket
    DATE_TRUNC('month', date)::date as month,
    vehicle_id,
    garage_no,

    -- Agregacija distance i brzina
    SUM(total_distance_km) as total_distance_km,
    AVG(avg_speed) as avg_speed,
    MAX(max_speed) as max_speed,
    MIN(min_speed) FILTER (WHERE min_speed > 0) as min_speed,

    -- Agregacija GPS tačaka i vremena
    SUM(total_gps_points) as total_gps_points,
    COUNT(*) as num_days,
    SUM(num_hours) as num_hours,
    SUM(num_5min_buckets) as num_5min_buckets,

    -- Prva i poslednja lokacija u mesecu
    first(first_location, date) as first_location,
    last(last_location, date) as last_location,

    -- Center point (centroid svih dnevnih center pointa)
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

-- Komentar sa objašnjenjem
COMMENT ON VIEW monthly_view_gps_data_5_minute_no_lag_aggregates IS
'Mesečni agregat izračunat iz dnevnih zapisa. VIEW (ne MATERIALIZED) jer je brz - agregira samo ~30 dnevnih zapisa. Auto-update kroz daily → hourly → 5-min agregat.';

-- migrate:down

DROP VIEW IF EXISTS monthly_view_gps_data_5_minute_no_lag_aggregates;
