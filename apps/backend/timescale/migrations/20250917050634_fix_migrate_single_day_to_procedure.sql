-- migrate:up
-- Zameni funkciju sa procedurom koja ima OUT parametre
-- Ovo je potrebno jer migration.service.ts poziva CALL migrate_single_day sa 4 parametra

-- Prvo obriši postojeću funkciju
DROP FUNCTION IF EXISTS migrate_single_day(DATE, INTEGER);

-- Kreiraj proceduru sa OUT parametrima koja odgovara pozivu iz servisa
CREATE OR REPLACE PROCEDURE migrate_single_day(
    IN p_date DATE,
    OUT out_records_migrated BIGINT,
    OUT out_duration INTERVAL,
    IN p_batch_size INTEGER DEFAULT 200000
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_chunk_count INTEGER := 0;
    v_daily_processed BIGINT := 0;
    v_offset INTEGER := 0;
    v_chunk_inserted INTEGER;
    v_empty_chunks_in_row INTEGER := 0;
    v_max_empty_chunks INTEGER := 10;
    v_total_records BIGINT;
BEGIN
    v_start_time := clock_timestamp();
    out_records_migrated := 0;

    SELECT COUNT(*) INTO v_total_records
    FROM gps_data
    WHERE time >= p_date::timestamp
      AND time < (p_date + INTERVAL '1 day')::timestamp;

    LOOP
        INSERT INTO gps_data_fixed
        SELECT
            time - INTERVAL '2 hours' as time,
            vehicle_id,
            garage_no,
            lat,
            lng,
            location,
            speed,
            course,
            alt,
            state,
            in_route,
            line_number,
            departure_id,
            people_in,
            people_out,
            data_source
        FROM gps_data
        WHERE time >= p_date::timestamp
          AND time < (p_date + INTERVAL '1 day')::timestamp
        ORDER BY time
        LIMIT p_batch_size
        OFFSET v_offset
        ON CONFLICT (time, vehicle_id) DO NOTHING;

        GET DIAGNOSTICS v_chunk_inserted = ROW_COUNT;

        IF v_chunk_inserted = 0 THEN
            v_empty_chunks_in_row := v_empty_chunks_in_row + 1;
            IF v_empty_chunks_in_row >= v_max_empty_chunks THEN
                EXIT;
            END IF;
        ELSE
            v_empty_chunks_in_row := 0;
        END IF;

        v_daily_processed := v_daily_processed + v_chunk_inserted;
        v_chunk_count := v_chunk_count + 1;
        v_offset := v_offset + p_batch_size;

        IF v_daily_processed >= v_total_records THEN
            EXIT;
        END IF;
    END LOOP;

    out_records_migrated := v_daily_processed;
    out_duration := clock_timestamp() - v_start_time;
END;
$$;

-- migrate:down
DROP PROCEDURE IF EXISTS migrate_single_day(DATE, BIGINT, INTERVAL, INTEGER);
