-- migrate:up
-- Hotfix: Samo označi migraciju kao primenjenu
-- Funkcije su već kreirane kroz prethodnu migraciju

DO $$
BEGIN
    RAISE NOTICE 'Funkcije su već kreirane kroz 20250918_timezone_parallel_migration migraciju';
END
$$;

-- migrate:down
-- Ne briši ništa jer su funkcije potrebne