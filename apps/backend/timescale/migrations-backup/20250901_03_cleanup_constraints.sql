-- migrate:up
-- Čišćenje duplikatnih i starih constraint-a/indeksa

-- 1. Ukloni stari unique index na (garage_no, time) - uključujući chunk-ove
DO $$
DECLARE
    idx RECORD;
BEGIN
    -- Ukloni sa glavne tabele
    DROP INDEX IF EXISTS idx_gps_data_unique CASCADE;
    
    -- Ukloni sa svih chunk-ova (TimescaleDB)
    FOR idx IN 
        SELECT indexname 
        FROM pg_indexes 
        WHERE indexname LIKE '%idx_gps_data_unique%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I CASCADE', idx.indexname);
        RAISE NOTICE 'Uklonjen index: %', idx.indexname;
    END LOOP;
END $$;

-- 2. Ukloni duplikat index (samo ako nije deo constraint-a)
DO $$
BEGIN
    -- Proveri da li je index deo constraint-a
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'gps_vehicle_time_unique'
    ) THEN
        DROP INDEX IF EXISTS gps_vehicle_time_unique CASCADE;
        RAISE NOTICE 'Uklonjen duplikat index gps_vehicle_time_unique';
    ELSE
        RAISE NOTICE 'Index gps_vehicle_time_unique je deo constraint-a, preskačem';
    END IF;
END $$;

-- 3. Proveri da li constraint postoji i radi
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'gps_vehicle_time_unique'
          AND conrelid = 'gps_data'::regclass
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE '✅ Constraint gps_vehicle_time_unique postoji i aktivan je';
    ELSE
        -- Ako ne postoji, kreiraj ga
        ALTER TABLE gps_data 
        ADD CONSTRAINT gps_vehicle_time_unique 
        UNIQUE (vehicle_id, time);
        RAISE NOTICE '✅ Kreiran novi constraint gps_vehicle_time_unique';
    END IF;
END $$;

-- 4. Verifikuj da ON CONFLICT radi
DO $$
BEGIN
    -- Pokušaj test insert sa ON CONFLICT
    INSERT INTO gps_data (time, vehicle_id, garage_no, lat, lng, location)
    VALUES (NOW(), 999999, 'TEST', 0, 0, ST_SetSRID(ST_MakePoint(0, 0), 4326))
    ON CONFLICT (vehicle_id, time) DO NOTHING;
    
    -- Očisti test podatak
    DELETE FROM gps_data WHERE vehicle_id = 999999;
    
    RAISE NOTICE '✅ ON CONFLICT (vehicle_id, time) verifikovan - radi ispravno!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '❌ ON CONFLICT ne radi: %', SQLERRM;
END $$;

-- migrate:down
-- Nema rollback - ovo je samo čišćenje