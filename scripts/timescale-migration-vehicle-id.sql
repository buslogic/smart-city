-- TimescaleDB Migracija: Prelazak sa garage_no na vehicle_id kao primarni identifikator
-- Datum: 2025-09-01
-- Autor: Smart City Team
-- 
-- NAPOMENA: Ova migracija menja unique constraint sa (garage_no, time) na (vehicle_id, time)
-- Pre pokretanja, uverite se da su svi GPS podaci već imaju vehicle_id popunjen!

-- 1. Proveri da li svi redovi imaju vehicle_id
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count 
    FROM gps_data 
    WHERE vehicle_id IS NULL;
    
    IF null_count > 0 THEN
        RAISE EXCEPTION 'Pronađeno % redova bez vehicle_id. Molimo prvo popunite vehicle_id za sve redove!', null_count;
    END IF;
END $$;

-- 2. Ukloni stari unique constraint
ALTER TABLE gps_data DROP CONSTRAINT IF EXISTS idx_gps_data_unique;

-- 3. Kreiraj novi unique constraint na (vehicle_id, time)
CREATE UNIQUE INDEX idx_gps_vehicle_time_unique 
ON gps_data (vehicle_id, time);

-- 4. Ažuriraj postojeće indekse
-- Ukloni stari indeks ako postoji
DROP INDEX IF EXISTS idx_gps_garage_time;

-- Kreiraj novi kompozitni indeks
CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time 
ON gps_data (vehicle_id, time DESC);

-- 5. Ažuriraj garage_no indeks da bude obični (ne unique)
DROP INDEX IF EXISTS idx_gps_garage_no;
CREATE INDEX idx_gps_garage_no 
ON gps_data (garage_no) 
WHERE garage_no IS NOT NULL;

-- 6. Dodaj komentar na tabelu
COMMENT ON TABLE gps_data IS 'GPS tracking podaci - primarni ključ je (vehicle_id, time). Garage_no se čuva za prikaz i legacy integraciju.';

-- 7. Dodaj komentare na kolone
COMMENT ON COLUMN gps_data.vehicle_id IS 'ID vozila iz bus_vehicles tabele (MySQL) - PRIMARNI IDENTIFIKATOR';
COMMENT ON COLUMN gps_data.garage_no IS 'Garažni broj vozila - može se promeniti tokom vremena, koristi se samo za prikaz';

-- 8. Kreiraj funkciju za ažuriranje garage_no ako se promeni u MySQL-u
CREATE OR REPLACE FUNCTION update_garage_number(
    p_vehicle_id INTEGER,
    p_new_garage_no VARCHAR(20)
) RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE gps_data 
    SET garage_no = p_new_garage_no 
    WHERE vehicle_id = p_vehicle_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Ažurirano % GPS tačaka za vozilo ID % sa novim garažnim brojem %', 
                 updated_count, p_vehicle_id, p_new_garage_no;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_garage_number IS 'Ažurira garage_no za sve GPS tačke vozila kada se promeni garažni broj';

-- 9. Kreiraj view za lakše praćenje vozila
CREATE OR REPLACE VIEW v_vehicle_gps_summary AS
SELECT 
    vehicle_id,
    garage_no,
    COUNT(*) as total_points,
    MIN(time) as first_point,
    MAX(time) as last_point,
    ROUND(ST_Length(ST_MakeLine(location ORDER BY time)::geography) / 1000.0, 2) as total_km,
    ROUND(AVG(speed), 1) as avg_speed,
    MAX(speed) as max_speed
FROM gps_data
GROUP BY vehicle_id, garage_no
ORDER BY vehicle_id;

COMMENT ON VIEW v_vehicle_gps_summary IS 'Sumarni pregled GPS podataka po vozilu';

-- 10. Verifikuj migraciju
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    -- Proveri da li novi constraint postoji
    SELECT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_gps_vehicle_time_unique'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE '✅ Migracija uspešna! Unique constraint prebačen sa (garage_no, time) na (vehicle_id, time)';
    ELSE
        RAISE EXCEPTION '❌ Migracija neuspešna! Novi constraint nije kreiran.';
    END IF;
END $$;

-- Prikaži statistiku
SELECT 
    'Statistika nakon migracije:' as info
UNION ALL
SELECT 
    'Ukupno GPS tačaka: ' || COUNT(*)::text
FROM gps_data
UNION ALL
SELECT 
    'Jedinstvenih vozila (po vehicle_id): ' || COUNT(DISTINCT vehicle_id)::text
FROM gps_data
UNION ALL
SELECT 
    'Jedinstvenih garažnih brojeva: ' || COUNT(DISTINCT garage_no)::text
FROM gps_data;