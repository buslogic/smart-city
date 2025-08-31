-- ======================================
-- AGGRESSIVE DRIVING DETECTION SYSTEM
-- MVP Implementation - Driving Events Table
-- ======================================

-- Drop existing objects if they exist
DROP TABLE IF EXISTS driving_events CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS severity_level CASCADE;

-- Create ENUM types for better data integrity
CREATE TYPE event_type AS ENUM (
    'acceleration',
    'braking',
    'cornering',
    'harsh_stop',
    'harsh_start'
);

CREATE TYPE severity_level AS ENUM (
    'normal',
    'moderate',
    'severe'
);

-- Main driving events table
CREATE TABLE driving_events (
    id              SERIAL,
    time            TIMESTAMPTZ NOT NULL,
    vehicle_id      INTEGER NOT NULL,
    garage_no       VARCHAR(20) NOT NULL,
    
    -- Event details
    event_type      event_type NOT NULL,
    severity        severity_level NOT NULL,
    
    -- Physics data
    acceleration_value  NUMERIC(6,3) NOT NULL, -- m/s² (može biti negativno za kočenje)
    g_force            NUMERIC(5,3), -- G-force (acceleration / 9.81)
    speed_before       NUMERIC(5,2), -- km/h
    speed_after        NUMERIC(5,2), -- km/h
    duration_ms        INTEGER, -- trajanje događaja u milisekundama
    distance_meters    NUMERIC(8,2), -- pređeno rastojanje tokom događaja
    
    -- Location data
    location        GEOMETRY(Point, 4326) NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    
    -- Additional context (može biti NULL)
    heading         SMALLINT, -- pravac kretanja (0-360)
    altitude        SMALLINT, -- nadmorska visina
    
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    processed_at    TIMESTAMPTZ DEFAULT NOW(),
    
    -- Quality flags
    is_validated    BOOLEAN DEFAULT TRUE, -- da li je događaj validiran (nije GPS greška)
    confidence      NUMERIC(3,2) DEFAULT 1.0, -- 0.0 to 1.0 confidence level
    
    -- Composite primary key for hypertable
    PRIMARY KEY (id, time)
);

