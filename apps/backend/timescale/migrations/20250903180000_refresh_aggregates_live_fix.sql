-- ====================================================================
-- LIVE SERVER FIX: Refresh svih continuous aggregates
-- ====================================================================

-- migrate:up

RAISE NOTICE 'Počinje refresh continuous aggregates za LIVE server...';

-- 1. Refresh vehicle_hourly_stats (PRIORITET!)
RAISE NOTICE 'Refreshujem vehicle_hourly_stats...';
CALL refresh_continuous_aggregate('vehicle_hourly_stats', NULL, NULL);
RAISE NOTICE '✅ vehicle_hourly_stats refreshovan';

-- 2. Refresh daily_vehicle_stats  
RAISE NOTICE 'Refreshujem daily_vehicle_stats...';
CALL refresh_continuous_aggregate('daily_vehicle_stats', NULL, NULL);
RAISE NOTICE '✅ daily_vehicle_stats refreshovan';

-- 3. Dodaj missing driving_events iz postojećih gps_data (ako nije obrađeno)
RAISE NOTICE 'Proveravam da li treba dodati missing driving_events...';

-- Proveri koliko imamo gps_data vs driving_events
DO $$
DECLARE
    gps_count INTEGER;
    events_count INTEGER;
    missing_ratio NUMERIC;
BEGIN
    SELECT COUNT(*) INTO gps_count FROM gps_data WHERE time >= '2024-12-01';
    SELECT COUNT(*) INTO events_count FROM driving_events WHERE time >= '2024-12-01';
    
    IF gps_count = 0 THEN
        RAISE NOTICE 'Nema GPS podataka za obradu';
        RETURN;
    END IF;
    
    missing_ratio := events_count::numeric / gps_count::numeric;
    RAISE NOTICE 'GPS tačaka: %, Driving events: %, Ratio: %', gps_count, events_count, missing_ratio;
    
    -- Ako imamo manje od 1% events u odnosu na GPS tačke, obradi batch
    IF missing_ratio < 0.01 THEN
        RAISE NOTICE 'Pokrećem batch detekciju agresivne vožnje...';
        
        -- Batch detekcija za top 50 vozila (da ne preopteretimo server)
        PERFORM detect_aggressive_driving_batch(
            vehicle_id, 
            garage_no,
            time::date::timestamptz,
            (time::date + interval '1 day')::timestamptz
        )
        FROM (
            SELECT DISTINCT 
                vehicle_id, 
                garage_no,
                time::date as day
            FROM gps_data 
            WHERE time >= CURRENT_DATE - INTERVAL '30 days'
            AND vehicle_id IN (
                -- Top 50 vozila po broju GPS tačaka
                SELECT vehicle_id 
                FROM gps_data 
                WHERE time >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY vehicle_id 
                ORDER BY COUNT(*) DESC 
                LIMIT 50
            )
            GROUP BY vehicle_id, garage_no, time::date
            ORDER BY day DESC
            LIMIT 500  -- Max 500 vehicle-dana da ne blokira server
        ) batch_data;
        
        RAISE NOTICE '✅ Batch detekcija završena za top vozila';
    ELSE
        RAISE NOTICE 'Driving events su OK (ratio: %), preskačem batch detekciju', missing_ratio;
    END IF;
END $$;

-- 4. Final refresh nakon batch detekcije
RAISE NOTICE 'Final refresh continuous aggregates...';
CALL refresh_continuous_aggregate('vehicle_hourly_stats', CURRENT_DATE - INTERVAL '30 days', NULL);
CALL refresh_continuous_aggregate('daily_vehicle_stats', CURRENT_DATE - INTERVAL '30 days', NULL);

-- 5. Update statistike
RAISE NOTICE 'Ažuriram statistike...';
ANALYZE gps_data;
ANALYZE driving_events;
ANALYZE vehicle_hourly_stats;
ANALYZE daily_vehicle_stats;

RAISE NOTICE '🚀 LIVE server fix kompletiran!';

-- migrate:down

RAISE NOTICE 'Rollback: Nema akcija za rollback (refresh se ne može poništiti)';