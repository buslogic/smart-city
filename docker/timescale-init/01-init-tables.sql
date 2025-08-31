-- Enable extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;

-- Main GPS data table
CREATE TABLE IF NOT EXISTS gps_data (
    time            TIMESTAMPTZ NOT NULL,
    vehicle_id      INTEGER NOT NULL,
    garage_no       VARCHAR(20) NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    location        GEOMETRY(Point, 4326), -- PostGIS point
    speed           SMALLINT DEFAULT 0,
    course          SMALLINT DEFAULT 0,
    alt             SMALLINT DEFAULT 0,
    state           SMALLINT DEFAULT 0,
    in_route        SMALLINT DEFAULT 0,
    line_number     VARCHAR(10),
    direction       SMALLINT,
    trip_id         INTEGER,
    departure_id    INTEGER,
    people_in       INTEGER DEFAULT 0,
    people_out      INTEGER DEFAULT 0,
    battery_status  SMALLINT,
    data_source     VARCHAR(50) DEFAULT 'legacy',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable (partitioned by time)
SELECT create_hypertable('gps_data', 'time', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time ON gps_data (vehicle_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_gps_garage_time ON gps_data (garage_no, time DESC);
CREATE INDEX IF NOT EXISTS idx_gps_line_time ON gps_data (line_number, time DESC) WHERE line_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gps_departure_time ON gps_data (departure_id, time DESC) WHERE departure_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gps_location ON gps_data USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_gps_speed ON gps_data (speed) WHERE speed > 0;

-- Table for API keys (for legacy server authentication)
CREATE TABLE IF NOT EXISTS api_keys (
    id              SERIAL PRIMARY KEY,
    key             VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    source          VARCHAR(50) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,
    request_count   INTEGER DEFAULT 0
);

-- Insert default API key for legacy server
INSERT INTO api_keys (key, name, source) 
VALUES ('smartcity_legacy_gps_key_2024', 'Legacy GPS Server', 'legacy_server')
ON CONFLICT (key) DO NOTHING;

-- Function to automatically set PostGIS point from lat/lng
CREATE OR REPLACE FUNCTION set_gps_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create PostGIS point
CREATE TRIGGER set_location_trigger
BEFORE INSERT OR UPDATE ON gps_data
FOR EACH ROW
EXECUTE FUNCTION set_gps_location();

-- Continuous aggregate for vehicle hourly statistics with PostGIS
CREATE MATERIALIZED VIEW IF NOT EXISTS vehicle_hourly_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS hour,
    vehicle_id,
    garage_no,
    line_number,
    COUNT(*) as point_count,
    AVG(speed)::NUMERIC(5,2) as avg_speed,
    MAX(speed) as max_speed,
    ST_MakeLine(location ORDER BY time) as route_line,
    ST_Length(ST_MakeLine(location ORDER BY time)::geography) / 1000.0 as distance_km,
    SUM(people_in) as total_people_in,
    SUM(people_out) as total_people_out
FROM gps_data
WHERE speed > 0
GROUP BY hour, vehicle_id, garage_no, line_number
WITH NO DATA;

-- Continuous aggregate for daily mileage with PostGIS
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_mileage
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', time) AS day,
    vehicle_id,
    garage_no,
    line_number,
    departure_id,
    COUNT(*) as gps_points,
    AVG(speed)::NUMERIC(5,2) as avg_speed,
    MAX(speed) as max_speed,
    -- Ukupna kilometraža koristeći PostGIS
    ST_Length(
        ST_MakeLine(location ORDER BY time)::geography
    ) / 1000.0 as total_km,
    -- Bounding box za rutu
    ST_Extent(location) as route_bounds,
    -- Centroid rute
    ST_Centroid(ST_Collect(location)) as route_center,
    SUM(people_in) as total_people_in,
    SUM(people_out) as total_people_out
FROM gps_data
WHERE speed > 0 AND departure_id IS NOT NULL
GROUP BY day, vehicle_id, garage_no, line_number, departure_id
WITH NO DATA;

-- Real-time view za trenutne pozicije (poslednja lokacija svakog vozila)
CREATE OR REPLACE VIEW current_vehicle_positions AS
WITH latest_positions AS (
    SELECT DISTINCT ON (vehicle_id)
        vehicle_id,
        garage_no,
        time,
        lat,
        lng,
        location,
        speed,
        course,
        line_number,
        direction,
        departure_id,
        people_in,
        people_out,
        battery_status
    FROM gps_data
    WHERE time > NOW() - INTERVAL '10 minutes'
    ORDER BY vehicle_id, time DESC
)
SELECT 
    *,
    CASE 
        WHEN speed > 0 THEN 'moving'
        WHEN time > NOW() - INTERVAL '2 minutes' THEN 'stopped'
        ELSE 'offline'
    END as status,
    EXTRACT(EPOCH FROM (NOW() - time))::INTEGER as seconds_ago
FROM latest_positions;

-- Function za računanje pređene kilometraže između dva vremena
CREATE OR REPLACE FUNCTION calculate_vehicle_mileage(
    p_vehicle_id INTEGER,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
)
RETURNS TABLE (
    total_km NUMERIC,
    avg_speed NUMERIC,
    max_speed INTEGER,
    total_points INTEGER,
    driving_time_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROUND((ST_Length(
            ST_MakeLine(location ORDER BY time)::geography
        ) / 1000.0)::NUMERIC, 2) as total_km,
        ROUND(AVG(speed)::NUMERIC, 2) as avg_speed,
        MAX(speed) as max_speed,
        COUNT(*)::INTEGER as total_points,
        ROUND((EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) / 3600)::NUMERIC, 2) as driving_time_hours
    FROM gps_data
    WHERE vehicle_id = p_vehicle_id
    AND time BETWEEN p_start_time AND p_end_time
    AND speed > 0;
END;
$$ LANGUAGE plpgsql;

-- Function za pronalaženje vozila u radiusu
CREATE OR REPLACE FUNCTION find_vehicles_near_point(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_radius_meters INTEGER DEFAULT 1000
)
RETURNS TABLE (
    vehicle_id INTEGER,
    garage_no VARCHAR,
    distance_meters NUMERIC,
    speed SMALLINT,
    line_number VARCHAR,
    last_update TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.vehicle_id,
        v.garage_no,
        ROUND(ST_Distance(
            v.location::geography,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        )::NUMERIC, 2) as distance_meters,
        v.speed,
        v.line_number,
        v.time as last_update
    FROM current_vehicle_positions v
    WHERE ST_DWithin(
        v.location::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p_radius_meters
    )
    ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('vehicle_hourly_stats',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes',
    if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('daily_mileage',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Enable compression on old data (after 7 days)
ALTER TABLE gps_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'vehicle_id,garage_no',
    timescaledb.compress_orderby = 'time DESC'
);

-- Add compression policy
SELECT add_compression_policy('gps_data', INTERVAL '7 days', if_not_exists => TRUE);

-- Add retention policy (keep data for 90 days)
SELECT add_retention_policy('gps_data', INTERVAL '90 days', if_not_exists => TRUE);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO smartcity_ts;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO smartcity_ts;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO smartcity_ts;