-- Convert to hypertable for better time-series performance
SELECT create_hypertable('driving_events', 'time', 
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Create indexes for better query performance
CREATE INDEX idx_driving_events_vehicle_time ON driving_events (vehicle_id, time DESC);
CREATE INDEX idx_driving_events_garage_time ON driving_events (garage_no, time DESC);
CREATE INDEX idx_driving_events_type_severity ON driving_events (event_type, severity);
CREATE INDEX idx_driving_events_location ON driving_events USING GIST (location);
CREATE INDEX idx_driving_events_severity_time ON driving_events (severity, time DESC) 
    WHERE severity IN ('moderate', 'severe');

-- Function to automatically calculate G-force
CREATE OR REPLACE FUNCTION calculate_g_force()
RETURNS TRIGGER AS $$
BEGIN
    NEW.g_force = ABS(NEW.acceleration_value) / 9.81;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate G-force
CREATE TRIGGER calculate_g_force_trigger
BEFORE INSERT OR UPDATE ON driving_events
FOR EACH ROW
EXECUTE FUNCTION calculate_g_force();

-- ======================================
-- MAIN DETECTION FUNCTION
-- Analizira GPS podatke i detektuje agresivnu vožnju
-- ======================================

CREATE OR REPLACE FUNCTION detect_aggressive_driving_batch(
    p_vehicle_id INTEGER,
    p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
    p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    detected_events INTEGER,
    severe_count INTEGER,
    moderate_count INTEGER,
    processing_time_ms INTEGER
) AS $$
DECLARE
    v_start_process TIMESTAMPTZ;
    v_detected INTEGER := 0;
    v_severe INTEGER := 0;
    v_moderate INTEGER := 0;
BEGIN
    v_start_process := clock_timestamp();
    
    -- Insert detected events
    WITH gps_pairs AS (
        -- Uzimamo parove uzastopnih GPS tačaka
        SELECT 
            g1.time as time1,
            g2.time as time2,
            g1.vehicle_id,
            g1.garage_no,
            g1.speed as speed1,
            g2.speed as speed2,
            g1.lat as lat1,
            g1.lng as lng1,
            g2.lat as lat2,
            g2.lng as lng2,
            g1.location as loc1,
            g2.location as loc2,
            g1.course as heading1,
            g2.course as heading2,
            g1.alt as altitude,
            EXTRACT(EPOCH FROM (g2.time - g1.time)) as time_diff_seconds,
            -- Kalkulacija rastojanja u metrima koristeći PostGIS
            ST_Distance(g1.location::geography, g2.location::geography) as distance_meters
        FROM gps_data g1
        INNER JOIN gps_data g2 ON (
            g1.vehicle_id = g2.vehicle_id 
            AND g2.time > g1.time
            AND g2.time <= g1.time + INTERVAL '10 seconds' -- Max 10 sekundi između tačaka
        )
        WHERE g1.vehicle_id = p_vehicle_id
            AND g1.time BETWEEN p_start_time AND p_end_time
            AND g2.time BETWEEN p_start_time AND p_end_time
            AND g1.speed IS NOT NULL 
            AND g2.speed IS NOT NULL
            -- Filtriramo očigledne GPS greške
            AND ST_Distance(g1.location::geography, g2.location::geography) < 500 -- Max 500m između tačaka
        ORDER BY g1.time
    ),
    acceleration_calc AS (
        SELECT 
            *,
            -- Konverzija brzine iz km/h u m/s
            speed1 * 0.27778 as speed1_ms,
            speed2 * 0.27778 as speed2_ms,
            -- Kalkulacija ubrzanja: a = (v2 - v1) / t
            CASE 
                WHEN time_diff_seconds > 0 THEN
                    ((speed2 * 0.27778) - (speed1 * 0.27778)) / time_diff_seconds
                ELSE 0
            END as acceleration_ms2,
            -- Kalkulacija promene pravca za cornering detekciju
            ABS(
                CASE 
                    WHEN ABS(heading2 - heading1) > 180 THEN
                        360 - ABS(heading2 - heading1)
                    ELSE 
                        ABS(heading2 - heading1)
                END
            ) as heading_change
        FROM gps_pairs
        WHERE time_diff_seconds BETWEEN 1 AND 10 -- Razumni vremenski interval
    ),
    events_to_insert AS (
        SELECT 
            time2 as event_time,
            vehicle_id,
            garage_no,
            -- Određujemo tip događaja
            CASE 
                WHEN acceleration_ms2 > 0 THEN 'acceleration'::event_type
                WHEN acceleration_ms2 < 0 THEN 'braking'::event_type
                ELSE 'acceleration'::event_type
            END as event_type,
            -- Određujemo severity na osnovu apsolutne vrednosti ubrzanja
            CASE 
                WHEN ABS(acceleration_ms2) > 4.0 THEN 'severe'::severity_level
                WHEN ABS(acceleration_ms2) > 2.5 THEN 'moderate'::severity_level
                ELSE 'normal'::severity_level
            END as severity,
            acceleration_ms2 as acceleration_value,
            speed1 as speed_before,
            speed2 as speed_after,
            (time_diff_seconds * 1000)::INTEGER as duration_ms,
            distance_meters,
            loc2 as location,
            lat2 as lat,
            lng2 as lng,
            heading2 as heading,
            altitude,
            -- Confidence score baziran na kvalitetu podataka
            CASE
                WHEN time_diff_seconds BETWEEN 2 AND 4 THEN 1.0
                WHEN time_diff_seconds BETWEEN 1 AND 5 THEN 0.9
                ELSE 0.8
            END as confidence
        FROM acceleration_calc
        WHERE ABS(acceleration_ms2) > 2.5 -- Prag za moderate events
    )
    INSERT INTO driving_events (
        time, vehicle_id, garage_no, event_type, severity,
        acceleration_value, speed_before, speed_after,
        duration_ms, distance_meters, location, lat, lng,
        heading, altitude, confidence, processed_at
    )
    SELECT 
        event_time, vehicle_id, garage_no, event_type, severity,
        acceleration_value, speed_before, speed_after,
        duration_ms, distance_meters, location, lat, lng,
        heading, altitude, confidence, NOW()
    FROM events_to_insert
    ON CONFLICT DO NOTHING; -- Izbegavamo duplikate
    
    -- Brojimo koliko smo eventi detektovali
    GET DIAGNOSTICS v_detected = ROW_COUNT;
    
    -- Brojimo severe i moderate events
    SELECT 
        COUNT(*) FILTER (WHERE severity = 'severe'),
        COUNT(*) FILTER (WHERE severity = 'moderate')
    INTO v_severe, v_moderate
    FROM driving_events
    WHERE vehicle_id = p_vehicle_id
        AND time BETWEEN p_start_time AND p_end_time
        AND processed_at >= v_start_process;
    
    RETURN QUERY SELECT 
        v_detected,
        v_severe,
        v_moderate,
        (EXTRACT(EPOCH FROM (clock_timestamp() - v_start_process)) * 1000)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- ======================================
-- HELPER FUNCTIONS FOR STATISTICS
-- ======================================

-- Funkcija za dobijanje statistike po vozilu
CREATE OR REPLACE FUNCTION get_vehicle_driving_statistics(
    p_vehicle_id INTEGER,
    p_start_date DATE DEFAULT CURRENT_DATE - 30,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_events INTEGER,
    severe_accelerations INTEGER,
    moderate_accelerations INTEGER,
    severe_brakings INTEGER,
    moderate_brakings INTEGER,
    avg_g_force NUMERIC,
    max_g_force NUMERIC,
    total_distance_km NUMERIC,
    events_per_100km NUMERIC,
    most_common_hour INTEGER,
    safety_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH event_stats AS (
        SELECT 
            COUNT(*) as total_events,
            COUNT(*) FILTER (WHERE event_type = 'acceleration' AND severity = 'severe') as severe_acc,
            COUNT(*) FILTER (WHERE event_type = 'acceleration' AND severity = 'moderate') as moderate_acc,
            COUNT(*) FILTER (WHERE event_type = 'braking' AND severity = 'severe') as severe_brake,
            COUNT(*) FILTER (WHERE event_type = 'braking' AND severity = 'moderate') as moderate_brake,
            AVG(g_force) as avg_g,
            MAX(g_force) as max_g,
            SUM(distance_meters) / 1000.0 as total_dist_km,
            MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM time)) as common_hour
        FROM driving_events
        WHERE vehicle_id = p_vehicle_id
            AND time::DATE BETWEEN p_start_date AND p_end_date
    )
    SELECT 
        total_events::INTEGER,
        severe_acc::INTEGER,
        moderate_acc::INTEGER,
        severe_brake::INTEGER,
        moderate_brake::INTEGER,
        ROUND(avg_g::NUMERIC, 3),
        ROUND(max_g::NUMERIC, 3),
        ROUND(total_dist_km::NUMERIC, 2),
        CASE 
            WHEN total_dist_km > 0 THEN 
                ROUND((total_events::NUMERIC / total_dist_km * 100)::NUMERIC, 2)
            ELSE 0
        END as events_per_100km,
        common_hour::INTEGER,
        -- Safety Score: 100 - (severe * 5 + moderate * 2) capped at 0
        GREATEST(0, 100 - (severe_acc + severe_brake) * 5 - (moderate_acc + moderate_brake) * 2)::INTEGER
    FROM event_stats;
END;
$$ LANGUAGE plpgsql;

-- ======================================
-- INITIAL DATA PROCESSING
-- ======================================

-- Procesirati postojeće podatke za vozilo P93597 (test)
-- SELECT * FROM detect_aggressive_driving_batch(
--     (SELECT vehicle_id FROM gps_data WHERE garage_no = 'P93597' LIMIT 1),
--     '2024-01-01'::TIMESTAMPTZ,
--     NOW()
-- );

-- Grant permissions
GRANT ALL ON driving_events TO smartcity_ts;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO smartcity_ts;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO smartcity_ts;

-- Komentari za dokumentaciju
COMMENT ON TABLE driving_events IS 'Tabela za čuvanje detektovanih događaja agresivne vožnje';
COMMENT ON COLUMN driving_events.acceleration_value IS 'Ubrzanje/usporenje u m/s² (negativno za kočenje)';
COMMENT ON COLUMN driving_events.g_force IS 'G-sila (automatski kalkulisano)';
COMMENT ON FUNCTION detect_aggressive_driving_batch IS 'Batch procesiranje GPS podataka za detekciju agresivne vožnje';
COMMENT ON FUNCTION get_vehicle_driving_statistics IS 'Dobijanje statistike agresivne vožnje po vozilu';