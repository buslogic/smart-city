-- migrate:up

-- Kreiraj batch_processing_log tabelu za praćenje batch procesiranja
CREATE TABLE IF NOT EXISTS batch_processing_log (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    vehicle_id INTEGER NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    rows_processed BIGINT NOT NULL DEFAULT 0,
    outliers_detected BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    processing_seconds NUMERIC(10, 3)
);

-- Indeksi za brže upite
CREATE INDEX IF NOT EXISTS idx_batch_log_batch_id ON batch_processing_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_log_vehicle_id ON batch_processing_log(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_batch_log_status ON batch_processing_log(status);
CREATE INDEX IF NOT EXISTS idx_batch_log_created_at ON batch_processing_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_log_time_range ON batch_processing_log(start_time, end_time);

-- Ažuriraj process_vehicles_parallel() da loguje u batch_processing_log
CREATE OR REPLACE FUNCTION process_vehicles_parallel(
    p_start_time timestamptz,
    p_end_time timestamptz,
    p_vehicle_ids integer[] DEFAULT NULL,
    p_max_parallel integer DEFAULT 5
) RETURNS TABLE(
    vehicle_id integer,
    batch_id bigint,
    rows_processed bigint,
    outliers_detected bigint,
    status text,
    error_message text
) AS $$
DECLARE
    v_vehicle_id integer;
    v_batch_id bigint;
    v_log_id bigint;
    v_rows_processed bigint;
    v_outliers_detected bigint;
    v_vehicles_to_process integer[];
    v_start_time timestamptz;
BEGIN
    -- Generate batch_id from start_time (epoch timestamp)
    v_batch_id := extract(epoch from p_start_time)::bigint;

    -- Ako nisu navedena vozila, pronađi automatski
    IF p_vehicle_ids IS NULL THEN
        SELECT array_agg(vnp.vehicle_id)
        INTO v_vehicles_to_process
        FROM find_next_vehicles_to_process(
            p_start_time,
            p_end_time,
            p_max_parallel
        ) vnp;
    ELSE
        v_vehicles_to_process := p_vehicle_ids;
    END IF;

    -- Procesiranje svakog vozila pojedinačno
    FOREACH v_vehicle_id IN ARRAY v_vehicles_to_process
    LOOP
        BEGIN
            -- Pokušaj da dobiješ lock za ovo vozilo
            IF try_lock_batch(p_start_time, p_end_time, v_vehicle_id) THEN
                -- Kreiraj log entry (status: in_progress)
                v_start_time := clock_timestamp();

                INSERT INTO batch_processing_log (
                    batch_id,
                    vehicle_id,
                    start_time,
                    end_time,
                    status
                ) VALUES (
                    v_batch_id,
                    v_vehicle_id,
                    p_start_time,
                    p_end_time,
                    'in_progress'
                ) RETURNING id INTO v_log_id;

                -- Procesuj vozilo
                SELECT
                    pgs.rows_processed,
                    pgs.outliers_detected
                INTO
                    v_rows_processed,
                    v_outliers_detected
                FROM process_gps_batch_safe(
                    p_start_time,
                    p_end_time,
                    v_vehicle_id
                ) pgs;

                -- Unlock
                PERFORM unlock_batch(p_start_time, p_end_time, v_vehicle_id);

                -- Ažuriraj log entry (status: completed)
                UPDATE batch_processing_log
                SET
                    rows_processed = v_rows_processed,
                    outliers_detected = v_outliers_detected,
                    status = 'completed',
                    completed_at = clock_timestamp(),
                    processing_seconds = EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))
                WHERE id = v_log_id;

                -- Return rezultat
                RETURN QUERY
                SELECT
                    v_vehicle_id,
                    v_batch_id,
                    v_rows_processed,
                    v_outliers_detected,
                    'completed'::text,
                    NULL::text;
            ELSE
                -- Vozilo je već zaključano (neko drugi ga procesira)
                -- Log as skipped
                INSERT INTO batch_processing_log (
                    batch_id,
                    vehicle_id,
                    start_time,
                    end_time,
                    status,
                    error_message,
                    completed_at
                ) VALUES (
                    v_batch_id,
                    v_vehicle_id,
                    p_start_time,
                    p_end_time,
                    'skipped',
                    'Vehicle already being processed',
                    NOW()
                );

                RETURN QUERY
                SELECT
                    v_vehicle_id,
                    v_batch_id,
                    0::bigint,
                    0::bigint,
                    'skipped'::text,
                    'Vehicle already being processed'::text;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            -- Error handling
            PERFORM unlock_batch(p_start_time, p_end_time, v_vehicle_id);

            -- Ažuriraj log entry (status: failed)
            IF v_log_id IS NOT NULL THEN
                UPDATE batch_processing_log
                SET
                    status = 'failed',
                    error_message = SQLERRM,
                    completed_at = clock_timestamp(),
                    processing_seconds = EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))
                WHERE id = v_log_id;
            ELSE
                -- Kreiraj novi log entry ako nije kreiran ranije
                INSERT INTO batch_processing_log (
                    batch_id,
                    vehicle_id,
                    start_time,
                    end_time,
                    status,
                    error_message,
                    completed_at
                ) VALUES (
                    v_batch_id,
                    v_vehicle_id,
                    p_start_time,
                    p_end_time,
                    'failed',
                    SQLERRM,
                    NOW()
                );
            END IF;

            RETURN QUERY
            SELECT
                v_vehicle_id,
                v_batch_id,
                0::bigint,
                0::bigint,
                'failed'::text,
                SQLERRM::text;
        END;

        -- Reset v_log_id za sledeći loop
        v_log_id := NULL;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ažuriraj v_processing_overview view da uključuje batch statistike
