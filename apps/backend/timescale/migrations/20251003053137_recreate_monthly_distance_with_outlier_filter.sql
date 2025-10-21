-- migrate:up
-- Dodavanje outlier filtera u monthly_vehicle_distance aggregate
-- Eliminiše GPS skokove veće od 150m između uzastopnih tačaka

DO $$
BEGIN
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE 'Kreiranje monthly_vehicle_distance SA outlier filterom (max 150m)';
    RAISE NOTICE '=================================================================================';
END $$;

-- 1. NAPOMENA: Koristimo HIBRIDNI pristup (industry standard)
-- Inspirisan Geotab, Samsara fleet management sistemima
-- Filtrira outliere po DVA kriterijuma:
--   A) Distance threshold: segment > 300m
--   B) Speed threshold: calculated speed > 120 km/h
-- Gradi liniju samo od VALIDNIH tačaka (Analytics logika)

DO $$
BEGIN
    RAISE NOTICE '✅ Koristimo HIBRIDNI pristup: Distance (300m) + Speed (120 km/h) filter';
END $$;

-- 2. Kreiraj HIBRIDNU funkciju (Distance + Speed outlier detection)
CREATE OR REPLACE FUNCTION calculate_distance_hybrid_filter(
  locations public.geography[],
  times TIMESTAMPTZ[],
  max_distance_meters NUMERIC DEFAULT 300,
  max_speed_kmh NUMERIC DEFAULT 120
)
RETURNS NUMERIC AS $$
DECLARE
  total_distance NUMERIC := 0;
  i INTEGER;
  segment_distance NUMERIC;
  time_diff_seconds NUMERIC;
  calculated_speed_kmh NUMERIC;
  is_valid BOOLEAN;
  last_valid_idx INTEGER := 1;
BEGIN
  -- Proveri da li ima podataka
  IF array_length(locations, 1) IS NULL OR array_length(locations, 1) < 2 THEN
    RETURN 0;
  END IF;

  -- Iteriraj kroz sve tačke i primeni HIBRIDNI filter
  FOR i IN 2..array_length(locations, 1) LOOP
    -- Računaj distance i speed između trenutne i PRETHODNE tačke
    segment_distance := public.ST_Distance(
      locations[i]::public.geography,
      locations[i-1]::public.geography
    );

    time_diff_seconds := EXTRACT(EPOCH FROM (times[i] - times[i-1]));

    -- Izračunaj brzinu (m/s → km/h)
    IF time_diff_seconds > 0 THEN
      calculated_speed_kmh := (segment_distance / time_diff_seconds) * 3.6;
    ELSE
      calculated_speed_kmh := 0;
    END IF;

    -- HIBRIDNI filter: tačka je validna AKO:
    --   1. Distance <= 300m
    --   2. Speed <= 120 km/h
    is_valid := (segment_distance <= max_distance_meters)
                AND (calculated_speed_kmh <= max_speed_kmh);

    IF is_valid THEN
      -- Tačka je validna - dodaj distancu od POSLEDNJE VALIDNE tačke
      total_distance := total_distance + public.ST_Distance(
        locations[i]::public.geography,
        locations[last_valid_idx]::public.geography
      );
      -- Ažuriraj poslednju validnu tačku
      last_valid_idx := i;
    END IF;
    -- Ako je outlier, preskači je ali NASTAVI sa proverom sledeće
  END LOOP;

  RETURN total_distance / 1000.0; -- konvertuj u km
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

DO $$
BEGIN
    RAISE NOTICE '✅ HIBRIDNA funkcija kreirana: calculate_distance_hybrid_filter()';
    RAISE NOTICE '   - Distance threshold: 300m';
    RAISE NOTICE '   - Speed threshold: 120 km/h';
END $$;

-- 3. Drop postojeći aggregate CASCADE (uklanja i policies)
DROP MATERIALIZED VIEW IF EXISTS monthly_vehicle_distance CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Stari monthly_vehicle_distance obrisan';
END $$;

-- 4. Kreiraj monthly aggregate sa HIBRIDNOM funkcijom + Belgrade metadata
CREATE MATERIALIZED VIEW monthly_vehicle_distance
WITH (timescaledb.continuous) AS
SELECT
    -- UTC bucket (za TimescaleDB kompatibilnost)
    time_bucket('1 month', time) AS month_utc,
    vehicle_id,
    garage_no,
    -- Belgrade timezone metadata (za tačne mesečne izveštaje)
    EXTRACT(YEAR FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as year_belgrade,
    EXTRACT(MONTH FROM MIN(time AT TIME ZONE 'Europe/Belgrade'))::INTEGER as month_belgrade,
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
    MAX(time) as last_point,
    COUNT(DISTINCT DATE(time AT TIME ZONE 'Europe/Belgrade')) as active_days
FROM gps_data
WHERE vehicle_id IS NOT NULL
  AND speed > 0  -- Samo tačke u kretanju
  AND location IS NOT NULL
GROUP BY
    time_bucket('1 month', time),
    vehicle_id,
    garage_no
WITH NO DATA;

DO $$
BEGIN
    RAISE NOTICE '✅ Novi monthly_vehicle_distance kreiran SA HIBRIDNIM filterom';
END $$;

-- 5. Dodaj refresh policy (automatski refresh)
SELECT add_continuous_aggregate_policy(
    'monthly_vehicle_distance',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => true
);

DO $$
BEGIN
    RAISE NOTICE '✅ Refresh policy dodata (svakih 1 sat)';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE 'NAPOMENA: Aggregate JE PRAZAN (WITH NO DATA)';
    RAISE NOTICE '';
    RAISE NOTICE 'HIBRIDNI OUTLIER FILTER AKTIVAN:';
    RAISE NOTICE '  ✓ Distance threshold: 300m između tačaka';
    RAISE NOTICE '  ✓ Speed threshold: 120 km/h calculated speed';
    RAISE NOTICE '';
    RAISE NOTICE 'Za inicijalni refresh, pokreni:';
    RAISE NOTICE 'CALL refresh_continuous_aggregate(''monthly_vehicle_distance'', NULL, NULL);';
    RAISE NOTICE '';
    RAISE NOTICE 'Ovo će populate-ovati sve istorijske podatke SA outlier filterom.';
    RAISE NOTICE 'Očekivano vreme: ~2-5 minuta za par meseci podataka.';
    RAISE NOTICE '=================================================================================';
END $$;

-- migrate:down
-- Vrati na staru verziju BEZ outlier filtera

DROP MATERIALIZED VIEW IF EXISTS monthly_vehicle_distance CASCADE;
DROP FUNCTION IF EXISTS calculate_distance_hybrid_filter(public.geography[], TIMESTAMPTZ[], NUMERIC, NUMERIC);

-- Re-kreiraj staru verziju (bez outlier filtera)
CREATE MATERIALIZED VIEW monthly_vehicle_distance
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 month', time) AS month_utc,
    vehicle_id,
    garage_no,
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
    MAX(time) as last_point,
    COUNT(DISTINCT DATE(time AT TIME ZONE 'Europe/Belgrade')) as active_days
FROM gps_data
WHERE vehicle_id IS NOT NULL
  AND speed > 0
GROUP BY
    time_bucket('1 month', time),
    vehicle_id,
    garage_no
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'monthly_vehicle_distance',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => true
);
