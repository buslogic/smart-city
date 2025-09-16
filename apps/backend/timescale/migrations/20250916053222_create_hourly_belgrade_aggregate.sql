-- migrate:up
-- Kreiranje hourly agregata sa istom logikom kao monthly
-- Za precizno računanje km na granicama meseca zbog UTC+2

DO $$
BEGIN
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE 'Kreiranje hourly_vehicle_distance agregata sa Belgrade timezone podrškom';
    RAISE NOTICE '=================================================================================';
END $$;

-- Kreiraj hourly agregat koji pravilno računa kilometražu
-- Identična logika kao monthly ali sa 1 hour bucket
CREATE MATERIALIZED VIEW hourly_vehicle_distance
WITH (timescaledb.continuous) AS
SELECT
    -- Standardni UTC bucket za TimescaleDB kompatibilnost (1 sat)
    time_bucket('1 hour', time) AS hour_utc,
    vehicle_id,
    garage_no,
    -- Belgrade timezone metadata
    (MIN(time AT TIME ZONE 'Europe/Belgrade'))::DATE as date_belgrade,
    EXTRACT(YEAR FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as year_belgrade,
    EXTRACT(MONTH FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as month_belgrade,
    EXTRACT(DAY FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as day_belgrade,
    EXTRACT(HOUR FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as hour_belgrade,
    -- Broj GPS tačaka
    COUNT(*) as total_points,
    COUNT(*) FILTER (WHERE speed > 0) as moving_points,
    -- Brzina statistike
    AVG(speed) FILTER (WHERE speed > 0)::NUMERIC(5,2) as avg_speed,
    MAX(speed)::NUMERIC(5,2) as max_speed,
    -- KILOMETRAŽA - identično kao analytics i monthly!
    COALESCE(
        ST_Length(
            ST_MakeLine(location ORDER BY time)::geography
        ) / 1000.0,
        0
    )::NUMERIC(10,2) as total_km,
    -- Vremenske granice
    MIN(time) as first_point,
    MAX(time) as last_point
FROM gps_data
WHERE vehicle_id IS NOT NULL
  AND speed > 0  -- Isti filter kao monthly i analytics!
GROUP BY
    time_bucket('1 hour', time),
    vehicle_id,
    garage_no
WITH NO DATA;

-- Dodaj refresh policy koja se izvršava svakih 15 minuta
SELECT add_continuous_aggregate_policy(
    'hourly_vehicle_distance',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists => true
);

-- Kreiraj indekse za brže query
CREATE INDEX IF NOT EXISTS idx_hourly_vehicle_distance_vehicle
ON hourly_vehicle_distance(vehicle_id, hour_utc DESC);

CREATE INDEX IF NOT EXISTS idx_hourly_vehicle_distance_belgrade
ON hourly_vehicle_distance(vehicle_id, year_belgrade, month_belgrade, day_belgrade);

DO $$
BEGIN
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE '✅ hourly_vehicle_distance agregat kreiran sa Belgrade timezone!';
    RAISE NOTICE '';
    RAISE NOTICE 'UPOTREBA ZA TAČNE BELGRADE MESEČNE KM:';
    RAISE NOTICE '';
    RAISE NOTICE '-- Za avgust 2025, kombinuj hourly i monthly agregate:';
    RAISE NOTICE '';
    RAISE NOTICE '-- 1. Dohvati hourly km za prve sate avgusta (od 31.07 22:00 UTC do 01.08 00:00 UTC)';
    RAISE NOTICE 'SELECT SUM(total_km) FROM hourly_vehicle_distance';
    RAISE NOTICE 'WHERE vehicle_id = ? ';
    RAISE NOTICE '  AND hour_utc >= ''2025-07-31 22:00:00+00''::timestamptz';
    RAISE NOTICE '  AND hour_utc < ''2025-08-01 00:00:00+00''::timestamptz;';
    RAISE NOTICE '';
    RAISE NOTICE '-- 2. Dohvati monthly km za avgust UTC bucket';
    RAISE NOTICE 'SELECT total_km FROM monthly_vehicle_distance';
    RAISE NOTICE 'WHERE vehicle_id = ?';
    RAISE NOTICE '  AND month_utc = ''2025-08-01''::timestamptz;';
    RAISE NOTICE '';
    RAISE NOTICE '-- 3. Dohvati hourly km za poslednje sate avgusta (od 31.08 22:00 UTC do 01.09 00:00 UTC)';
    RAISE NOTICE 'SELECT SUM(total_km) FROM hourly_vehicle_distance';
    RAISE NOTICE 'WHERE vehicle_id = ?';
    RAISE NOTICE '  AND hour_utc >= ''2025-08-31 22:00:00+00''::timestamptz';
    RAISE NOTICE '  AND hour_utc < ''2025-09-01 00:00:00+00''::timestamptz;';
    RAISE NOTICE '';
    RAISE NOTICE '-- Total = hourly_start + monthly_august + hourly_end';
    RAISE NOTICE '';
    RAISE NOTICE 'ALTERNATIVA - direktan query preko Belgrade metadata:';
    RAISE NOTICE 'SELECT SUM(total_km) FROM hourly_vehicle_distance';
    RAISE NOTICE 'WHERE vehicle_id = ?';
    RAISE NOTICE '  AND year_belgrade = 2025 AND month_belgrade = 8;';
    RAISE NOTICE '';
    RAISE NOTICE 'Za refresh:';
    RAISE NOTICE 'CALL refresh_continuous_aggregate(''hourly_vehicle_distance'', NULL, NULL);';
    RAISE NOTICE '=================================================================================';
END $$;

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS hourly_vehicle_distance CASCADE;
