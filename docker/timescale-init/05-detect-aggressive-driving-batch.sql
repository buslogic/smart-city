-- Funkcija za batch detekciju agresivne vožnje nakon GPS sinhronizacije
CREATE OR REPLACE FUNCTION detect_aggressive_driving_batch(
    p_vehicle_id INTEGER,
    p_garage_no VARCHAR,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
) RETURNS TABLE(
    total_events INTEGER,
    acceleration_events INTEGER,
    braking_events INTEGER,
    moderate_events INTEGER,
    severe_events INTEGER
) AS $$
DECLARE
    v_inserted_count INTEGER := 0;
    v_actual_vehicle_id INTEGER;
BEGIN
    -- Pronađi pravi vehicle_id ako je prosleđen NULL ili dummy vrednost
    IF p_vehicle_id IS NULL OR p_vehicle_id <= 1 THEN
        SELECT DISTINCT vehicle_id INTO v_actual_vehicle_id
        FROM gps_data
        WHERE garage_no = p_garage_no
          AND vehicle_id IS NOT NULL
          AND vehicle_id > 1
        LIMIT 1;
        
        -- Ako ne možemo naći vehicle_id, koristi prosleđeni ili 1
        v_actual_vehicle_id := COALESCE(v_actual_vehicle_id, p_vehicle_id, 1);
    ELSE
        v_actual_vehicle_id := p_vehicle_id;
    END IF;
    -- Analiziraj GPS podatke i detektuj agresivnu vožnju
    WITH speed_analysis AS (
        SELECT 
            time,
            garage_no,
            speed,
            lat,
            lng,
            location,
            LAG(speed) OVER (PARTITION BY garage_no ORDER BY time) as prev_speed,
            LAG(time) OVER (PARTITION BY garage_no ORDER BY time) as prev_time,
            LAG(location) OVER (PARTITION BY garage_no ORDER BY time) as prev_location
        FROM gps_data
        WHERE garage_no = p_garage_no
            AND time BETWEEN p_start_time AND p_end_time
            AND speed IS NOT NULL
            AND speed > 0
        ORDER BY time
    ),
    acceleration_calc AS (
        SELECT 
            time,
            garage_no,
            speed,
            prev_speed,
            lat,
            lng,
            location,
            EXTRACT(EPOCH FROM (time - prev_time)) as time_diff_seconds,
            -- Kalkulacija ubrzanja u m/s²
            -- speed je u km/h, konvertujemo u m/s (km/h * 0.27778 = m/s)
            CASE 
                WHEN prev_speed IS NOT NULL 
                AND EXTRACT(EPOCH FROM (time - prev_time)) BETWEEN 1 AND 10  -- Samo za intervale 1-10 sekundi
                AND ABS(speed - prev_speed) > 0.5  -- Ignorišemo male promene brzine
                THEN ((speed - prev_speed) * 0.27778) / EXTRACT(EPOCH FROM (time - prev_time))
                ELSE NULL
            END as acceleration_ms2
        FROM speed_analysis
        WHERE prev_time IS NOT NULL
    )
    INSERT INTO driving_events (
        time, 
        vehicle_id, 
        garage_no, 
        event_type, 
        severity,
        acceleration_value,
        g_force,
        speed_before, 
        speed_after, 
        duration_ms,
        location,
        lat,
        lng
    )
    SELECT 
        time,
        v_actual_vehicle_id,
        garage_no,
        CASE 
            WHEN acceleration_ms2 > 0 THEN 'acceleration'::event_type
            ELSE 'braking'::event_type
        END as event_type,
        CASE
            WHEN acceleration_ms2 > 0 THEN  -- Ubrzanje
                CASE
                    WHEN acceleration_ms2 < 1.5 THEN 'normal'::severity_level
                    WHEN acceleration_ms2 < 2.5 THEN 'moderate'::severity_level
                    ELSE 'severe'::severity_level
                END
            ELSE  -- Kočenje (negativno ubrzanje)
                CASE
                    WHEN acceleration_ms2 > -2.0 THEN 'normal'::severity_level
                    WHEN acceleration_ms2 > -3.5 THEN 'moderate'::severity_level
                    ELSE 'severe'::severity_level
                END
        END as severity,
        ABS(acceleration_ms2) as acceleration_value,
        ABS(acceleration_ms2) / 9.81 as g_force,
        prev_speed,
        speed,
        (time_diff_seconds * 1000)::INTEGER as duration_ms,
        location,
        lat,
        lng
    FROM acceleration_calc
    WHERE acceleration_ms2 IS NOT NULL
        AND ABS(acceleration_ms2) >= 1.0  -- Samo događaji preko 1.0 m/s²
        AND NOT EXISTS (  -- Proveri da li već postoji događaj za ovo vreme i vozilo
            SELECT 1 FROM driving_events de 
            WHERE de.time = acceleration_calc.time 
            AND de.garage_no = acceleration_calc.garage_no
        );
    
    -- Vrati statistiku
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_events,
        SUM(CASE WHEN event_type = 'acceleration' THEN 1 ELSE 0 END)::INTEGER as acceleration_events,
        SUM(CASE WHEN event_type = 'braking' THEN 1 ELSE 0 END)::INTEGER as braking_events,
        SUM(CASE WHEN severity = 'moderate' THEN 1 ELSE 0 END)::INTEGER as moderate_events,
        SUM(CASE WHEN severity = 'severe' THEN 1 ELSE 0 END)::INTEGER as severe_events
    FROM driving_events
    WHERE garage_no = p_garage_no
        AND time BETWEEN p_start_time AND p_end_time;
        
END;
$$ LANGUAGE plpgsql;

-- Dodaj komentar
COMMENT ON FUNCTION detect_aggressive_driving_batch IS 'Batch funkcija za detekciju agresivne vožnje nakon GPS sinhronizacije';