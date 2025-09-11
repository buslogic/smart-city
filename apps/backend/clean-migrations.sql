-- Čišćenje duplirane migracije iz _prisma_migrations tabele
DELETE FROM _prisma_migrations WHERE migration_name LIKE '%add_api_keys%';
DELETE FROM _prisma_migrations WHERE migration_name LIKE '%20250910071605_add_permissions_crud_permissions%' AND finished_at IS NULL;