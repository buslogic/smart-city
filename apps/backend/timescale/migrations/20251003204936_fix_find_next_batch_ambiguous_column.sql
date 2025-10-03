-- migrate:up
-- Fix ambiguous column reference in find_next_batch_to_process function
CREATE OR REPLACE FUNCTION find_next_batch_to_process()
RETURNS TABLE(
    start_time timestamptz,
    end_time timestamptz,
    estimated_rows bigint
) AS $$
BEGIN
    RETURN QUERY
    WITH last_processed AS (
        -- Nađi poslednji uspešno procesiran batch
        SELECT MAX(gps_processing_status.end_time) as last_time
        FROM gps_processing_status
        WHERE gps_processing_status.status = 'completed'
    ),
    next_batch AS (
        SELECT
            COALESCE(
                (SELECT lp.last_time FROM last_processed lp),
                (SELECT MIN(gps_data.time)::date FROM gps_data WHERE gps_data.time >= '2025-09-01')
            ) as batch_start,
            LEAST(
                COALESCE(
                    (SELECT lp.last_time FROM last_processed lp),
                    (SELECT MIN(gps_data.time)::date FROM gps_data WHERE gps_data.time >= '2025-09-01')
                ) + interval '1 hour',
                NOW()
            ) as batch_end
    )
    SELECT
        nb.batch_start as start_time,
        nb.batch_end as end_time,
        (SELECT COUNT(*)
         FROM gps_data g
         WHERE g.time >= nb.batch_start
           AND g.time < nb.batch_end
           AND NOT EXISTS (
               SELECT 1 FROM gps_data_lag_filtered f
               WHERE f.time = g.time
               AND f.vehicle_id = g.vehicle_id
           )) as estimated_rows
    FROM next_batch nb
    WHERE nb.batch_start < NOW() - interval '5 minutes';  -- Ne procesirati najnovije podatke
END;
$$ LANGUAGE plpgsql;

-- migrate:down
-- Restore original function (will be handled by rollback of previous migration)
