-- migrate:up
-- =================================================================
-- Smart City GPS Tracking System - Initial Seed Migration
-- TimescaleDB + PostGIS
-- Datum: 2025-09-01
-- =================================================================

-- =============================================
-- 1. OSNOVNA TABELA ZA GPS PODATKE
-- =============================================

CREATE TABLE IF NOT EXISTS gps_data (
    time TIMESTAMPTZ NOT NULL,
    vehicle_id INTEGER NOT NULL,        -- Primarni identifikator vozila (ne menja se)
    garage_no VARCHAR(20) NOT NULL,     -- Garažni broj (može se promeniti)
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),     -- PostGIS geometrija
    speed DOUBLE PRECISION DEFAULT 0,
    course DOUBLE PRECISION,
    alt DOUBLE PRECISION,
    state INTEGER DEFAULT 0,
    in_route BOOLEAN DEFAULT false,
    line_number VARCHAR(10),
    departure_id INTEGER,
    people_in INTEGER DEFAULT 0,
    people_out INTEGER DEFAULT 0,
    data_source VARCHAR(50) DEFAULT 'legacy_sync'
);

-- Konvertuj u TimescaleDB hypertable
SELECT create_hypertable('gps_data', 'time', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- KRITIČAN CONSTRAINT: unique kombinacija vehicle_id + time
-- Ovo omogućava ON CONFLICT za batch insert
ALTER TABLE gps_data 
ADD CONSTRAINT gps_vehicle_time_unique 
UNIQUE (vehicle_id, time);

-- Indeksi za performanse
CREATE INDEX idx_gps_vehicle_time ON gps_data (vehicle_id, time DESC);
CREATE INDEX idx_gps_garage_time ON gps_data (garage_no, time DESC);
CREATE INDEX idx_gps_line_time ON gps_data (line_number, time DESC) 
    WHERE line_number IS NOT NULL;
CREATE INDEX idx_gps_departure_time ON gps_data (departure_id, time DESC) 
    WHERE departure_id IS NOT NULL;
CREATE INDEX idx_gps_location ON gps_data USING GIST (location);
CREATE INDEX idx_gps_speed ON gps_data (speed) WHERE speed > 0;

-- Trigger za automatsko postavljanje location geometry
DROP FUNCTION IF EXISTS set_gps_location() CASCADE;
CREATE OR REPLACE FUNCTION set_gps_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_location_trigger
BEFORE INSERT OR UPDATE ON gps_data
FOR EACH ROW
EXECUTE FUNCTION set_gps_location();

-- Kompresija za stare podatke (nakon 7 dana)
ALTER TABLE gps_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'vehicle_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('gps_data', INTERVAL '7 days', if_not_exists => true);

-- =============================================
-- 2. TABELA ZA AGRESIVNU VOŽNJU
-- =============================================

CREATE TYPE driving_event_type AS ENUM (
    'harsh_acceleration',
    'harsh_braking', 
    'sharp_turn',
    'speeding',
    'idle',
    'rapid_lane_change'
);

CREATE TABLE IF NOT EXISTS driving_events (
    id SERIAL,
    time TIMESTAMPTZ NOT NULL,
    vehicle_id INTEGER NOT NULL,
    garage_no VARCHAR(20) NOT NULL,
    event_type driving_event_type NOT NULL,
    severity INTEGER CHECK (severity BETWEEN 1 AND 5),
    speed_before DOUBLE PRECISION,
    speed_after DOUBLE PRECISION,
    acceleration DOUBLE PRECISION,
    location GEOMETRY(Point, 4326),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    duration_ms INTEGER,
    threshold_value DOUBLE PRECISION,
    actual_value DOUBLE PRECISION,
    metadata JSONB
);

-- Konvertuj u hypertable
SELECT create_hypertable('driving_events', 'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Unique constraint za deduplikaciju
ALTER TABLE driving_events
ADD CONSTRAINT driving_event_unique
UNIQUE (vehicle_id, time, event_type);

-- Indeksi
CREATE INDEX idx_driving_vehicle_time ON driving_events (vehicle_id, time DESC);
CREATE INDEX idx_driving_event_type ON driving_events (event_type, time DESC);
CREATE INDEX idx_driving_severity ON driving_events (severity) WHERE severity >= 3;
CREATE INDEX idx_driving_location ON driving_events USING GIST (location);

-- =============================================
-- 3. API KLJUČEVI ZA LEGACY INTEGRACIJU
-- =============================================

CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    metadata JSONB
);

-- Dodaj test API ključ za legacy sistem
INSERT INTO api_keys (key, name, source) 
VALUES ('test-api-key-2024', 'Legacy GPS Sync', 'legacy_cron')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 4. CONTINUOUS AGGREGATES (AUTOMATSKI AŽURIRANI)
-- =============================================

-- Satna statistika
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
    -- PostGIS kilometraža
    ROUND(CAST(ST_Length(
        ST_MakeLine(location ORDER BY time)::geography
    ) / 1000.0 AS NUMERIC), 2) as distance_km,
    -- Broj stopiranja
    COUNT(CASE WHEN speed = 0 THEN 1 END) as stop_count,
    COUNT(CASE WHEN speed > 50 THEN 1 END) as speeding_count
FROM gps_data
WHERE vehicle_id IS NOT NULL
GROUP BY hour, vehicle_id, garage_no
WITH NO DATA;  -- Ne popunjavaj odmah zbog transakcije

-- Dnevna statistika (bez departure_id ograničenja)
CREATE MATERIALIZED VIEW daily_vehicle_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', time) AS day,
    vehicle_id,
    garage_no,
    COUNT(*) as total_points,
    COUNT(DISTINCT DATE_TRUNC('hour', time)) as active_hours,
    -- Brzina
    AVG(speed)::NUMERIC(5,2) as avg_speed,
    MAX(speed)::NUMERIC(5,2) as max_speed,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY speed)::NUMERIC(5,2) as median_speed,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY speed)::NUMERIC(5,2) as speed_95th,
    -- Kilometraža
    ROUND(CAST(ST_Length(
        ST_MakeLine(location ORDER BY time)::geography
    ) / 1000.0 AS NUMERIC), 2) as total_km,
    -- Vreme aktivnosti
    MIN(time) as first_point,
    MAX(time) as last_point,
    EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) / 3600.0 as active_hours_decimal,
    -- Eventi
    COUNT(CASE WHEN speed > 50 THEN 1 END) as speeding_points,
    COUNT(CASE WHEN speed = 0 THEN 1 END) as stopped_points
