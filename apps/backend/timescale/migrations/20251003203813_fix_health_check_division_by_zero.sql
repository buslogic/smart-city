-- migrate:up

-- Fix division by zero in get_health_check function (Processing Rate check)
DROP FUNCTION IF EXISTS get_health_check();

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
        'Processing Lag'::text as check_name,
        CASE
            WHEN (latest_raw - latest_processed) < interval '1 hour' THEN 'OK'
            WHEN (latest_raw - latest_processed) < interval '6 hours' THEN 'WARNING'
            ELSE 'CRITICAL'
        END::text as status,
        ('Lag: ' || (latest_raw - latest_processed)::text)::text as message,
        jsonb_build_object(
            'latest_raw', latest_raw,
            'latest_processed', latest_processed,
            'lag', latest_raw - latest_processed
        ) as details
    FROM lag_check;

    -- Check 2: Failed batches rate
    RETURN QUERY
    WITH batch_health AS (
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE gps_processing_status.status = 'failed') as failed
        FROM gps_processing_status
        WHERE gps_processing_status.processing_started_at > NOW() - interval '24 hours'
    )
    SELECT
        'Failed Batch Rate (24h)'::text as check_name,
        CASE
            WHEN batch_health.total = 0 THEN 'OK'
            WHEN (batch_health.failed::numeric / batch_health.total * 100) < 1 THEN 'OK'
            WHEN (batch_health.failed::numeric / batch_health.total * 100) < 5 THEN 'WARNING'
            ELSE 'CRITICAL'
        END::text as status,
        (batch_health.failed || ' / ' || batch_health.total || ' failed (' || ROUND(batch_health.failed::numeric / NULLIF(batch_health.total, 0) * 100, 2) || '%)')::text as message,
        jsonb_build_object(
            'total_batches', batch_health.total,
            'failed_batches', batch_health.failed,
            'failure_rate', ROUND(batch_health.failed::numeric / NULLIF(batch_health.total, 0) * 100, 2)
        ) as details
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
        'Outlier Rate (24h)'::text as check_name,
        CASE
            WHEN outlier_check.total = 0 THEN 'OK'
            WHEN (outlier_check.outliers::numeric / outlier_check.total * 100) < 5 THEN 'OK'
            WHEN (outlier_check.outliers::numeric / outlier_check.total * 100) < 15 THEN 'WARNING'
            ELSE 'CRITICAL'
        END::text as status,
        (outlier_check.outliers || ' / ' || outlier_check.total || ' outliers (' || ROUND(outlier_check.outliers::numeric / NULLIF(outlier_check.total, 0) * 100, 2) || '%)')::text as message,
        jsonb_build_object(
            'total_points', outlier_check.total,
            'outliers', outlier_check.outliers,
            'outlier_rate', ROUND(outlier_check.outliers::numeric / NULLIF(outlier_check.total, 0) * 100, 2)
        ) as details
    FROM outlier_check;

    -- Check 4: Active batches (stale detection)
    RETURN QUERY
    WITH stale_check AS (
        SELECT
            COUNT(*) as stale_count
        FROM gps_processing_status
        WHERE gps_processing_status.status = 'processing'
          AND gps_processing_status.last_heartbeat < NOW() - interval '30 minutes'
    )
    SELECT
        'Stale Batches'::text as check_name,
        CASE
            WHEN stale_check.stale_count = 0 THEN 'OK'
            WHEN stale_check.stale_count < 3 THEN 'WARNING'
            ELSE 'CRITICAL'
        END::text as status,
        (stale_check.stale_count || ' stale batch(es) detected')::text as message,
        jsonb_build_object('stale_count', stale_check.stale_count) as details
    FROM stale_check;

    -- Check 5: Processing rate (FIXED: use NULLIF with 0, not 1)
    RETURN QUERY
    WITH rate_check AS (
        SELECT
            SUM(rows_processed) as rows_last_hour,
            COUNT(*) as batches_last_hour
        FROM gps_processing_status
        WHERE gps_processing_status.status = 'completed'
          AND processing_completed_at > NOW() - interval '1 hour'
    )
    SELECT
        'Processing Rate (1h)'::text as check_name,
        CASE
            WHEN COALESCE(rate_check.rows_last_hour, 0) > 100000 THEN 'OK'
            WHEN COALESCE(rate_check.rows_last_hour, 0) > 50000 THEN 'WARNING'
            WHEN COALESCE(rate_check.rows_last_hour, 0) > 0 THEN 'LOW'
            ELSE 'CRITICAL'
        END::text as status,
        (COALESCE(rate_check.rows_last_hour, 0) || ' rows in ' || COALESCE(rate_check.batches_last_hour, 0) || ' batches')::text as message,
        jsonb_build_object(
            'rows_processed', COALESCE(rate_check.rows_last_hour, 0),
            'batches_completed', COALESCE(rate_check.batches_last_hour, 0),
            'avg_rows_per_batch', ROUND(COALESCE(rate_check.rows_last_hour, 0)::numeric / NULLIF(rate_check.batches_last_hour, 0), 0)
        ) as details
    FROM rate_check;
END;
$$ LANGUAGE plpgsql;

-- migrate:down

DROP FUNCTION IF EXISTS get_health_check();
