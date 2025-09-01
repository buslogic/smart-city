-- migrate:up
-- Popravka: Kreiraj pravi UNIQUE CONSTRAINT umesto samo INDEX-a
-- ON CONFLICT zahteva constraint, ne samo unique index

-- 1. Ukloni postojeći unique index
DROP INDEX IF EXISTS idx_gps_vehicle_time_unique;

-- 2. Kreiraj pravi unique constraint (ako ne postoji)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'gps_vehicle_time_unique'
          AND conrelid = 'gps_data'::regclass
    ) THEN
        ALTER TABLE gps_data 
        ADD CONSTRAINT gps_vehicle_time_unique 
        UNIQUE (vehicle_id, time);
        RAISE NOTICE 'Kreiran novi constraint gps_vehicle_time_unique';
    ELSE
        RAISE NOTICE 'Constraint gps_vehicle_time_unique već postoji, preskačem';
    END IF;
END $$;

-- 3. Verifikuj da constraint postoji
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'gps_vehicle_time_unique'
          AND table_name = 'gps_data'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE '✅ Unique constraint gps_vehicle_time_unique uspešno kreiran';
    ELSE
        RAISE EXCEPTION '❌ Greška: Constraint nije kreiran!';
    END IF;
END $$;

-- migrate:down
-- Vrati na index umesto constraint-a
ALTER TABLE gps_data DROP CONSTRAINT IF EXISTS gps_vehicle_time_unique;
CREATE UNIQUE INDEX idx_gps_vehicle_time_unique ON gps_data (vehicle_id, time);