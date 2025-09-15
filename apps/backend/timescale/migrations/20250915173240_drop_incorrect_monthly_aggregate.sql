-- migrate:up
-- Briše pogrešno napravljeni monthly agregat koji ne radi dobro sa Belgrade timezone

DO $$
BEGIN
    RAISE NOTICE '=================================================================================';
    RAISE NOTICE 'Brisanje neispravnog monthly_vehicle_distance agregata';
    RAISE NOTICE '=================================================================================';
END $$;

-- Briši neispravni agregat
DROP MATERIALIZED VIEW IF EXISTS monthly_vehicle_distance CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ monthly_vehicle_distance obrisan';
    RAISE NOTICE 'Spremno za kreiranje ispravnog agregata sa Belgrade timezone';
END $$;

-- migrate:down
-- Ne vraćamo neispravni agregat
DO $$
BEGIN
    RAISE NOTICE 'Rollback ne vraća neispravni agregat';
END $$;