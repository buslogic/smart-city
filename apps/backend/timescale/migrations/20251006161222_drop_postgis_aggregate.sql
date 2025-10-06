-- migrate:up
-- ==============================================================================
-- UKLANJANJE PostGIS AGREGATA koji NE RADI sa kompresovanim podacima
-- ==============================================================================
-- Continuous aggregate gps_data_5_minute_no_lag_aggregate koristi PostGIS
-- funkcije (ST_MakeLine, ST_Length) koje ne mogu da refresh-uju kada je
-- izvorni hypertable gps_data kompresovan.
--
-- Ostaje: gps_data_5_minute_no_postgis koji koristi custom Haversine funkciju
-- i radi bez problema sa kompresovanim podacima.
-- ==============================================================================

-- ==============================================================================
-- BRISANJE VIEW-OVA (moraju se obrisati PRE continuous aggregate)
-- ==============================================================================
DROP VIEW IF EXISTS monthly_view_gps_data_5_minute_no_lag_aggregates CASCADE;
DROP VIEW IF EXISTS daily_view_gps_data_5_minute_no_lag_aggregates CASCADE;
DROP VIEW IF EXISTS hourly_view_gps_data_5_minute_no_lag_aggregates CASCADE;

-- ==============================================================================
-- BRISANJE CONTINUOUS AGGREGATE (CASCADE briše i refresh policy)
-- ==============================================================================
DROP MATERIALIZED VIEW IF EXISTS gps_data_5_minute_no_lag_aggregate CASCADE;

-- ==============================================================================
-- VERIFIKACIJA
-- ==============================================================================
-- Proveri da su sve strukture uspešno uklonjene
DO $$
BEGIN
  -- Proveri da aggregate ne postoji
  IF EXISTS (
    SELECT 1 FROM timescaledb_information.continuous_aggregates
    WHERE view_name = 'gps_data_5_minute_no_lag_aggregate'
  ) THEN
    RAISE EXCEPTION 'Continuous aggregate gps_data_5_minute_no_lag_aggregate još uvek postoji!';
  END IF;

  -- Proveri da view-ovi ne postoje
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name IN (
      'hourly_view_gps_data_5_minute_no_lag_aggregates',
      'daily_view_gps_data_5_minute_no_lag_aggregates',
      'monthly_view_gps_data_5_minute_no_lag_aggregates'
    )
  ) THEN
    RAISE EXCEPTION 'Neki od view-ova još uvek postoje!';
  END IF;

  RAISE NOTICE '✅ PostGIS aggregate i view-ovi uspešno uklonjeni';
END $$;

-- migrate:down
-- ==============================================================================
-- ROLLBACK (za slučaj da treba vratiti)
-- ==============================================================================
-- NAPOMENA: Rollback nije idealan jer bi morao da se napravi pun refresh
-- agregata sa milijardama GPS tačaka. Bolje je ostaviti prazno i kreirati
-- nove migracije ako je potrebno.
-- ==============================================================================

RAISE EXCEPTION 'Rollback nije podržan za ovu migraciju. PostGIS aggregate ne može biti vraćen jer zahteva pun refresh sa 1.6B GPS tačaka.';
