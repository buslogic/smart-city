-- migrate:up
-- ==============================================================================
-- CREATE process_gps_batch_safe wrapper funkcija
-- ==============================================================================
-- Wrapper oko process_gps_batch funkcije koja vraća samo rows_processed i outliers_detected
-- Koristi se u process_vehicles_parallel() funkciji
-- ==============================================================================

-- Drop postojeću funkciju ako postoji (može imati drugačiji return type)
DROP FUNCTION IF EXISTS process_gps_batch_safe(timestamptz, timestamptz, integer) CASCADE;

CREATE OR REPLACE FUNCTION process_gps_batch_safe(
    p_start_time timestamptz,
    p_end_time timestamptz,
    p_vehicle_id integer DEFAULT NULL
) RETURNS TABLE(
    rows_processed bigint,
    outliers_detected bigint
) AS $$
DECLARE
    v_result record;
BEGIN
    -- Pozovi glavni process_gps_batch
    SELECT * INTO v_result
    FROM process_gps_batch(p_start_time, p_end_time, p_vehicle_id);

    -- Vrati samo rows_processed i outliers_detected
    RETURN QUERY
    SELECT
        v_result.rows_processed,
        v_result.outliers_detected;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_gps_batch_safe IS
'Wrapper funkcija oko process_gps_batch koja vraća samo rows_processed i outliers_detected.
Koristi se u process_vehicles_parallel() za paralelno procesiranje vozila.';

-- migrate:down
DROP FUNCTION IF EXISTS process_gps_batch_safe(timestamptz, timestamptz, integer) CASCADE;
