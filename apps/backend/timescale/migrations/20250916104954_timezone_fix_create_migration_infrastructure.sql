-- migrate:up
-- =====================================================
-- MIGRACIJA 1: Infrastruktura za timezone fix migraciju
-- Datum: 16.09.2025
-- Cilj: Kreirati tabele i procedure za kontrolisanu migraciju
-- Autor: Smart City Team
-- =====================================================

-- 1. Kreiraj status tabelu za praćenje migracije
CREATE TABLE IF NOT EXISTS migration_status (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    current_batch INTEGER DEFAULT 0,
    total_batches INTEGER DEFAULT 0,
    records_processed BIGINT DEFAULT 0,
    total_records BIGINT DEFAULT 0,
    processing_date DATE,
    started_at TIMESTAMP WITH TIME ZONE,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB
);

-- 2. Kreiraj log tabelu za detaljno praćenje
CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(100) NOT NULL,
    batch_number INTEGER,
    action VARCHAR(50),
    records_affected INTEGER,
    duration_ms INTEGER,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insertuj početni status za našu migraciju
INSERT INTO migration_status (migration_name, status, metadata)
VALUES (
    'timezone_fix_2025',
    'initialized',
    jsonb_build_object(
        'description', 'Ispravka timezone problema - pomeranje vremena za -2 sata',
        'strategy', 'SWAP table strategy sa minimal downtime',
        'estimated_records', 304000000,
        'created_by', 'dbmate migration',
        'version', '1.0.0'
    )
);

-- 4. Kreiraj helper funkciju za logovanje
CREATE OR REPLACE FUNCTION log_migration_progress(
    p_migration_name VARCHAR,
    p_action VARCHAR,
    p_message TEXT,
    p_records INTEGER DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_start_time TIMESTAMP;
BEGIN
    v_start_time := clock_timestamp();

    INSERT INTO migration_log (
        migration_name,
        action,
        message,
        records_affected,
        created_at
    ) VALUES (
        p_migration_name,
        p_action,
        p_message,
        p_records,
        NOW()
    );

    -- Takođe ispiši u server log
    RAISE NOTICE '[MIGRATION] %: % - %', p_migration_name, p_action, p_message;
END;
$$ LANGUAGE plpgsql;

-- 5. Kreiraj funkciju za update statusa
CREATE OR REPLACE FUNCTION update_migration_status(
    p_migration_name VARCHAR,
    p_status VARCHAR,
    p_current_batch INTEGER DEFAULT NULL,
    p_records_processed BIGINT DEFAULT NULL,
    p_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE migration_status
    SET
        status = p_status,
        current_batch = COALESCE(p_current_batch, current_batch),
        records_processed = COALESCE(p_records_processed, records_processed),
        last_update = NOW(),
        completed_at = CASE
            WHEN p_status IN ('completed', 'failed') THEN NOW()
            ELSE completed_at
        END,
        error_message = CASE
            WHEN p_status = 'failed' THEN p_message
            ELSE error_message
        END
    WHERE migration_name = p_migration_name;

    -- Log promenu
    PERFORM log_migration_progress(
        p_migration_name,
        'STATUS_CHANGE',
        FORMAT('Status changed to: %s', p_status),
        p_records_processed::INTEGER
    );
END;
$$ LANGUAGE plpgsql;

-- 6. Kreiraj view za lako praćenje statusa
CREATE OR REPLACE VIEW v_migration_progress AS
SELECT
    migration_name,
    status,
    current_batch,
    total_batches,
    records_processed,
    total_records,
    CASE
        WHEN total_records > 0 THEN
            ROUND((records_processed::NUMERIC / total_records) * 100, 2)
        ELSE 0
    END as progress_percent,
    started_at,
    last_update,
    CASE
        WHEN started_at IS NOT NULL THEN
            age(COALESCE(completed_at, NOW()), started_at)
        ELSE NULL
    END as duration,
    CASE
        WHEN records_processed > 0 AND started_at IS NOT NULL THEN
            ROUND(
                records_processed /
                EXTRACT(EPOCH FROM (NOW() - started_at))
            )
        ELSE 0
    END as records_per_second,
    error_message
FROM migration_status;

-- 7. Kreiraj novu tabelu gps_data_fixed (identična struktura)
CREATE TABLE IF NOT EXISTS gps_data_fixed (LIKE gps_data INCLUDING ALL);

-- 8. Konvertuj u TimescaleDB hypertable
SELECT create_hypertable(
    'gps_data_fixed',
    'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- 9. Kopiraj compression settings
ALTER TABLE gps_data_fixed SET (
    timescaledb.compress,
    timescaledb.compress_orderby = 'time DESC',
    timescaledb.compress_segmentby = 'vehicle_id'
);

-- 10. Verifikacija i log
DO $$
DECLARE
    v_columns_count INTEGER;
    v_indexes_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_columns_count
    FROM information_schema.columns
    WHERE table_name = 'gps_data_fixed';

    SELECT COUNT(*) INTO v_indexes_count
    FROM pg_indexes
    WHERE tablename = 'gps_data_fixed';

    PERFORM log_migration_progress(
        'timezone_fix_2025',
        'TABLE_CREATED',
        FORMAT('Created gps_data_fixed table with %s columns and %s indexes',
               v_columns_count, v_indexes_count),
        NULL
    );

    -- Update status
    PERFORM update_migration_status(
        'timezone_fix_2025',
        'ready_for_migration',
        NULL,
        NULL,
        'Infrastructure created, ready to start migration'
    );
END $$;

-- Grant permissions
GRANT SELECT ON migration_status TO PUBLIC;
GRANT SELECT ON migration_log TO PUBLIC;
GRANT SELECT ON v_migration_progress TO PUBLIC;

-- migrate:down
-- Rollback: Obriši infrastrukturu
DROP VIEW IF EXISTS v_migration_progress CASCADE;
DROP FUNCTION IF EXISTS update_migration_status CASCADE;
DROP FUNCTION IF EXISTS log_migration_progress CASCADE;
DROP TABLE IF EXISTS migration_log CASCADE;
DROP TABLE IF EXISTS migration_status CASCADE;
DROP TABLE IF EXISTS gps_data_fixed CASCADE;