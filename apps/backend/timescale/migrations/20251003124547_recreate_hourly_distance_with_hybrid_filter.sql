-- migrate:up
-- Rekreira hourly_vehicle_distance SA HIBRIDNIM outlier filterom
-- Distance (300m) + Speed (120 km/h) - industry standard

DO $$
BEGIN
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE 'Kreiranje hourly_vehicle_distance SA HIBRIDNIM outlier filterom';
    RAISE NOTICE '  - Distance threshold: 300m';
    RAISE NOTICE '  - Speed threshold: 120 km/h';
    RAISE NOTICE '=================================================================================';
END $$;

-- 1. Drop postojeći aggregate CASCADE (uklanja i policies)
DROP MATERIALIZED VIEW IF EXISTS hourly_vehicle_distance CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Stari hourly_vehicle_distance obrisan';
END $$;

-- 2. Kreiraj NOVI hourly aggregate SA HIBRIDNIM filterom
CREATE MATERIALIZED VIEW hourly_vehicle_distance
WITH (timescaledb.continuous) AS
SELECT
    -- UTC bucket (za TimescaleDB kompatibilnost)
    time_bucket('1 hour', time) AS hour_utc,
    vehicle_id,
    garage_no,
    -- Belgrade timezone metadata (za tačne izveštaje)
    (MIN(time AT TIME ZONE 'Europe/Belgrade'))::DATE as date_belgrade,
    EXTRACT(YEAR FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as year_belgrade,
    EXTRACT(MONTH FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as month_belgrade,
    EXTRACT(DAY FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as day_belgrade,
    EXTRACT(HOUR FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as hour_belgrade,
    -- GPS tačke
    COUNT(*) as total_points,
    COUNT(*) FILTER (WHERE speed > 0) as moving_points,
    -- Brzina statistike
    AVG(speed) FILTER (WHERE speed > 0)::NUMERIC(5,2) as avg_speed,
    MAX(speed)::NUMERIC(5,2) as max_speed,
    -- HIBRIDNI filter: Distance (300m) + Speed (120 km/h)
    calculate_distance_hybrid_filter(
        array_agg(location ORDER BY time),
        array_agg(time ORDER BY time),
        300,  -- max distance 300m
        120   -- max speed 120 km/h
    )::NUMERIC(10,2) as total_km,
    -- Vremenske granice
    MIN(time) as first_point,
    MAX(time) as last_point
FROM gps_data
WHERE vehicle_id IS NOT NULL
  AND speed > 0  -- Samo tačke u kretanju
  AND location IS NOT NULL
GROUP BY
    time_bucket('1 hour', time),
    vehicle_id,
    garage_no
WITH NO DATA;

DO $$
BEGIN
    RAISE NOTICE '✅ Novi hourly_vehicle_distance kreiran SA HIBRIDNIM filterom';
END $$;

-- 3. Dodaj refresh policy (svakih 15 minuta)
SELECT add_continuous_aggregate_policy(
    'hourly_vehicle_distance',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists => true
);

-- 4. Kreiraj indekse za brže query
CREATE INDEX IF NOT EXISTS idx_hourly_vehicle_distance_vehicle
ON hourly_vehicle_distance(vehicle_id, hour_utc DESC);

CREATE INDEX IF NOT EXISTS idx_hourly_vehicle_distance_belgrade
ON hourly_vehicle_distance(vehicle_id, year_belgrade, month_belgrade, day_belgrade);

DO $$
BEGIN
    RAISE NOTICE '✅ Indeksi kreirani';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE 'NAPOMENA: Aggregate JE PRAZAN (WITH NO DATA)';
    RAISE NOTICE '';
    RAISE NOTICE 'HIBRIDNI OUTLIER FILTER AKTIVAN:';
    RAISE NOTICE '  ✓ Distance threshold: 300m između tačaka';
    RAISE NOTICE '  ✓ Speed threshold: 120 km/h calculated speed';
    RAISE NOTICE '';
    RAISE NOTICE 'Za inicijalni refresh, pokreni:';
    RAISE NOTICE 'CALL refresh_continuous_aggregate(''hourly_vehicle_distance'', NULL, NULL);';
    RAISE NOTICE '';
    RAISE NOTICE 'Za TAČNE Belgrade mesečne statistike, koristi:';
    RAISE NOTICE 'SELECT SUM(total_km) FROM hourly_vehicle_distance';
    RAISE NOTICE 'WHERE vehicle_id = ?';
    RAISE NOTICE '  AND year_belgrade = 2025 AND month_belgrade = 9;';
    RAISE NOTICE '';
    RAISE NOTICE 'Očekivano vreme: ~5-10 minuta za par meseci podataka.';
    RAISE NOTICE '=================================================================================';
END $$;

-- migrate:down
-- Vrati na staru verziju BEZ outlier filtera

DROP MATERIALIZED VIEW IF EXISTS hourly_vehicle_distance CASCADE;

-- Re-kreiraj staru verziju (bez outlier filtera)
CREATE MATERIALIZED VIEW hourly_vehicle_distance
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour_utc,
    vehicle_id,
    garage_no,
    (MIN(time AT TIME ZONE 'Europe/Belgrade'))::DATE as date_belgrade,
    EXTRACT(YEAR FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as year_belgrade,
    EXTRACT(MONTH FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as month_belgrade,
    EXTRACT(DAY FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as day_belgrade,
    EXTRACT(HOUR FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as hour_belgrade,
    COUNT(*) as total_points,
    COUNT(*) FILTER (WHERE speed > 0) as moving_points,
    AVG(speed) FILTER (WHERE speed > 0)::NUMERIC(5,2) as avg_speed,
    MAX(speed)::NUMERIC(5,2) as max_speed,
    -- STARA VERZIJA - bez outlier filtera
    COALESCE(
        ST_Length(
            ST_MakeLine(location ORDER BY time)::geography
        ) / 1000.0,
        0
    )::NUMERIC(10,2) as total_km,
    MIN(time) as first_point,
    MAX(time) as last_point
FROM gps_data
WHERE vehicle_id IS NOT NULL
  AND speed > 0
  AND location IS NOT NULL
GROUP BY
    time_bucket('1 hour', time),
    vehicle_id,
    garage_no
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'hourly_vehicle_distance',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists => true
);

CREATE INDEX IF NOT EXISTS idx_hourly_vehicle_distance_vehicle
ON hourly_vehicle_distance(vehicle_id, hour_utc DESC);

CREATE INDEX IF NOT EXISTS idx_hourly_vehicle_distance_belgrade
ON hourly_vehicle_distance(vehicle_id, year_belgrade, month_belgrade, day_belgrade);
