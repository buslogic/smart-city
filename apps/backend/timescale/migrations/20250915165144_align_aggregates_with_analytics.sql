-- migrate:up
-- Ova migracija briše stare aggregate koji nisu tačni
-- Priprema za novi monthly agregat koji radi sa Belgrade timezone

DO $$
BEGIN
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE 'Brisanje starih agregata koji nisu tačni sa timezone';
    RAISE NOTICE '=================================================================================';
END $$;

-- Briši postojeće aggregate koji nisu tačni
DROP MATERIALIZED VIEW IF EXISTS daily_vehicle_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vehicle_hourly_stats CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Stari agregati obrisani';
    RAISE NOTICE 'Spremno za kreiranje novog monthly agregata';
END $$;

-- migrate:down
-- Ne možemo vraćati stare aggregate jer nisu bili tačni
DO $$
BEGIN
    RAISE NOTICE 'Rollback nije potreban - stari agregati nisu bili tačni';
END $$;