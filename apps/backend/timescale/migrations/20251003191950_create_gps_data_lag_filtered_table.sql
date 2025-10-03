-- migrate:up
-- ==============================================================================
-- GPS DATA LAG FILTERED TABLE
-- ==============================================================================
-- Filtrirani GPS podaci sa LAG() kalkulacijama za outlier detekciju.
-- Ova tabela čuva sve GPS podatke sa dodatnim metrikama koje omogućavaju
-- precizno filtriranje outlier-a za potrebe obračuna kilometraže.
-- ==============================================================================

-- Kreiranje glavne tabele za filtrirane podatke
CREATE TABLE gps_data_lag_filtered (
    -- Originalne kolone iz gps_data
    time TIMESTAMPTZ NOT NULL,
    vehicle_id INTEGER NOT NULL,
    garage_no VARCHAR(50),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    location geometry(Point, 4326),
    speed DOUBLE PRECISION,
    course DOUBLE PRECISION,
    alt DOUBLE PRECISION,
    state INTEGER,
    in_route BOOLEAN,
    line_number VARCHAR(50),
    departure_id INTEGER,
    people_in INTEGER,
    people_out INTEGER,
    data_source VARCHAR(50),

    -- LAG kalkulacije
    prev_location geometry(Point, 4326),
    prev_time TIMESTAMPTZ,
    distance_from_prev NUMERIC(10,2),           -- metri
    time_from_prev INTERVAL,
    calculated_speed_kmh NUMERIC(5,2),          -- brzina između tačaka

    -- Outlier detekcija
    is_outlier BOOLEAN DEFAULT FALSE,
    outlier_type VARCHAR(50),                   -- 'distance_jump', 'speed_spike', 'teleport', 'bad_signal'
    outlier_severity VARCHAR(20),               -- 'low', 'medium', 'high'

    -- Processing metadata
    batch_id BIGINT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    processing_version INTEGER DEFAULT 1,       -- za buduće re-procesiranje sa drugim pragovima

    -- Primarni ključ (kompozitni)
    PRIMARY KEY (vehicle_id, time)
);

-- Kreiraj hypertable
SELECT create_hypertable(
    'gps_data_lag_filtered',
    'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Indeksi za performanse
CREATE INDEX idx_lag_filtered_vehicle_time
ON gps_data_lag_filtered(vehicle_id, time DESC);

CREATE INDEX idx_lag_filtered_batch
ON gps_data_lag_filtered(batch_id);

CREATE INDEX idx_lag_filtered_garage_time
ON gps_data_lag_filtered(garage_no, time DESC);

-- Indeks za outlier analizu
CREATE INDEX idx_lag_filtered_outliers
ON gps_data_lag_filtered(is_outlier, outlier_type)
WHERE is_outlier = TRUE;

-- Indeks za Belgrade timezone queries
CREATE INDEX idx_lag_filtered_belgrade_date
ON gps_data_lag_filtered(
    DATE(time AT TIME ZONE 'Europe/Belgrade'),
    vehicle_id
);

-- ==============================================================================
-- PROCESSING STATUS TRACKING TABLE
-- ==============================================================================
-- Prati status batch procesiranja podataka
-- ==============================================================================

CREATE TABLE gps_processing_status (
    id SERIAL PRIMARY KEY,

    -- Batch info
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    vehicle_id INTEGER,                        -- NULL = sva vozila
    batch_type VARCHAR(20) DEFAULT 'time',     -- 'time', 'vehicle', 'recovery', 'backfill'

    -- Processing info
    total_rows_expected BIGINT,
    rows_processed BIGINT DEFAULT 0,
    rows_filtered BIGINT DEFAULT 0,            -- broj outlier-a
    rows_failed BIGINT DEFAULT 0,

    -- Timing
    processing_started_at TIMESTAMPTZ DEFAULT NOW(),
    processing_completed_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),

    -- Status
    status VARCHAR(20) DEFAULT 'pending',      -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
    progress_percent NUMERIC(5,2),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Metadata
    processor_id VARCHAR(100),                 -- hostname ili worker ID
    batch_params JSONB,

    -- Unique constraint da sprečimo duplo procesiranje
    CONSTRAINT unique_batch UNIQUE(start_time, end_time, vehicle_id)
);

-- Indeksi za brže query-je
CREATE INDEX idx_processing_status ON gps_processing_status(status);
CREATE INDEX idx_processing_time ON gps_processing_status(start_time DESC, end_time DESC);
CREATE INDEX idx_processing_status_pending ON gps_processing_status(status)
WHERE status IN ('pending', 'processing');

-- ==============================================================================
-- PROCESSING LOG TABLE
-- ==============================================================================
-- Detaljan log procesiranja za debugging
-- ==============================================================================

