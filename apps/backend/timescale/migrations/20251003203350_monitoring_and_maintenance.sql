-- migrate:up

-- =====================================================
-- MONITORING VIEWS
-- =====================================================

-- 1. Processing Overview - Generalni pregled procesiranja
CREATE OR REPLACE VIEW v_processing_overview AS
WITH raw_stats AS (
    SELECT
        COUNT(*) as total_raw_points,
        COUNT(DISTINCT vehicle_id) as total_vehicles,
        MIN(time) as earliest_data,
        MAX(time) as latest_data
    FROM gps_data
),
processed_stats AS (
    SELECT
        COUNT(*) as total_processed_points,
        COUNT(DISTINCT vehicle_id) as processed_vehicles,
        COUNT(*) FILTER (WHERE is_outlier = true) as total_outliers,
        MIN(time) as earliest_processed,
        MAX(time) as latest_processed,
        MAX(processed_at) as last_processing_time
    FROM gps_data_lag_filtered
),
batch_stats AS (
    SELECT
        COUNT(*) as total_batches,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_batches,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_batches,
        COUNT(*) FILTER (WHERE status = 'processing') as active_batches,
        SUM(rows_processed) as total_rows_processed,
        SUM(rows_filtered) as total_outliers_filtered,
        AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))) as avg_processing_time
    FROM gps_processing_status
)
SELECT
    -- Raw data statistika
    r.total_raw_points,
    r.total_vehicles,
    r.earliest_data,
    r.latest_data,

    -- Processed data statistika
    p.total_processed_points,
    p.processed_vehicles,
    p.total_outliers,
    p.earliest_processed,
    p.latest_processed,
    p.last_processing_time,

    -- Napredak procesiranja
    CASE
        WHEN r.total_raw_points > 0
        THEN ROUND((p.total_processed_points::numeric / r.total_raw_points * 100), 2)
        ELSE 0
    END as processing_percentage,

    -- Outlier rate
    CASE
        WHEN p.total_processed_points > 0
        THEN ROUND((p.total_outliers::numeric / p.total_processed_points * 100), 2)
        ELSE 0
    END as outlier_percentage,

    -- Batch statistika
    b.total_batches,
    b.completed_batches,
    b.failed_batches,
    b.active_batches,
    ROUND(b.avg_processing_time::numeric, 2) as avg_processing_seconds,

    -- Processing lag
    r.latest_data - p.latest_processed as processing_lag,

    -- Estimated completion time (based on current rate)
    CASE
        WHEN b.avg_processing_time > 0 AND r.total_raw_points > p.total_processed_points
        THEN ROUND(
            ((r.total_raw_points - p.total_processed_points) /
             NULLIF(b.total_rows_processed, 0)) * b.avg_processing_time / 3600, 2
        )
        ELSE 0
    END as estimated_hours_to_completion
FROM raw_stats r, processed_stats p, batch_stats b;

-- 2. Daily Processing Stats - Statistika po danima
CREATE OR REPLACE VIEW v_daily_processing_stats AS
SELECT
    DATE(time AT TIME ZONE 'Europe/Belgrade') as processing_date,
    vehicle_id,
    COUNT(*) as total_points,
    COUNT(*) FILTER (WHERE is_outlier = false) as valid_points,
    COUNT(*) FILTER (WHERE is_outlier = true) as outliers,
    ROUND((COUNT(*) FILTER (WHERE is_outlier = true)::numeric / COUNT(*) * 100), 2) as outlier_percentage,
    COUNT(DISTINCT outlier_type) FILTER (WHERE is_outlier = true) as outlier_types_count,
    MIN(time) as first_point_time,
    MAX(time) as last_point_time,
    MAX(time) - MIN(time) as time_span,
    MAX(processed_at) as last_processed_at
FROM gps_data_lag_filtered
GROUP BY DATE(time AT TIME ZONE 'Europe/Belgrade'), vehicle_id
ORDER BY processing_date DESC, vehicle_id;