FROM gps_data
WHERE vehicle_id IS NOT NULL
GROUP BY day, vehicle_id, garage_no
WITH NO DATA;

-- Automatske refresh politike
SELECT add_continuous_aggregate_policy(
    'vehicle_hourly_stats',
    start_offset => INTERVAL '1 week',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => true
);

SELECT add_continuous_aggregate_policy(
    'daily_vehicle_stats',
    start_offset => INTERVAL '1 month',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => true
);

-- =============================================
-- 5. POMOĆNI VIEW-OVI
-- =============================================

-- Trenutne pozicije vozila (poslednja lokacija)
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
        state,
        in_route
    FROM gps_data
    ORDER BY vehicle_id, time DESC
)
SELECT 
    vehicle_id,
    garage_no,
    time as last_update,
    lat,
    lng,
    speed,
    state,
    in_route,
    CASE 
        WHEN time > NOW() - INTERVAL '5 minutes' THEN 'online'
        WHEN time > NOW() - INTERVAL '30 minutes' THEN 'idle'
        ELSE 'offline'
    END as status
FROM latest_positions;

-- Sumarni pregled po vozilima
CREATE OR REPLACE VIEW vehicle_summary AS
SELECT 
    vehicle_id,
    garage_no,
    COUNT(*) as total_points,
    MIN(time) as first_seen,
    MAX(time) as last_seen,
    ROUND(CAST(AVG(speed) AS NUMERIC), 1) as avg_speed,
    MAX(speed) as max_speed