CREATE OR REPLACE VIEW v_processing_overview AS
SELECT
    -- GPS data statistike
    (SELECT COUNT(*) FROM gps_data) as total_raw_points,
    (SELECT COUNT(DISTINCT vehicle_id) FROM gps_data) as total_vehicles,
    (SELECT MIN(time) FROM gps_data) as earliest_data,
    (SELECT MAX(time) FROM gps_data) as latest_data,

    -- Procesiranje statistike
    (SELECT COUNT(*) FROM gps_data_lag_filtered) as total_processed_points,
    (SELECT COUNT(DISTINCT vehicle_id) FROM gps_data_lag_filtered) as processed_vehicles,
    (SELECT COUNT(*) FROM gps_data_lag_filtered WHERE is_outlier = true) as total_outliers,
    (SELECT MIN(time) FROM gps_data_lag_filtered) as earliest_processed,
    (SELECT MAX(time) FROM gps_data_lag_filtered) as latest_processed,
    (SELECT MAX(created_at) FROM batch_processing_log WHERE status = 'completed') as last_processing_time,

    -- Percentages
    ROUND(
        (SELECT COUNT(*)::numeric FROM gps_data_lag_filtered) /
        NULLIF((SELECT COUNT(*)::numeric FROM gps_data), 0) * 100,
        2
    ) as processing_percentage,
    ROUND(
        (SELECT COUNT(*)::numeric FROM gps_data_lag_filtered WHERE is_outlier = true) /
        NULLIF((SELECT COUNT(*)::numeric FROM gps_data_lag_filtered), 0) * 100,
        2
    ) as outlier_percentage,

    -- Batch statistike (iz batch_processing_log)
    (SELECT COUNT(DISTINCT batch_id) FROM batch_processing_log) as total_batches,
    (SELECT COUNT(DISTINCT batch_id) FROM batch_processing_log WHERE status = 'completed') as completed_batches,
    (SELECT COUNT(DISTINCT batch_id) FROM batch_processing_log WHERE status = 'failed') as failed_batches,
    (SELECT COUNT(DISTINCT batch_id) FROM batch_processing_log WHERE status = 'in_progress') as active_batches,

    -- Performanse
    (SELECT AVG(processing_seconds) FROM batch_processing_log WHERE status = 'completed') as avg_processing_seconds,

    -- Processing lag (razlika između najnovijih raw podataka i procesiranih)
    (
        SELECT (SELECT MAX(time) FROM gps_data) - (SELECT MAX(time) FROM gps_data_lag_filtered)
    ) as processing_lag,

    -- Procena koliko sati treba da se završi procesiranje (na osnovu avg brzine)
    CASE
        WHEN (SELECT AVG(processing_seconds) FROM batch_processing_log WHERE status = 'completed') > 0
        THEN ROUND(
            (
                (SELECT COUNT(*) FROM gps_data) -
                (SELECT COUNT(*) FROM gps_data_lag_filtered)
            )::numeric /
            NULLIF(
                (
                    SELECT AVG(rows_processed / NULLIF(processing_seconds, 0))
                    FROM batch_processing_log
                    WHERE status = 'completed' AND processing_seconds > 0
                ),
                0
            ) / 3600,
            2
        )
        ELSE NULL
    END as estimated_hours_to_completion;

