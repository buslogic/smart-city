-- migrate:up

-- =====================================================
-- PARALLEL PROCESSING FUNCTIONS
-- =====================================================

-- 1. Advisory Lock Helper - sprečava da isti batch bude procesiran dva puta
CREATE OR REPLACE FUNCTION try_lock_batch(
    p_start_time timestamptz,
    p_end_time timestamptz,
    p_vehicle_id integer DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
    v_lock_key bigint;
BEGIN
    -- Generiši jedinstveni lock key od parametara
    v_lock_key := (
        extract(epoch from p_start_time)::bigint * 1000000 +
        extract(epoch from p_end_time)::bigint +
        COALESCE(p_vehicle_id, 0)
    );

    -- Pokušaj da dobiješ advisory lock (non-blocking)
    RETURN pg_try_advisory_lock(v_lock_key);
END;
$$ LANGUAGE plpgsql;

-- 2. Unlock Batch
CREATE OR REPLACE FUNCTION unlock_batch(
    p_start_time timestamptz,
    p_end_time timestamptz,
    p_vehicle_id integer DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
    v_lock_key bigint;
BEGIN
    v_lock_key := (
        extract(epoch from p_start_time)::bigint * 1000000 +
        extract(epoch from p_end_time)::bigint +
        COALESCE(p_vehicle_id, 0)
    );

    RETURN pg_advisory_unlock(v_lock_key);
END;
$$ LANGUAGE plpgsql;

-- 3. Find Next Vehicles to Process - pronalazi vozila koja čekaju procesiranje
CREATE OR REPLACE FUNCTION find_next_vehicles_to_process(
    p_start_time timestamptz,
    p_end_time timestamptz,
    p_limit integer DEFAULT 5
) RETURNS TABLE(
    vehicle_id integer,
    garage_no varchar(50),
    estimated_rows bigint,
    last_processed_time timestamptz
) AS $$
BEGIN
    RETURN QUERY
    WITH vehicle_data AS (
        -- Pronađi vozila koja imaju podatke u ovom periodu
        SELECT DISTINCT
            g.vehicle_id,
            g.garage_no,
            COUNT(*) as row_count
        FROM gps_data g
        WHERE
            g.time >= p_start_time
            AND g.time < p_end_time
            AND NOT EXISTS (
                SELECT 1 FROM gps_data_lag_filtered f
                WHERE f.time = g.time AND f.vehicle_id = g.vehicle_id
            )
        GROUP BY g.vehicle_id, g.garage_no
    ),
    processing_status AS (
        -- Proveri koji batch-evi su već u obradi
        SELECT DISTINCT
            ps.vehicle_id
        FROM gps_processing_status ps
        WHERE
            ps.start_time = p_start_time
            AND ps.end_time = p_end_time
            AND ps.status IN ('processing', 'completed')
    )
    SELECT
        vd.vehicle_id,
        vd.garage_no,
        vd.row_count,
        (
            SELECT MAX(f.time)
            FROM gps_data_lag_filtered f
            WHERE f.vehicle_id = vd.vehicle_id
        ) as last_processed_time
    FROM vehicle_data vd
    WHERE NOT EXISTS (
        SELECT 1 FROM processing_status ps
        WHERE ps.vehicle_id = vd.vehicle_id
    )
    ORDER BY vd.row_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 4. Process Multiple Vehicles in Parallel - glavna funkcija
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
    v_batch_result record;
    v_vehicles_to_process integer[];
BEGIN
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

                -- Procesuj vozilo
                SELECT * INTO v_batch_result
                FROM process_gps_batch_safe(
                    p_start_time,
                    p_end_time,
                    v_vehicle_id
                );

                -- Unlock
                PERFORM unlock_batch(p_start_time, p_end_time, v_vehicle_id);

                -- Return rezultat
                RETURN QUERY
                SELECT
                    v_vehicle_id,
                    v_batch_result.batch_id,
                    v_batch_result.rows_processed,
                    v_batch_result.outliers_detected,
                    'completed'::text,
                    NULL::text;
            ELSE
                -- Vozilo je već zaključano (neko drugi ga procesira)
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
            -- Error handling
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

-- 5. Get Processing Queue - prikaz statusa svih batch-eva
CREATE OR REPLACE FUNCTION get_processing_queue(
    p_hours_back integer DEFAULT 24
) RETURNS TABLE(
    period_start timestamptz,
    period_end timestamptz,
    total_vehicles integer,
    pending_vehicles integer,
    processing_vehicles integer,
    completed_vehicles integer,
    failed_vehicles integer,
    estimated_total_rows bigint
) AS $$
BEGIN
    RETURN QUERY
    WITH time_periods AS (
        -- Generiši sve satne periode za poslednjih N sati
        SELECT
            gs as period_start,
            gs + interval '1 hour' as period_end
        FROM generate_series(
            date_trunc('hour', NOW() - (p_hours_back || ' hours')::interval),
            date_trunc('hour', NOW()),
            '1 hour'::interval
        ) gs
    ),
    vehicle_counts AS (
        SELECT
            tp.period_start,
            tp.period_end,
            COUNT(DISTINCT g.vehicle_id) as total_vehicles,
            SUM(
                CASE
                    WHEN NOT EXISTS (
                        SELECT 1 FROM gps_data_lag_filtered f
                        WHERE f.time = g.time AND f.vehicle_id = g.vehicle_id
                    ) THEN 1
                    ELSE 0
                END
            ) as estimated_rows
        FROM time_periods tp
        LEFT JOIN gps_data g ON
            g.time >= tp.period_start
            AND g.time < tp.period_end
        GROUP BY tp.period_start, tp.period_end
    ),
    status_counts AS (
        SELECT
            ps.start_time,
            ps.end_time,
            COUNT(*) FILTER (WHERE ps.status = 'pending') as pending,
            COUNT(*) FILTER (WHERE ps.status = 'processing') as processing,
            COUNT(*) FILTER (WHERE ps.status = 'completed') as completed,
            COUNT(*) FILTER (WHERE ps.status = 'failed') as failed
        FROM gps_processing_status ps
        WHERE ps.start_time >= NOW() - (p_hours_back || ' hours')::interval
        GROUP BY ps.start_time, ps.end_time
    )
    SELECT
        vc.period_start,
        vc.period_end,
        vc.total_vehicles,
        COALESCE(sc.pending, vc.total_vehicles)::integer,
        COALESCE(sc.processing, 0)::integer,
        COALESCE(sc.completed, 0)::integer,
        COALESCE(sc.failed, 0)::integer,
        vc.estimated_rows
    FROM vehicle_counts vc
    LEFT JOIN status_counts sc ON
        sc.start_time = vc.period_start
        AND sc.end_time = vc.period_end
    WHERE vc.estimated_rows > 0
    ORDER BY vc.period_start DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. View za monitoring paralelnog procesiranja
CREATE OR REPLACE VIEW v_parallel_processing_status AS
WITH current_locks AS (
    SELECT
        locktype,
        database,
        classid,
        objid,
        mode,
        granted,
        pid,
        pg_blocking_pids(pid) as blocking_pids
    FROM pg_locks
    WHERE locktype = 'advisory'
),
active_batches AS (
    SELECT
        ps.*,
        CASE
            WHEN ps.status = 'processing' AND cl.granted
            THEN true
            ELSE false
        END as has_lock,
        cl.pid as lock_pid,
        NOW() - ps.last_heartbeat as heartbeat_age
    FROM gps_processing_status ps
    LEFT JOIN current_locks cl ON true  -- Advisory locks nemaju direktnu vezu, ali pokazujemo status
    WHERE ps.status IN ('processing', 'pending')
)
SELECT
    ab.id,
    ab.start_time,
    ab.end_time,
    ab.vehicle_id,
    ab.status,
    ab.progress_percent,
    ab.rows_processed,
    ab.rows_filtered,
    ab.has_lock,
    ab.lock_pid,
    ab.heartbeat_age,
    CASE
        WHEN ab.heartbeat_age > interval '5 minutes' THEN 'STALE'
        WHEN ab.heartbeat_age > interval '2 minutes' THEN 'WARNING'
        ELSE 'OK'
    END as health_status,
    ab.retry_count,
    ab.error_message
FROM active_batches ab
ORDER BY ab.start_time DESC, ab.vehicle_id;

-- migrate:down

DROP VIEW IF EXISTS v_parallel_processing_status;
DROP FUNCTION IF EXISTS get_processing_queue(integer);
DROP FUNCTION IF EXISTS process_vehicles_parallel(timestamptz, timestamptz, integer[], integer);
DROP FUNCTION IF EXISTS find_next_vehicles_to_process(timestamptz, timestamptz, integer);
DROP FUNCTION IF EXISTS unlock_batch(timestamptz, timestamptz, integer);
DROP FUNCTION IF EXISTS try_lock_batch(timestamptz, timestamptz, integer);
