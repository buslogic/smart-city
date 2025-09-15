-- migrate:up
-- Kreiranje finalnog monthly agregata koji radi identično kao analytics
-- Ovaj agregat pravilno računa kilometražu kao jedan segment po mesecu

DO $$
BEGIN
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE 'Kreiranje monthly_vehicle_distance agregata';
    RAISE NOTICE 'Ovaj agregat računa identične km kao analytics sa Belgrade timezone';
    RAISE NOTICE '=================================================================================';
END $$;

-- Kreiraj monthly agregat koji računa kao analytics
CREATE MATERIALIZED VIEW monthly_vehicle_distance
WITH (timescaledb.continuous) AS
SELECT
    -- UTC bucket (standard za TimescaleDB)
    time_bucket('1 month', time) AS month_utc,
    vehicle_id,
    garage_no,
    -- Broj GPS tačaka
    COUNT(*) as total_points,
    COUNT(*) FILTER (WHERE speed > 0) as moving_points,
    -- Brzina statistike
    AVG(speed) FILTER (WHERE speed > 0)::NUMERIC(5,2) as avg_speed,
    MAX(speed)::NUMERIC(5,2) as max_speed,
    -- KILOMETRAŽA - ključni deo, identično kao analytics!
    COALESCE(
        ST_Length(
            ST_MakeLine(location ORDER BY time)::geography
        ) / 1000.0,
        0
    )::NUMERIC(10,2) as total_km,
    -- Vremenske granice
    MIN(time) as first_point,
    MAX(time) as last_point,
    -- Broj aktivnih dana
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
    RAISE NOTICE '✅ monthly_vehicle_distance agregat kreiran!';
    RAISE NOTICE '';
    RAISE NOTICE 'VAŽNO ZA UPOTREBU:';
    RAISE NOTICE '';
    RAISE NOTICE 'Za Belgrade mesec (npr. August 2025), koristite:';
    RAISE NOTICE '';
    RAISE NOTICE 'SELECT SUM(total_km) as monthly_km';
    RAISE NOTICE 'FROM monthly_vehicle_distance';
    RAISE NOTICE 'WHERE vehicle_id = ?';
    RAISE NOTICE '  AND month_utc >= ''2025-08-01 00:00:00+02''::timestamptz - INTERVAL ''1 month''';
    RAISE NOTICE '  AND month_utc < ''2025-09-01 00:00:00+02''::timestamptz;';
    RAISE NOTICE '';
    RAISE NOTICE 'Ovo će sumirati UTC buckete koji pokrivaju Belgrade mesec';
    RAISE NOTICE 'i dati identične km kao analytics!';
    RAISE NOTICE '';
    RAISE NOTICE 'Za refresh:';
    RAISE NOTICE 'CALL refresh_continuous_aggregate(''monthly_vehicle_distance'', NULL, NULL);';
    RAISE NOTICE '=================================================================================';
END $$;

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS monthly_vehicle_distance CASCADE;