FROM gps_data
GROUP BY vehicle_id, garage_no;

-- =============================================
-- 6. POMOĆNE FUNKCIJE
-- =============================================

-- Funkcija za ažuriranje garage_no ako se promeni
CREATE OR REPLACE FUNCTION update_garage_number(
    p_vehicle_id INTEGER,
    p_new_garage_no VARCHAR(20)
) RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE gps_data 
    SET garage_no = p_new_garage_no 
    WHERE vehicle_id = p_vehicle_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    UPDATE driving_events
    SET garage_no = p_new_garage_no
    WHERE vehicle_id = p_vehicle_id;
    
    RAISE NOTICE 'Ažurirano % GPS tačaka za vozilo ID %', updated_count, p_vehicle_id;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Funkcija za računanje kilometraže
DROP FUNCTION IF EXISTS calculate_vehicle_mileage(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
CREATE OR REPLACE FUNCTION calculate_vehicle_mileage(
    p_vehicle_id INTEGER,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS TABLE (
    total_km NUMERIC,
    avg_speed NUMERIC,
    max_speed NUMERIC,
    total_points INTEGER,
    active_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROUND(CAST(ST_Length(
            ST_MakeLine(location ORDER BY time)::geography
        ) / 1000.0 AS NUMERIC), 2) as total_km,
        ROUND(CAST(AVG(speed) AS NUMERIC), 1) as avg_speed,
        ROUND(CAST(MAX(speed) AS NUMERIC), 1) as max_speed,
        COUNT(*)::integer as total_points,
        ROUND(CAST(EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) / 3600.0 AS NUMERIC), 2) as active_hours
    FROM gps_data
    WHERE vehicle_id = p_vehicle_id
        AND time BETWEEN p_start_date AND p_end_date
        AND speed > 0;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 7. RETENTION POLITIKA
-- =============================================

-- Automatsko brisanje starih podataka nakon 90 dana
SELECT add_retention_policy('gps_data', INTERVAL '90 days', if_not_exists => true);
SELECT add_retention_policy('driving_events', INTERVAL '180 days', if_not_exists => true);

-- =============================================
-- 8. FINALNA VERIFIKACIJA
-- =============================================

DO $$
DECLARE
    table_count INTEGER;
    view_count INTEGER;
    aggregate_count INTEGER;
BEGIN
    -- Proveri tabele
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN ('gps_data', 'driving_events', 'api_keys');
    
    -- Proveri view-ove
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views
    WHERE table_schema = 'public';
    
    -- Proveri continuous aggregates
    SELECT COUNT(*) INTO aggregate_count
    FROM timescaledb_information.continuous_aggregates;
    
    RAISE NOTICE '✅ SEED MIGRACIJA USPEŠNA!';
    RAISE NOTICE '   - Kreirane % tabele', table_count;
    RAISE NOTICE '   - Kreirano % view-ova', view_count;
    RAISE NOTICE '   - Kreirano % continuous aggregates', aggregate_count;
    RAISE NOTICE '   - Constraint gps_vehicle_time_unique aktivan';
    RAISE NOTICE '   - Kompresija i retention politike podešene';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Baza je spremna za GPS sync!';
END $$;

-- migrate:down
-- Rollback - briše sve kreirane objekte
DROP VIEW IF EXISTS vehicle_summary CASCADE;
DROP VIEW IF EXISTS current_vehicle_positions CASCADE;
DROP FUNCTION IF EXISTS calculate_vehicle_mileage CASCADE;
DROP FUNCTION IF EXISTS update_garage_number CASCADE;
DROP MATERIALIZED VIEW IF EXISTS daily_vehicle_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vehicle_hourly_stats CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS driving_events CASCADE;
DROP TABLE IF EXISTS gps_data CASCADE;
DROP TYPE IF EXISTS driving_event_type CASCADE;
DROP FUNCTION IF EXISTS set_gps_location CASCADE;