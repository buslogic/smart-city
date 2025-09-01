-- ======================================
-- BATCH PROCESSING SCRIPT
-- Procesira sve istorijske GPS podatke i detektuje agresivnu vožnju
-- ======================================

-- Prikaz početka procesiranja
\echo 'Starting batch processing of historical GPS data for aggressive driving detection...'
\echo '================================================================'
\timing on

-- Prvo proverimo koliko vozila i GPS podataka imamo
WITH vehicle_summary AS (
    SELECT 
        COUNT(DISTINCT vehicle_id) as total_vehicles,
        COUNT(DISTINCT garage_no) as total_garage_numbers,
        COUNT(*) as total_gps_points,
        MIN(time) as earliest_data,
        MAX(time) as latest_data
    FROM gps_data
    WHERE speed IS NOT NULL
)
SELECT 
    'Vehicles: ' || total_vehicles || 
    ', Garage Numbers: ' || total_garage_numbers ||
    ', GPS Points: ' || total_gps_points ||
    ', Date Range: ' || earliest_data::DATE || ' to ' || latest_data::DATE
    as summary
FROM vehicle_summary;

\echo ''
\echo 'Processing vehicles one by one...'
\echo '--------------------------------'

-- Kreiraj privremenu tabelu za praćenje progresa
DROP TABLE IF EXISTS processing_log;
CREATE TEMP TABLE processing_log (
    vehicle_id INTEGER,
    garage_no VARCHAR(20),
    gps_points INTEGER,
    events_detected INTEGER,
    severe_events INTEGER,
    moderate_events INTEGER,
    processing_time_ms INTEGER,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Procesirati svako vozilo pojedinačno
DO $$
DECLARE
    v_record RECORD;
    v_result RECORD;
    v_counter INTEGER := 0;
    v_total_events INTEGER := 0;
    v_start_time TIMESTAMPTZ;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Loop kroz sva vozila koja imaju GPS podatke
    FOR v_record IN 
        SELECT DISTINCT 
            vehicle_id,
            garage_no,
            COUNT(*) as point_count,
            MIN(time) as min_time,
            MAX(time) as max_time
        FROM gps_data
        WHERE speed IS NOT NULL
            AND vehicle_id IS NOT NULL
        GROUP BY vehicle_id, garage_no
        ORDER BY point_count DESC
    LOOP
        v_counter := v_counter + 1;
        
        -- Pozovi funkciju za detekciju
        SELECT * INTO v_result
        FROM detect_aggressive_driving_batch(
            v_record.vehicle_id,
            v_record.min_time,
            v_record.max_time
        );
        
        -- Logiraj rezultat
        INSERT INTO processing_log (
            vehicle_id, garage_no, gps_points, 
            events_detected, severe_events, moderate_events, 
            processing_time_ms
        ) VALUES (
            v_record.vehicle_id, v_record.garage_no, v_record.point_count,
            v_result.detected_events, v_result.severe_count, v_result.moderate_count,
            v_result.processing_time_ms
        );
        
        v_total_events := v_total_events + v_result.detected_events;
        
        -- Prikaz progresa
        IF v_counter % 10 = 0 THEN
            RAISE NOTICE 'Processed % vehicles, total events: %', v_counter, v_total_events;
        END IF;
        
        -- Detaljni prikaz za vozila sa dosta događaja
        IF v_result.detected_events > 10 THEN
            RAISE NOTICE 'Vehicle % (%) - Points: %, Events: % (Severe: %, Moderate: %), Time: %ms',
                v_record.garage_no, v_record.vehicle_id, v_record.point_count,
                v_result.detected_events, v_result.severe_count, v_result.moderate_count,
                v_result.processing_time_ms;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Processing completed in % seconds', 
        EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))::NUMERIC(10,2);
    RAISE NOTICE 'Total vehicles processed: %', v_counter;
    RAISE NOTICE 'Total events detected: %', v_total_events;
END $$;

\echo ''
\echo 'Processing Summary:'
\echo '==================='

-- Prikaz sumarnih rezultata
SELECT 
    COUNT(*) as vehicles_processed,
    SUM(gps_points) as total_gps_points,
    SUM(events_detected) as total_events,
    SUM(severe_events) as total_severe,
    SUM(moderate_events) as total_moderate,
    ROUND(AVG(events_detected)::NUMERIC, 2) as avg_events_per_vehicle,
    ROUND(AVG(processing_time_ms)::NUMERIC, 2) as avg_processing_time_ms
