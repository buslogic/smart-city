-- migrate:up
-- Inicijalna shema TimescaleDB baze (postojeće stanje)
-- Ova migracija predstavlja trenutno stanje baze koje je kreirano kroz Docker init skriptove

-- Napomena: Ova migracija se neće izvršiti jer struktura već postoji,
-- ali služi kao referenca za dbmate da zna početno stanje

-- Tabele već postoje:
-- - gps_data (hypertable sa unique constraint na garage_no, time)
-- - api_keys (za autentifikaciju)
-- - driving_events (za agresivnu vožnju)
-- - spatial_ref_sys (PostGIS)

-- migrate:down
-- Nema rollback za inicijalnu shemu