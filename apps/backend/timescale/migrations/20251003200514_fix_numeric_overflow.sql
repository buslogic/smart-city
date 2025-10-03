-- migrate:up
-- ==============================================================================
-- FIX: Numeric overflow za calculated_speed_kmh
-- ==============================================================================
-- Problem: NUMERIC(5,2) može držati max 999.99 km/h
-- GPS glitch može generisati ogromne brzine (10000+ km/h)
-- Rešenje: Povećaj preciznost na NUMERIC(10,2)
-- ==============================================================================

-- Promeni tip kolone da može držati veće vrednosti
ALTER TABLE gps_data_lag_filtered
ALTER COLUMN calculated_speed_kmh TYPE NUMERIC(10,2);

COMMENT ON COLUMN gps_data_lag_filtered.calculated_speed_kmh IS
'Izračunata brzina između dve GPS tačke u km/h.
Može biti veoma velika kod GPS glitch-eva (do 99999999.99 km/h)';

-- migrate:down
-- Vrati na originalnu preciznost
ALTER TABLE gps_data_lag_filtered
ALTER COLUMN calculated_speed_kmh TYPE NUMERIC(5,2);