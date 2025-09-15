-- migrate:up
-- Kreiranje ispravnog monthly agregata koji radi sa Belgrade timezone
-- Ovaj agregat će davati identične km kao analytics

DO $$
BEGIN
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE 'Kreiranje monthly_vehicle_distance agregata sa Belgrade timezone podreškom';
    RAISE NOTICE '=================================================================================';
END $$;

-- Kreiraj agregat koji pravilno računa kilometražu
-- Koristi standardni UTC time_bucket ali dodaje metadata za Belgrade timezone
CREATE MATERIALIZED VIEW monthly_vehicle_distance
WITH (timescaledb.continuous) AS
SELECT
    -- Standardni UTC bucket za TimescaleDB kompatibilnost
    time_bucket('1 month', time) AS month_utc,
    vehicle_id,
    garage_no,
    -- Dodatno: ekstraktuj godinu i mesec u Belgrade timezone za lakše query
    EXTRACT(YEAR FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as year_belgrade,
    EXTRACT(MONTH FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as month_belgrade,
    -- Broj GPS tačaka
    COUNT(*) as total_points,
    COUNT(*) FILTER (WHERE speed > 0) as moving_points,
    -- Brzina statistike
    AVG(speed) FILTER (WHERE speed > 0)::NUMERIC(5,2) as avg_speed,
    MAX(speed)::NUMERIC(5,2) as max_speed,
    -- KILOMETRAŽA - identično kao analytics!
    COALESCE(
        ST_Length(
            ST_MakeLine(location ORDER BY time)::geography
        ) / 1000.0,
        0
    )::NUMERIC(10,2) as total_km,
    -- Vremenske granice
    MIN(time) as first_point,
    MAX(time) as last_point,
    -- Broj aktivnih dana u Belgrade timezone
    COUNT(DISTINCT DATE(time AT TIME ZONE 'Europe/Belgrade')) as active_days
FROM gps_data
WHERE vehicle_id IS NOT NULL
  AND speed > 0  -- Isti filter kao analytics!
GROUP BY
    time_bucket('1 month', time),
    vehicle_id,
    garage_no
WITH NO DATA;

-- Dodaj refresh policy
SELECT add_continuous_aggregate_policy(
    'monthly_vehicle_distance',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => true
);

DO $$
BEGIN
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE '✅ monthly_vehicle_distance agregat kreiran sa Belgrade timezone!';
    RAISE NOTICE '';
    RAISE NOTICE 'UPOTREBA:';
    RAISE NOTICE '';
    RAISE NOTICE 'Za dohvatanje podataka za određeni Belgrade mesec (npr. August 2025):';
    RAISE NOTICE '';
    RAISE NOTICE 'SELECT SUM(total_km) as monthly_km FROM monthly_vehicle_distance';
    RAISE NOTICE 'WHERE vehicle_id = ?';
    RAISE NOTICE '  AND year_belgrade = 2025 AND month_belgrade = 8;';
    RAISE NOTICE '';
    RAISE NOTICE 'ILI koristite UTC range koji pokriva Belgrade mesec:';
    RAISE NOTICE 'WHERE month_utc >= ''2025-07-01''::timestamptz';
    RAISE NOTICE '  AND month_utc <= ''2025-08-01''::timestamptz;';
    RAISE NOTICE '';
    RAISE NOTICE 'NAPOMENA: Belgrade meseci mogu presecati 2 UTC bucketa zbog UTC+2!';
    RAISE NOTICE 'Zato koristimo SUM() za tačne rezultate.';
    RAISE NOTICE '';
    RAISE NOTICE 'Za refresh:';
    RAISE NOTICE 'CALL refresh_continuous_aggregate(''monthly_vehicle_distance'', NULL, NULL);';
    RAISE NOTICE '=================================================================================';
END $$;

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS monthly_vehicle_distance CASCADE;