FROM processing_log;

\echo ''
\echo 'Top 10 vehicles with most aggressive driving events:'
\echo '----------------------------------------------------'

-- Top 10 vozila sa najviše događaja
SELECT 
    garage_no,
    vehicle_id,
    gps_points,
    events_detected,
    severe_events,
    moderate_events,
    ROUND((events_detected::NUMERIC / NULLIF(gps_points, 0) * 100), 2) as event_rate_percent
FROM processing_log
WHERE events_detected > 0
ORDER BY events_detected DESC
LIMIT 10;

\echo ''
\echo 'Event type distribution:'
\echo '------------------------'

-- Distribucija tipova događaja
SELECT 
    event_type,
    severity,
    COUNT(*) as count,
    ROUND(AVG(g_force)::NUMERIC, 3) as avg_g_force,
    ROUND(MAX(g_force)::NUMERIC, 3) as max_g_force,
    ROUND(AVG(ABS(acceleration_value))::NUMERIC, 3) as avg_acceleration_ms2
FROM driving_events
GROUP BY event_type, severity
ORDER BY event_type, severity;

\echo ''
\echo 'Events by hour of day:'
\echo '----------------------'

-- Distribucija događaja po satu u danu
SELECT 
    EXTRACT(HOUR FROM time) as hour,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE severity = 'severe') as severe,
    COUNT(*) FILTER (WHERE severity = 'moderate') as moderate
FROM driving_events
GROUP BY hour
ORDER BY hour;

\echo ''
\echo 'Vehicle Safety Scores:'
\echo '---------------------'

-- Safety score za sva vozila
WITH vehicle_scores AS (
    SELECT 
        vehicle_id,
        garage_no,
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE severity = 'severe') as severe_count,
        COUNT(*) FILTER (WHERE severity = 'moderate') as moderate_count,
        -- Safety Score formula: 100 - (severe * 5 + moderate * 2)
        GREATEST(0, 100 - 
            COUNT(*) FILTER (WHERE severity = 'severe') * 5 - 
            COUNT(*) FILTER (WHERE severity = 'moderate') * 2
        ) as safety_score
    FROM driving_events
    GROUP BY vehicle_id, garage_no
)
SELECT 
    garage_no,
    vehicle_id,
    total_events,
    severe_count,
    moderate_count,
    safety_score,
    CASE 
        WHEN safety_score >= 90 THEN 'EXCELLENT'
        WHEN safety_score >= 75 THEN 'GOOD'
        WHEN safety_score >= 60 THEN 'AVERAGE'
        WHEN safety_score >= 40 THEN 'POOR'
        ELSE 'CRITICAL'
    END as rating
FROM vehicle_scores
ORDER BY safety_score DESC
LIMIT 20;

\echo ''
\echo 'Data Quality Check:'
\echo '-------------------'

-- Provera kvaliteta podataka
SELECT 
    'Total GPS points' as metric,
    COUNT(*) as value
FROM gps_data
UNION ALL
SELECT 
    'GPS points with valid speed',
    COUNT(*)
FROM gps_data
WHERE speed IS NOT NULL AND speed >= 0
UNION ALL
SELECT 
    'Detected driving events',
    COUNT(*)
FROM driving_events
UNION ALL
SELECT 
    'Events with high confidence',
    COUNT(*)
FROM driving_events
WHERE confidence >= 0.9;

\echo ''
\echo '================================================================'
\echo 'Batch processing completed successfully!'
\echo 'You can now query the driving_events table for analysis.'
\echo ''
\echo 'Example queries:'
\echo '  -- Get statistics for specific vehicle:'
\echo '  SELECT * FROM get_vehicle_driving_statistics(<vehicle_id>);'
\echo ''
\echo '  -- Get recent severe events:'
\echo '  SELECT * FROM driving_events'
\echo '  WHERE severity = ''severe'' AND time > NOW() - INTERVAL ''7 days'''
\echo '  ORDER BY time DESC LIMIT 10;'
\echo '================================================================'

-- Cleanup
DROP TABLE IF EXISTS processing_log;