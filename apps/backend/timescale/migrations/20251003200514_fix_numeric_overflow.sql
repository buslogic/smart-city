-- migrate:up
-- ==============================================================================
-- FIX: Numeric overflow za calculated_speed_kmh
-- ==============================================================================
-- Problem: NUMERIC(5,2) može držati max 999.99 km/h
-- GPS glitch može generisati ogromne brzine (10000+ km/h)
-- Rešenje: Povećaj preciznost na NUMERIC(10,2)
-- ==============================================================================

-- VAŽNO: ALTER COLUMN ne radi na hypertable sa columnstore compression
-- Moramo prvo da dekompresujemo, pa onda izmenimo kolonu

-- 1. Ukloni compression policy
SELECT remove_compression_policy('gps_data_lag_filtered', if_exists => true);

-- 2. Dekompresuj sve chunk-ove
SELECT decompress_chunk(c.chunk_schema || '.' || c.chunk_name)
FROM timescaledb_information.chunks c
WHERE c.hypertable_name = 'gps_data_lag_filtered'
  AND c.is_compressed = true;

-- 3. Sada možemo da promenimo tip kolone
ALTER TABLE gps_data_lag_filtered
ALTER COLUMN calculated_speed_kmh TYPE NUMERIC(10,2);

-- NAPOMENA: NE aktiviramo compression ponovo jer može praviti probleme
-- Kompresija će biti dodata nakon što sve migracije prođu

COMMENT ON COLUMN gps_data_lag_filtered.calculated_speed_kmh IS
'Izračunata brzina između dve GPS tačke u km/h.
Može biti veoma velika kod GPS glitch-eva (do 99999999.99 km/h)';

-- migrate:down
-- Vrati na originalnu preciznost (sa dekompresijom)

SELECT remove_compression_policy('gps_data_lag_filtered', if_exists => true);

SELECT decompress_chunk(c.chunk_schema || '.' || c.chunk_name)
FROM timescaledb_information.chunks c
WHERE c.hypertable_name = 'gps_data_lag_filtered'
  AND c.is_compressed = true;

ALTER TABLE gps_data_lag_filtered
ALTER COLUMN calculated_speed_kmh TYPE NUMERIC(5,2);

ALTER TABLE gps_data_lag_filtered SET (
    timescaledb.compress,
    timescaledb.compress_orderby = 'time DESC',
    timescaledb.compress_segmentby = 'vehicle_id'
);

SELECT add_compression_policy(
    'gps_data_lag_filtered',
    compress_after => INTERVAL '30 days',
    if_not_exists => TRUE
);