-- 3. Vehicle Processing Progress - Napredak po vozilima
CREATE OR REPLACE VIEW v_vehicle_processing_progress AS
WITH raw_counts AS (
    SELECT
        vehicle_id,
        garage_no,
        COUNT(*) as raw_points,
        MIN(time) as earliest_raw,
        MAX(time) as latest_raw
    FROM gps_data
    GROUP BY vehicle_id, garage_no
),
processed_counts AS (
    SELECT
        vehicle_id,
        COUNT(*) as processed_points,
        COUNT(*) FILTER (WHERE is_outlier = false) as valid_points,
        COUNT(*) FILTER (WHERE is_outlier = true) as outliers,
        MIN(time) as earliest_processed,
        MAX(time) as latest_processed,
        MAX(processed_at) as last_processed_at
    FROM gps_data_lag_filtered
    GROUP BY vehicle_id
)
SELECT
    r.vehicle_id,
    r.garage_no,
    r.raw_points,
    COALESCE(p.processed_points, 0) as processed_points,
    r.raw_points - COALESCE(p.processed_points, 0) as remaining_points,
    CASE
        WHEN r.raw_points > 0
        THEN ROUND((COALESCE(p.processed_points, 0)::numeric / r.raw_points * 100), 2)
        ELSE 0
    END as progress_percentage,
    COALESCE(p.valid_points, 0) as valid_points,
    COALESCE(p.outliers, 0) as outliers,
    CASE
        WHEN p.processed_points > 0
        THEN ROUND((p.outliers::numeric / p.processed_points * 100), 2)
        ELSE 0
    END as outlier_percentage,
    r.earliest_raw,
    r.latest_raw,
    p.earliest_processed,
    p.latest_processed,
    r.latest_raw - COALESCE(p.latest_processed, r.earliest_raw) as processing_lag,
    p.last_processed_at
FROM raw_counts r
LEFT JOIN processed_counts p ON r.vehicle_id = p.vehicle_id
ORDER BY progress_percentage ASC, r.vehicle_id;

-- 4. Outlier Analysis - Analiza outlier-a
CREATE OR REPLACE VIEW v_outlier_analysis AS
SELECT
    outlier_type,
    outlier_severity,
    COUNT(*) as total_count,
    COUNT(DISTINCT vehicle_id) as affected_vehicles,
    COUNT(DISTINCT DATE(time)) as affected_days,
    MIN(distance_from_prev) as min_distance,
    MAX(distance_from_prev) as max_distance,
    AVG(distance_from_prev) as avg_distance,
    MIN(calculated_speed_kmh) as min_speed,
    MAX(calculated_speed_kmh) as max_speed,
    AVG(calculated_speed_kmh) as avg_speed,
    array_agg(DISTINCT vehicle_id ORDER BY vehicle_id) FILTER (WHERE vehicle_id IS NOT NULL) as vehicle_ids
FROM gps_data_lag_filtered
WHERE is_outlier = true
GROUP BY outlier_type, outlier_severity
ORDER BY total_count DESC;

-- 5. Hourly Processing Rate - Brzina procesiranja po satima
CREATE OR REPLACE VIEW v_hourly_processing_rate AS
SELECT
    DATE_TRUNC('hour', processing_completed_at) as processing_hour,
    COUNT(*) as batches_completed,
    SUM(rows_processed) as total_rows_processed,
    SUM(rows_filtered) as total_outliers,
    ROUND(AVG(rows_processed)::numeric, 0) as avg_rows_per_batch,
    ROUND(AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)))::numeric, 2) as avg_seconds_per_batch,
    ROUND((SUM(rows_processed) / NULLIF(SUM(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))), 0))::numeric, 0) as rows_per_second
FROM gps_processing_status
WHERE status = 'completed'
  AND processing_completed_at IS NOT NULL
GROUP BY DATE_TRUNC('hour', processing_completed_at)
ORDER BY processing_hour DESC;

-- =====================================================
-- MAINTENANCE FUNCTIONS
-- =====================================================

-- 1. Cleanup Stale Batches - Očisti zaglavljene batch-eve
CREATE OR REPLACE FUNCTION cleanup_stale_batches(
    p_stale_threshold_minutes integer DEFAULT 30
) RETURNS TABLE(
    cleaned_batches integer,
    unlocked_batches integer,
    details jsonb
) AS $$
DECLARE
    v_cleaned integer := 0;
    v_unlocked integer := 0;
    v_batch record;
BEGIN
    -- Pronađi zaglavljene batch-eve
    FOR v_batch IN
        SELECT *
        FROM gps_processing_status
        WHERE status = 'processing'
          AND last_heartbeat < NOW() - (p_stale_threshold_minutes || ' minutes')::interval
    LOOP
        -- Označi kao failed
        UPDATE gps_processing_status
        SET
            status = 'failed',
            error_message = 'Cleaned up - stale batch (no heartbeat for ' || p_stale_threshold_minutes || ' minutes)',
            processing_completed_at = NOW()
        WHERE id = v_batch.id;

        -- Unlock batch
        PERFORM unlock_batch(
            v_batch.start_time,
            v_batch.end_time,
            v_batch.vehicle_id
        );

        v_cleaned := v_cleaned + 1;
        v_unlocked := v_unlocked + 1;
    END LOOP;

    RETURN QUERY
    SELECT
        v_cleaned,
        v_unlocked,
        jsonb_build_object(
            'cleaned_count', v_cleaned,
            'unlocked_count', v_unlocked,
            'threshold_minutes', p_stale_threshold_minutes,
            'cleaned_at', NOW()
        );
