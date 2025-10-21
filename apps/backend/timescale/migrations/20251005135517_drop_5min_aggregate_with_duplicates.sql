-- migrate:up
-- ==============================================================================
-- DROP 5-MINUTNOG AGREGATA I ZAVISNIH VIEW-OVA (SA DUPLIKATIMA)
-- ==============================================================================
-- Briše postojeći continuous aggregate koji ima duplikate zbog nedostatka
-- UNIQUE constraint-a. Sledeća migracija će kreirati novi sa UNIQUE indexom.
-- ==============================================================================

-- Drop sve view-ove prvo (CASCADE će pokriti zavisnosti)
DROP VIEW IF EXISTS monthly_view_gps_data_5_minute_no_lag_aggregates CASCADE;
DROP VIEW IF EXISTS daily_view_gps_data_5_minute_no_lag_aggregates CASCADE;
DROP VIEW IF EXISTS hourly_view_gps_data_5_minute_no_lag_aggregates CASCADE;

-- Drop continuous aggregate (ovo briše i refresh policy automatski)
DROP MATERIALIZED VIEW IF EXISTS gps_data_5_minute_no_LAG_aggregate CASCADE;

-- ==============================================================================
-- NAPOMENA: Podaci su izbrisani!
-- Sledeća migracija će kreirati novi agregat sa UNIQUE constraintom i
-- pokrenuti refresh da popuni podatke bez duplikata.
-- ==============================================================================

-- migrate:down

-- Rollback nije moguć jer podaci ne postoje
-- Vraćanje zahteva manuelno izvršavanje prethodne migracije (20251005102202)
SELECT 1; -- Placeholder jer dbmate zahteva SQL iskaz
