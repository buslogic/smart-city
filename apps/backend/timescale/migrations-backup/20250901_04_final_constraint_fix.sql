-- migrate:up
-- Finalno rešenje za constraint probleme
-- Ova migracija osigurava da imamo samo jedan unique constraint na (vehicle_id, time)

-- 1. Prvo ukloni sve stare unique indekse na (garage_no, time)
DO $$
DECLARE
    idx RECORD;
    constraint_exists BOOLEAN;
BEGIN
    -- Ukloni idx_gps_data_unique ako postoji
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gps_data_unique') THEN
        DROP INDEX idx_gps_data_unique CASCADE;
        RAISE NOTICE 'Uklonjen stari idx_gps_data_unique';
    END IF;
    
    -- Ukloni sa svih chunk-ova (TimescaleDB)
    FOR idx IN 
        SELECT indexname 
        FROM pg_indexes 
        WHERE indexname LIKE '%idx_gps_data_unique%'
           OR indexname LIKE '_hyper_%_idx_gps_data_unique'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I CASCADE', idx.indexname);
        RAISE NOTICE 'Uklonjen chunk index: %', idx.indexname;
    END LOOP;
    
    -- 2. Proveri da li constraint već postoji
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'gps_vehicle_time_unique'
          AND conrelid = 'gps_data'::regclass
    ) INTO constraint_exists;
    
    IF NOT constraint_exists THEN
        -- Kreiraj constraint ako ne postoji
        ALTER TABLE gps_data 
        ADD CONSTRAINT gps_vehicle_time_unique 
        UNIQUE (vehicle_id, time);
        RAISE NOTICE '✅ Kreiran novi constraint gps_vehicle_time_unique';
    ELSE
        RAISE NOTICE '✅ Constraint gps_vehicle_time_unique već postoji';
    END IF;
    
    -- 3. Test da ON CONFLICT radi
    BEGIN
        INSERT INTO gps_data (time, vehicle_id, garage_no, lat, lng, location, data_source)
        VALUES (NOW(), 999999, 'TEST', 0, 0, ST_SetSRID(ST_MakePoint(0, 0), 4326), 'test')
        ON CONFLICT (vehicle_id, time) DO NOTHING;
        
        DELETE FROM gps_data WHERE vehicle_id = 999999;
        RAISE NOTICE '✅ ON CONFLICT (vehicle_id, time) verifikovan!';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION '❌ ON CONFLICT test neuspešan: %', SQLERRM;
    END;
END $$;

-- 4. Očisti ostale nepotrebne indekse
DROP INDEX IF EXISTS idx_gps_vehicle_time_unique;  -- Duplikat naziv

-- 5. Finalna verifikacija
DO $$
DECLARE
    idx_count INTEGER;
    constraint_count INTEGER;
BEGIN
    -- Proveri da nema više starih indeksa
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes 
    WHERE tablename = 'gps_data' 
      AND indexname LIKE '%idx_gps_data_unique%';
    
    IF idx_count > 0 THEN
        RAISE WARNING 'Još uvek postoji % starih indeksa', idx_count;
    END IF;
    
    -- Proveri da constraint postoji
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint 
    WHERE conname = 'gps_vehicle_time_unique'
      AND conrelid = 'gps_data'::regclass;
    
    IF constraint_count = 1 THEN
        RAISE NOTICE '✅ Migracija uspešna! Constraint je pravilno podešen.';
    ELSE
        RAISE EXCEPTION '❌ Problem sa constraint-om, broj: %', constraint_count;
    END IF;
END $$;

-- migrate:down
-- Vraćanje na stari sistem nije preporučeno
-- Ali ako je potrebno:
ALTER TABLE gps_data DROP CONSTRAINT IF EXISTS gps_vehicle_time_unique;
CREATE UNIQUE INDEX idx_gps_data_unique ON gps_data (garage_no, time);