END;
$$ LANGUAGE plpgsql;

-- 2. Cleanup Old Processing Logs - Očisti stare logove
CREATE OR REPLACE FUNCTION cleanup_old_logs(
    p_keep_days integer DEFAULT 7
) RETURNS TABLE(
    deleted_count bigint,
    oldest_kept_log timestamptz
) AS $$
DECLARE
    v_deleted bigint;
    v_cutoff_date timestamptz;
BEGIN
    v_cutoff_date := NOW() - (p_keep_days || ' days')::interval;

    DELETE FROM gps_processing_status
    WHERE processing_completed_at < v_cutoff_date
      AND status IN ('completed', 'failed');

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN QUERY
    SELECT
        v_deleted,
        (SELECT MIN(processing_started_at) FROM gps_processing_status);
END;
$$ LANGUAGE plpgsql;

-- 3. Health Check - Kompletan health check sistema
CREATE OR REPLACE FUNCTION get_health_check()
RETURNS TABLE(
    check_name text,
    status text,
    message text,
    details jsonb
) AS $$
BEGIN
    -- Check 1: Processing lag
    RETURN QUERY
    WITH lag_check AS (
        SELECT
            (SELECT MAX(time) FROM gps_data) as latest_raw,
            (SELECT MAX(time) FROM gps_data_lag_filtered) as latest_processed
    )
    SELECT
        'Processing Lag'::text,
        CASE
            WHEN (latest_raw - latest_processed) < interval '1 hour' THEN 'OK'
            WHEN (latest_raw - latest_processed) < interval '6 hours' THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        'Lag: ' || (latest_raw - latest_processed)::text,
        jsonb_build_object(
            'latest_raw', latest_raw,
            'latest_processed', latest_processed,
            'lag', latest_raw - latest_processed
        )
    FROM lag_check;

    -- Check 2: Failed batches rate
    RETURN QUERY
    WITH batch_health AS (
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM gps_processing_status
        WHERE processing_started_at > NOW() - interval '24 hours'
    )
    SELECT
        'Failed Batch Rate (24h)'::text,
        CASE
            WHEN total = 0 THEN 'OK'
            WHEN (failed::numeric / total * 100) < 1 THEN 'OK'
            WHEN (failed::numeric / total * 100) < 5 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        failed || ' / ' || total || ' failed (' || ROUND(failed::numeric / NULLIF(total, 0) * 100, 2) || '%)',
        jsonb_build_object(
            'total_batches', total,
            'failed_batches', failed,
            'failure_rate', ROUND(failed::numeric / NULLIF(total, 0) * 100, 2)
        )
    FROM batch_health;

    -- Check 3: Outlier rate
    RETURN QUERY
    WITH outlier_check AS (
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_outlier = true) as outliers
        FROM gps_data_lag_filtered
        WHERE processed_at > NOW() - interval '24 hours'
    )
    SELECT
        'Outlier Rate (24h)'::text,
        CASE
            WHEN total = 0 THEN 'OK'
            WHEN (outliers::numeric / total * 100) < 5 THEN 'OK'
            WHEN (outliers::numeric / total * 100) < 15 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        outliers || ' / ' || total || ' outliers (' || ROUND(outliers::numeric / NULLIF(total, 0) * 100, 2) || '%)',
        jsonb_build_object(
            'total_points', total,
            'outliers', outliers,
            'outlier_rate', ROUND(outliers::numeric / NULLIF(total, 0) * 100, 2)
        )
    FROM outlier_check;

    -- Check 4: Active batches (stale detection)
    RETURN QUERY
    WITH stale_check AS (
        SELECT
            COUNT(*) as stale_count
        FROM gps_processing_status
        WHERE status = 'processing'
          AND last_heartbeat < NOW() - interval '30 minutes'
    )
    SELECT
        'Stale Batches'::text,
        CASE
            WHEN stale_count = 0 THEN 'OK'
            WHEN stale_count < 3 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        stale_count || ' stale batch(es) detected',
        jsonb_build_object('stale_count', stale_count)
    FROM stale_check;

    -- Check 5: Processing rate
    RETURN QUERY
    WITH rate_check AS (
        SELECT
            SUM(rows_processed) as rows_last_hour,
            COUNT(*) as batches_last_hour
        FROM gps_processing_status
        WHERE status = 'completed'
          AND processing_completed_at > NOW() - interval '1 hour'
    )
    SELECT
        'Processing Rate (1h)'::text,
        CASE
            WHEN rows_last_hour > 100000 THEN 'OK'
            WHEN rows_last_hour > 50000 THEN 'WARNING'
            WHEN rows_last_hour > 0 THEN 'LOW'
            ELSE 'CRITICAL'
        END,
        COALESCE(rows_last_hour, 0) || ' rows in ' || COALESCE(batches_last_hour, 0) || ' batches',
        jsonb_build_object(
            'rows_processed', COALESCE(rows_last_hour, 0),
            'batches_completed', COALESCE(batches_last_hour, 0),
            'avg_rows_per_batch', ROUND(COALESCE(rows_last_hour, 0)::numeric / NULLIF(batches_last_hour, 1), 0)
        )
    FROM rate_check;
