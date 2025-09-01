-- migrate:up
-- Čišćenje test podataka koji su dodati tokom testiranja constraint-a
-- Datum: 2025-09-01

-- Briši test podatke iz 2024. godine (nisu pravi GPS podaci)
-- Koristimo tačno vreme jer znamo koji je test podatak
DELETE FROM gps_data WHERE time = '2024-01-01 10:00:00+00'::timestamptz;

-- Prikaži poruku o broju obrisanih redova
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
        RAISE NOTICE 'Obrisano % test tačaka iz 2024. godine', deleted_count;
    ELSE
        RAISE NOTICE 'Nema test podataka za brisanje';
    END IF;
END $$;

-- migrate:down
-- Rollback: Vraćanje test podatka (samo za potrebe testiranja)
-- Napomena: Ovo neće vratiti identičan podatak, već samo reprezentativan test zapis
INSERT INTO gps_data (vehicle_id, garage_no, time, lat, lng, location, speed)
VALUES (
    460, 
    'P93597', 
    '2024-01-01 10:00:00', 
    44.7866, 
    20.4489, 
    ST_SetSRID(ST_MakePoint(20.4489, 44.7866), 4326), 
    50
) ON CONFLICT DO NOTHING;