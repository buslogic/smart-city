-- Add safety permissions
INSERT INTO `permissions` (`name`, `resource`, `action`, `description`, `created_at`, `updated_at`)
VALUES 
    ('dispatcher:sync_gps', 'dispatcher', 'sync_gps', 'GPS sinhronizacija dispečerskog modula', NOW(), NOW()),
    ('safety:view_aggressive_driving', 'safety', 'view_aggressive', 'Pregled agresivne vožnje', NOW(), NOW()),
    ('safety:view_monthly_report', 'safety', 'view_report', 'Pregled mesečnog izveštaja bezbednosti', NOW(), NOW()),
    ('safety:manage', 'safety', 'manage', 'Upravljanje bezbednosnim podešavanjima', NOW(), NOW()),
    ('dashboard.view', 'dashboard', 'read', 'Pregled dashboard-a', NOW(), NOW()),
    ('dashboard.analytics', 'dashboard', 'read', 'Pregled analitike', NOW(), NOW()),
    ('reports.create', 'reports', 'create', 'Kreiranje izveštaja', NOW(), NOW()),
    ('reports.read', 'reports', 'read', 'Pregled izveštaja', NOW(), NOW()),
    ('reports.export', 'reports', 'manage', 'Eksportovanje izveštaja', NOW(), NOW())
ON DUPLICATE KEY UPDATE
    `description` = VALUES(`description`),
    `updated_at` = NOW();