END;
$$ LANGUAGE plpgsql;

-- 4. Get Processing Recommendations - Preporuke za optimizaciju
CREATE OR REPLACE FUNCTION get_processing_recommendations()
RETURNS TABLE(
    recommendation_type text,
    priority text,
    message text,
    action text
) AS $$
BEGIN
    -- Recommendation 1: Slow processing rate
    RETURN QUERY
    WITH rate_check AS (
        SELECT
            AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))) as avg_time,
            AVG(rows_processed) as avg_rows
        FROM gps_processing_status
        WHERE status = 'completed'
          AND processing_completed_at > NOW() - interval '24 hours'
    )
    SELECT
        'Performance'::text,
        CASE
            WHEN avg_time > 60 THEN 'HIGH'
            WHEN avg_time > 30 THEN 'MEDIUM'
            ELSE 'LOW'
        END,
        'Average batch processing time is ' || ROUND(avg_time::numeric, 2) || ' seconds',
        CASE
            WHEN avg_time > 60 THEN 'Consider using parallel processing or increasing batch size'
            WHEN avg_time > 30 THEN 'Monitor performance, consider optimization'
            ELSE 'Performance is acceptable'
        END
    FROM rate_check
    WHERE avg_time > 20;

    -- Recommendation 2: High outlier rate
    RETURN QUERY
    WITH outlier_rate AS (
        SELECT
            COUNT(*) FILTER (WHERE is_outlier = true)::numeric / NULLIF(COUNT(*), 0) * 100 as rate
        FROM gps_data_lag_filtered
        WHERE processed_at > NOW() - interval '24 hours'
    )
    SELECT
        'Data Quality'::text,
        CASE
            WHEN rate > 20 THEN 'HIGH'
            WHEN rate > 10 THEN 'MEDIUM'
            ELSE 'LOW'
        END,
        'Outlier rate is ' || ROUND(rate, 2) || '%',
        CASE
            WHEN rate > 20 THEN 'Review outlier detection thresholds - rate seems too high'
            WHEN rate > 10 THEN 'Monitor outlier patterns'
            ELSE 'Outlier rate is normal'
        END
    FROM outlier_rate
    WHERE rate > 5;

    -- Recommendation 3: Failed batches
    RETURN QUERY
    WITH failed_check AS (
        SELECT
            COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
            COUNT(*) as total_count
        FROM gps_processing_status
        WHERE processing_started_at > NOW() - interval '24 hours'
    )
    SELECT
        'Reliability'::text,
        CASE
            WHEN failed_count > 10 THEN 'HIGH'
            WHEN failed_count > 5 THEN 'MEDIUM'
            ELSE 'LOW'
        END,
        failed_count || ' batches failed in last 24h',
        'Review error logs and retry failed batches'
    FROM failed_check
    WHERE failed_count > 0;
END;
$$ LANGUAGE plpgsql;

-- migrate:down

DROP FUNCTION IF EXISTS get_processing_recommendations();
DROP FUNCTION IF EXISTS get_health_check();
DROP FUNCTION IF EXISTS cleanup_old_logs(integer);
DROP FUNCTION IF EXISTS cleanup_stale_batches(integer);
DROP VIEW IF EXISTS v_hourly_processing_rate;
DROP VIEW IF EXISTS v_outlier_analysis;
DROP VIEW IF EXISTS v_vehicle_processing_progress;
DROP VIEW IF EXISTS v_daily_processing_stats;
DROP VIEW IF EXISTS v_processing_overview;
