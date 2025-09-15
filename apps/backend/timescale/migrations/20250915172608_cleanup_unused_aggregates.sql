-- migrate:up
-- Čišćenje nekorišćenih agregata
-- monthly_vehicle_raw_stats se ne koristi nigde i nije potreban

DO $$
BEGIN
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE 'Brisanje nekorišćenog monthly_vehicle_raw_stats agregata';
    RAISE NOTICE '=================================================================================';
END $$;

-- Briši nekorišćeni agregat
DROP MATERIALIZED VIEW IF EXISTS monthly_vehicle_raw_stats CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ monthly_vehicle_raw_stats obrisan';
    RAISE NOTICE '';
    RAISE NOTICE 'Preostali agregati:';
    RAISE NOTICE '- monthly_vehicle_distance (za mesečne km identične sa analytics)';
    RAISE NOTICE '';
    RAISE NOTICE 'Za korišćenje monthly_vehicle_distance:';
    RAISE NOTICE 'SELECT SUM(total_km) FROM monthly_vehicle_distance';
    RAISE NOTICE 'WHERE vehicle_id = ? AND month_utc >= ''2025-08-01''::timestamptz - INTERVAL ''2 hours''';
    RAISE NOTICE '  AND month_utc < ''2025-09-01''::timestamptz';
END $$;

-- migrate:down
-- Ne vraćamo agregat koji se ne koristi
DO $$
BEGIN
    RAISE NOTICE 'Rollback ne vraća monthly_vehicle_raw_stats jer se ne koristi';
END $$;