CREATE TABLE gps_processing_log (
    id BIGSERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES gps_processing_status(id) ON DELETE CASCADE,
    log_time TIMESTAMPTZ DEFAULT NOW(),
    log_level VARCHAR(20),                     -- 'debug', 'info', 'warning', 'error'
    message TEXT,
    details JSONB,

    -- Constraint za log level
    CHECK (log_level IN ('debug', 'info', 'warning', 'error'))
);

CREATE INDEX idx_log_batch ON gps_processing_log(batch_id);
CREATE INDEX idx_log_time ON gps_processing_log(log_time DESC);
CREATE INDEX idx_log_level ON gps_processing_log(log_level)
WHERE log_level IN ('warning', 'error');

-- ==============================================================================
-- HELPER VIEWS
-- ==============================================================================

-- View za monitoring trenutnog statusa
CREATE VIEW v_processing_status AS
SELECT
    -- Batch statistics
    COUNT(*) FILTER (WHERE status = 'completed') as completed_batches,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_batches,
    COUNT(*) FILTER (WHERE status = 'processing') as active_batches,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_batches,

    -- Row statistics
    SUM(rows_processed) as total_rows_processed,
    SUM(rows_filtered) as total_outliers_found,

    -- Time statistics
    MAX(end_time) FILTER (WHERE status = 'completed') as last_processed_time,
    MIN(start_time) FILTER (WHERE status = 'pending') as next_pending_time,

    -- Performance
    AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)))
        FILTER (WHERE status = 'completed') as avg_processing_seconds
FROM gps_processing_status;

-- View za outlier statistiku
CREATE VIEW v_outlier_statistics AS
SELECT
    DATE(time AT TIME ZONE 'Europe/Belgrade') as date_belgrade,
    vehicle_id,
    garage_no,
    COUNT(*) as total_points,
    COUNT(*) FILTER (WHERE is_outlier) as outlier_points,
    ROUND((COUNT(*) FILTER (WHERE is_outlier)::NUMERIC / COUNT(*) * 100), 2) as outlier_percentage,

    -- Outlier breakdown
    COUNT(*) FILTER (WHERE outlier_type = 'distance_jump') as distance_jumps,
    COUNT(*) FILTER (WHERE outlier_type = 'speed_spike') as speed_spikes,
    COUNT(*) FILTER (WHERE outlier_type = 'teleport') as teleports,
    COUNT(*) FILTER (WHERE outlier_type = 'bad_signal') as bad_signals,

    -- Distance statistics
    SUM(distance_from_prev) FILTER (WHERE NOT is_outlier) / 1000 as valid_km,
    SUM(distance_from_prev) / 1000 as total_km

FROM gps_data_lag_filtered
GROUP BY DATE(time AT TIME ZONE 'Europe/Belgrade'), vehicle_id, garage_no;

-- ==============================================================================
-- COMPRESSION SETTINGS
-- ==============================================================================

-- Podesi kompresiju za uštedu prostora
-- NAPOMENA: vehicle_id je u segmentby, pa ne može biti u orderby
ALTER TABLE gps_data_lag_filtered SET (
    timescaledb.compress,
    timescaledb.compress_orderby = 'time DESC',
    timescaledb.compress_segmentby = 'vehicle_id'
);

-- Kompresuj chunk-ove starije od 30 dana
SELECT add_compression_policy(
    'gps_data_lag_filtered',
    compress_after => INTERVAL '30 days',
    if_not_exists => TRUE
);

-- ==============================================================================
-- COMMENTS
-- ==============================================================================

COMMENT ON TABLE gps_data_lag_filtered IS
'Filtrirani GPS podaci sa LAG kalkulacijama za outlier detekciju.
Procesira se batch-ovima iz gps_data tabele.
Koristi se za precizne kalkulacije kilometraže bez GPS glitch-eva.';

COMMENT ON TABLE gps_processing_status IS
'Tracking tabela za batch procesiranje GPS podataka.
Omogućava recovery od prekida i monitoring napretka.';

COMMENT ON TABLE gps_processing_log IS
'Detaljan log procesiranja za debugging i analizu.';

-- migrate:down
-- Brisanje kompresije
SELECT remove_compression_policy('gps_data_lag_filtered', if_exists => true);

-- Brisanje view-ova
DROP VIEW IF EXISTS v_outlier_statistics CASCADE;
DROP VIEW IF EXISTS v_processing_status CASCADE;

-- Brisanje tabela (redosled je važan zbog foreign key-eva)
DROP TABLE IF EXISTS gps_processing_log CASCADE;
DROP TABLE IF EXISTS gps_processing_status CASCADE;
DROP TABLE IF EXISTS gps_data_lag_filtered CASCADE;
