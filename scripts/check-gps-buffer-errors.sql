-- =====================================================
-- GPS BUFFER ERROR ANALYSIS SCRIPT
-- =====================================================

-- 1. PREGLED STATUS DISTRIBUCIJE
-- ------------------------------------
SELECT 
    process_status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM gps_raw_buffer), 2) as percentage,
    MIN(received_at) as oldest_record,
    MAX(received_at) as newest_record,
    TIMESTAMPDIFF(MINUTE, MIN(received_at), NOW()) as oldest_minutes_ago
FROM gps_raw_buffer 
GROUP BY process_status
ORDER BY count DESC;

-- 2. ANALIZA FAILED ZAPISA
-- ------------------------------------
SELECT 
    'Failed Records Analysis' as analysis_type,
    COUNT(*) as total_failed,
    COUNT(DISTINCT vehicle_id) as unique_vehicles,
    MAX(retry_count) as max_retries,
    MIN(received_at) as oldest_failed,
    MAX(received_at) as newest_failed
FROM gps_raw_buffer 
WHERE process_status = 'failed';

-- 3. TOP 10 ERROR MESSAGES
-- ------------------------------------
SELECT 
    error_message,
    COUNT(*) as error_count,
    MIN(received_at) as first_occurrence,
    MAX(received_at) as last_occurrence,
    COUNT(DISTINCT vehicle_id) as affected_vehicles
FROM gps_raw_buffer 
WHERE process_status = 'failed' 
    AND error_message IS NOT NULL
GROUP BY error_message
ORDER BY error_count DESC
LIMIT 10;

-- 4. VOZILA SA NAJVIŠE GREŠAKA
-- ------------------------------------
SELECT 
    v.garage_number,
    grb.vehicle_id,
    COUNT(*) as error_count,
    MAX(grb.retry_count) as max_retries,
    MIN(grb.received_at) as first_error,
    MAX(grb.received_at) as last_error
FROM gps_raw_buffer grb
LEFT JOIN bus_vehicles v ON v.id = grb.vehicle_id
WHERE grb.process_status = 'failed'
GROUP BY grb.vehicle_id, v.garage_number
ORDER BY error_count DESC
LIMIT 20;

-- 5. RETRY COUNT DISTRIBUCIJA
-- ------------------------------------
SELECT 
    retry_count,
    COUNT(*) as record_count,
    COUNT(DISTINCT vehicle_id) as unique_vehicles
FROM gps_raw_buffer 
WHERE process_status IN ('pending', 'failed')
GROUP BY retry_count
ORDER BY retry_count;

-- 6. PROCESSING vs RECEIVING RATE (poslednji sat)
-- ------------------------------------
SELECT 
    'Last Hour Stats' as period,
    COUNT(CASE WHEN received_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as received_last_hour,
    COUNT(CASE WHEN processed_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) AND process_status = 'processed' THEN 1 END) as processed_last_hour,
    COUNT(CASE WHEN received_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) - 
    COUNT(CASE WHEN processed_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) AND process_status = 'processed' THEN 1 END) as backlog_increase
FROM gps_raw_buffer;

-- 7. CHECK FOR STUCK RECORDS (processing > 5 min)
-- ------------------------------------
SELECT 
    COUNT(*) as stuck_in_processing,
    MIN(processed_at) as oldest_processing_started,
    TIMESTAMPDIFF(MINUTE, MIN(processed_at), NOW()) as minutes_stuck
FROM gps_raw_buffer 
WHERE process_status = 'processing'
    AND processed_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE);

-- 8. DUPLICATE CHECK
-- ------------------------------------
SELECT 
    vehicle_id,
    timestamp,
    COUNT(*) as duplicate_count
FROM gps_raw_buffer
WHERE process_status = 'pending'
GROUP BY vehicle_id, timestamp
HAVING COUNT(*) > 1
LIMIT 10;

-- 9. TIME GAP ANALYSIS - koliko kasne podaci
-- ------------------------------------
SELECT 
    CASE 
        WHEN TIMESTAMPDIFF(MINUTE, timestamp, NOW()) < 5 THEN '< 5 min'
        WHEN TIMESTAMPDIFF(MINUTE, timestamp, NOW()) < 30 THEN '5-30 min'
        WHEN TIMESTAMPDIFF(MINUTE, timestamp, NOW()) < 60 THEN '30-60 min'
        WHEN TIMESTAMPDIFF(MINUTE, timestamp, NOW()) < 180 THEN '1-3 hours'
        ELSE '> 3 hours'
    END as delay_category,
    COUNT(*) as record_count
FROM gps_raw_buffer
WHERE process_status = 'pending'
GROUP BY delay_category
ORDER BY 
    CASE delay_category
        WHEN '< 5 min' THEN 1
        WHEN '5-30 min' THEN 2
        WHEN '30-60 min' THEN 3
        WHEN '1-3 hours' THEN 4
        ELSE 5
    END;

-- 10. CHECK INDEXES
-- ------------------------------------
SHOW INDEX FROM gps_raw_buffer;

-- 11. TABLE SIZE INFO
-- ------------------------------------
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
    table_rows as approx_rows,
    ROUND((data_length / table_rows), 2) as avg_row_size_bytes
FROM information_schema.TABLES 
WHERE table_schema = DATABASE() 
    AND table_name = 'gps_raw_buffer';