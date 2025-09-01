-- PAŽNJA: Ova skripta briše SVE podatke iz TimescaleDB!
-- Pokreni samo ako si siguran!

-- 1. Obriši continuous aggregates
DROP MATERIALIZED VIEW IF EXISTS daily_vehicle_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vehicle_hourly_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS daily_mileage CASCADE;

-- 2. Obriši views
DROP VIEW IF EXISTS current_vehicle_positions CASCADE;
DROP VIEW IF EXISTS v_vehicle_gps_summary CASCADE;

-- 3. Obriši funkcije
DROP FUNCTION IF EXISTS update_garage_number(INTEGER, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS set_gps_location() CASCADE;
DROP FUNCTION IF EXISTS calculate_mileage(INTEGER, TIMESTAMP, TIMESTAMP) CASCADE;
DROP FUNCTION IF EXISTS update_gps_statistics() CASCADE;

-- 4. Obriši tabele
DROP TABLE IF EXISTS driving_events CASCADE;
DROP TABLE IF EXISTS gps_data CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;

-- 5. Očisti schema_migrations
DELETE FROM schema_migrations;

-- Poruka
DO $$
BEGIN
    RAISE NOTICE '✅ Baza je resetovana - sve tabele i podaci su obrisani';
    RAISE NOTICE '📝 Sada možeš pokrenuti novu seed migraciju';
END $$;