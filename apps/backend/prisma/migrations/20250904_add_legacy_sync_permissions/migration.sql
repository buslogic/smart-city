-- Dodavanje permisija za Legacy GPS Sync
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) 
VALUES 
  ('legacy_sync.view', 'legacy_sync', 'view', 'View Legacy GPS Sync', 'Pregled Legacy GPS sinhronizacije', 'dispatcher', NOW(), NOW()),
  ('legacy_sync.manage', 'legacy_sync', 'manage', 'Manage Legacy GPS Sync', 'Upravljanje Legacy GPS sinhronizacijom', 'dispatcher', NOW(), NOW()),
  ('legacy_sync.start', 'legacy_sync', 'start', 'Start Legacy GPS Sync', 'Pokretanje Legacy GPS sinhronizacije', 'dispatcher', NOW(), NOW()),
  ('legacy_sync.stop', 'legacy_sync', 'stop', 'Stop Legacy GPS Sync', 'Zaustavljanje Legacy GPS sinhronizacije', 'dispatcher', NOW(), NOW());

-- Dodeli permisije SUPER_ADMIN roli
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT 
  r.id as roleId,
  p.id as permissionId
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN' 
  AND p.resource = 'legacy_sync';