-- migrate:down

-- Drop updated function
DROP FUNCTION IF EXISTS process_vehicles_parallel(timestamptz, timestamptz, integer[], integer);

-- Restore old version (without logging)
CREATE OR REPLACE FUNCTION process_vehicles_parallel(
    p_start_time timestamptz,
    p_end_time timestamptz,
    p_vehicle_ids integer[] DEFAULT NULL,
    p_max_parallel integer DEFAULT 5
) RETURNS TABLE(
    vehicle_id integer,
    batch_id bigint,
    rows_processed bigint,
    outliers_detected bigint,
    status text,
    error_message text
) AS $$
DECLARE
    v_vehicle_id integer;
    v_rows_processed bigint;
    v_outliers_detected bigint;
    v_vehicles_to_process integer[];
BEGIN
    IF p_vehicle_ids IS NULL THEN
        SELECT array_agg(vnp.vehicle_id)
        INTO v_vehicles_to_process
        FROM find_next_vehicles_to_process(
            p_start_time,
            p_end_time,
            p_max_parallel
        ) vnp;
    ELSE
        v_vehicles_to_process := p_vehicle_ids;
    END IF;

    FOREACH v_vehicle_id IN ARRAY v_vehicles_to_process
    LOOP
        BEGIN
            IF try_lock_batch(p_start_time, p_end_time, v_vehicle_id) THEN
                SELECT
                    pgs.rows_processed,
                    pgs.outliers_detected
                INTO
                    v_rows_processed,
                    v_outliers_detected
                FROM process_gps_batch_safe(
                    p_start_time,
                    p_end_time,
                    v_vehicle_id
                ) pgs;

                PERFORM unlock_batch(p_start_time, p_end_time, v_vehicle_id);

                RETURN QUERY
                SELECT
                    v_vehicle_id,
                    extract(epoch from p_start_time)::bigint as batch_id,
                    v_rows_processed,
                    v_outliers_detected,
                    'completed'::text,
                    NULL::text;
            ELSE
                RETURN QUERY
                SELECT
                    v_vehicle_id,
                    NULL::bigint,
                    0::bigint,
                    0::bigint,
                    'skipped'::text,
                    'Vehicle already being processed'::text;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            PERFORM unlock_batch(p_start_time, p_end_time, v_vehicle_id);

            RETURN QUERY
            SELECT
                v_vehicle_id,
                NULL::bigint,
                0::bigint,
                0::bigint,
                'failed'::text,
                SQLERRM::text;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Restore old view
CREATE OR REPLACE VIEW v_processing_overview AS
SELECT
    (SELECT COUNT(*) FROM gps_data) as total_raw_points,
    (SELECT COUNT(DISTINCT vehicle_id) FROM gps_data) as total_vehicles,
    (SELECT MIN(time) FROM gps_data) as earliest_data,
    (SELECT MAX(time) FROM gps_data) as latest_data,
    (SELECT COUNT(*) FROM gps_data_lag_filtered) as total_processed_points,
    (SELECT COUNT(DISTINCT vehicle_id) FROM gps_data_lag_filtered) as processed_vehicles,
    (SELECT COUNT(*) FROM gps_data_lag_filtered WHERE is_outlier = true) as total_outliers,
    (SELECT MIN(time) FROM gps_data_lag_filtered) as earliest_processed,
    (SELECT MAX(time) FROM gps_data_lag_filtered) as latest_processed,
    (SELECT MAX(time) FROM gps_data_lag_filtered) as last_processing_time,
    ROUND(
        (SELECT COUNT(*)::numeric FROM gps_data_lag_filtered) /
        NULLIF((SELECT COUNT(*)::numeric FROM gps_data), 0) * 100,
        2
    ) as processing_percentage,
    ROUND(
        (SELECT COUNT(*)::numeric FROM gps_data_lag_filtered WHERE is_outlier = true) /
        NULLIF((SELECT COUNT(*)::numeric FROM gps_data_lag_filtered), 0) * 100,
        2
    ) as outlier_percentage,
    0 as total_batches,
    0 as completed_batches,
    0 as failed_batches,
    0 as active_batches,
    NULL as avg_processing_seconds,
    (
        SELECT (SELECT MAX(time) FROM gps_data) - (SELECT MAX(time) FROM gps_data_lag_filtered)
    ) as processing_lag,
    '0' as estimated_hours_to_completion;

-- Drop table
DROP TABLE IF EXISTS batch_processing_log;

