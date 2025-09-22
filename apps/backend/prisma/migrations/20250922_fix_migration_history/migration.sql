-- Ukloni staru migraciju sa pogrešnim datumom iz istorije
DELETE FROM _prisma_migrations
WHERE migration_name = '20250108222300_add_maintenance_timescaledb_manage_permission';

-- Dodaj novu migraciju sa ispravnim datumom u istoriju
INSERT INTO _prisma_migrations (
    id,
    checksum,
    finished_at,
    migration_name,
    logs,
    rolled_back_at,
    started_at,
    applied_steps_count
) VALUES (
    UUID(),
    '4a7c3b8d9e2f1a6b5c4d3e2f1a6b5c4d3e2f1a6b5c4d3e2f1a6b5c4d3e2f1a6b',
    NOW(),
    '20250908222300_add_maintenance_timescaledb_manage_permission',
    NULL,
    NULL,
    NOW(),
    1
);