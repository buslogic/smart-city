-- migrate:up

-- Fix process_vehicles_parallel to properly handle return values from process_gps_batch_safe
DROP FUNCTION IF EXISTS process_vehicles_parallel(timestamptz, timestamptz, integer[], integer);

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

                -- Procesuj vozilo - process_gps_batch_safe vraća rows_processed i outliers_detected
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

                -- Return rezultat
                RETURN QUERY
                SELECT
                    v_vehicle_id,
                    extract(epoch from p_start_time)::bigint as batch_id,  -- Generiši batch_id od vremena
                    v_rows_processed,
                    v_outliers_detected,
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

-- migrate:down

DROP FUNCTION IF EXISTS process_vehicles_parallel(timestamptz, timestamptz, integer[], integer);

-- Restore old version (without the fix)
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
                SELECT * INTO v_batch_result
                FROM process_gps_batch_safe(
                    p_start_time,
                    p_end_time,
                    v_vehicle_id
                );

                PERFORM unlock_batch(p_start_time, p_end_time, v_vehicle_id);

                RETURN QUERY
                SELECT
                    v_vehicle_id,
                    v_batch_result.batch_id,
                    v_batch_result.rows_processed,
                    v_batch_result.outliers_detected,
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
