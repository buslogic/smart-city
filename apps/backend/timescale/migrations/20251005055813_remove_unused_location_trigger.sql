-- migrate:up
-- Brisanje neiskorišćene funkcije i trigger-a za location polje
-- Razlog: TimescaleDB trigger ne radi na hypertable chunk-ovima
-- Location polje se sada eksplicitno kreira u INSERT SQL upitima

-- Obriši trigger ako postoji
DROP TRIGGER IF EXISTS set_location_trigger ON gps_data;

-- Obriši funkciju (CASCADE će obrisati i sve vezane trigger-e)
DROP FUNCTION IF EXISTS set_gps_location() CASCADE;

-- migrate:down
-- Vraćanje funkcije i trigger-a (za rollback)

-- Kreiraj funkciju
CREATE OR REPLACE FUNCTION set_gps_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Kreiraj trigger
CREATE TRIGGER set_location_trigger
BEFORE INSERT OR UPDATE ON gps_data
FOR EACH ROW
EXECUTE FUNCTION set_gps_location();
