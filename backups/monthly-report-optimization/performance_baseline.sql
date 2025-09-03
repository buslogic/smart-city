-- Performance Baseline Testing Script
-- Date: 03.09.2025

-- Test 1: Merenje vremena za 1 vozilo
\timing on

-- Vozilo 460 (P93597) za avgust 2025
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM get_vehicle_driving_statistics(460, '2025-08-01'::date, '2025-08-31'::date);

-- Test 2: Top 10 najaktivnijih vozila
WITH active_vehicles AS (
    SELECT vehicle_id, COUNT(*) as points
    FROM gps_data
    WHERE time >= '2025-08-01' AND time < '2025-09-01'
    GROUP BY vehicle_id
    ORDER BY points DESC
    LIMIT 10
)
SELECT vehicle_id, points FROM active_vehicles;

-- Test 3: Merenje vremena za 10 vozila sekvencijalno
DO $$
DECLARE
    v_id INTEGER;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    total_time INTERVAL;
BEGIN
    start_time := clock_timestamp();
    
    FOR v_id IN (SELECT vehicle_id FROM gps_data WHERE time >= '2025-08-01' LIMIT 10)
    LOOP
        PERFORM * FROM get_vehicle_driving_statistics(v_id, '2025-08-01'::date, '2025-08-31'::date);
    END LOOP;
    
    end_time := clock_timestamp();
    total_time := end_time - start_time;
    RAISE NOTICE 'Vreme za 10 vozila: %', total_time;
END $$;

-- Test 4: Analiza najsporijeg dela - distance kalkulacija
EXPLAIN (ANALYZE, BUFFERS)
WITH ordered_points AS (
    SELECT 
        location,
        LAG(location) OVER (ORDER BY time) as prev_location
    FROM gps_data
    WHERE vehicle_id = 460
        AND time::DATE BETWEEN '2025-08-01' AND '2025-08-31'
        AND location IS NOT NULL
    ORDER BY time
)
SELECT 
    COUNT(*) as point_pairs,
    SUM(ST_Distance(prev_location::geography, location::geography)) / 1000.0 as total_km
FROM ordered_points
WHERE prev_location IS NOT NULL;

-- Test 5: Proveri broj GPS tačaka po vozilu za mesec
SELECT 
    vehicle_id,
    COUNT(*) as gps_points,
    COUNT(DISTINCT DATE(time)) as active_days,
    MIN(time) as first_point,
    MAX(time) as last_point
FROM gps_data
WHERE time >= '2025-08-01' AND time < '2025-09-01'
GROUP BY vehicle_id
ORDER BY gps_points DESC
LIMIT 20;