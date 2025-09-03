-- migrate:up
-- Dodajemo request_count kolonu za praćenje broja API poziva
DO $$
BEGIN
    -- Dodaj kolonu ako ne postoji
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'request_count'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN request_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Kolona request_count dodata u api_keys tabelu';
    ELSE
        RAISE NOTICE 'Kolona request_count već postoji';
    END IF;
    
    -- Kreiraj indeks za brže query-je po request_count
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'api_keys' 
        AND indexname = 'idx_api_keys_request_count'
    ) THEN
        CREATE INDEX idx_api_keys_request_count ON api_keys(request_count);
        RAISE NOTICE 'Indeks idx_api_keys_request_count kreiran';
    END IF;
END $$;

-- migrate:down
-- Uklanjamo request_count kolonu i indeks
DO $$
BEGIN
    -- Ukloni indeks ako postoji
    DROP INDEX IF EXISTS idx_api_keys_request_count;
    RAISE NOTICE 'Indeks idx_api_keys_request_count uklonjen';
    
    -- Ukloni kolonu ako postoji
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'request_count'
    ) THEN
        ALTER TABLE api_keys DROP COLUMN request_count;
        RAISE NOTICE 'Kolona request_count uklonjena iz api_keys tabele';
    END IF;
END $$;
