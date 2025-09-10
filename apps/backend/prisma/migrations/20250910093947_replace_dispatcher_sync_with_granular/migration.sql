-- Prvo sačuvaj postojeće role_permissions za dispatcher:sync_gps
CREATE TEMPORARY TABLE temp_dispatcher_sync_roles (
  roleId INT PRIMARY KEY
);

INSERT INTO temp_dispatcher_sync_roles
SELECT DISTINCT rp.roleId
FROM role_permissions rp
JOIN permissions p ON rp.permissionId = p.id
WHERE p.name = 'dispatcher:sync_gps';

-- Ukloni stare role_permissions
DELETE FROM role_permissions 
WHERE permissionId IN (
  SELECT id FROM permissions WHERE name = 'dispatcher:sync_gps'
);

-- Ukloni staru permisiju
DELETE FROM permissions WHERE name = 'dispatcher:sync_gps';

-- Dodaj nove granularne permisije za dispatcher.sync
INSERT INTO permissions (name, resource, action, description, created_at, updated_at) VALUES
  ('dispatcher.sync:view', 'dispatcher.sync', 'view', 'Pregled statusa GPS sinhronizacije i istorije', NOW(), NOW()),
  ('dispatcher.sync:start', 'dispatcher.sync', 'start', 'Pokretanje GPS sinhronizacije', NOW(), NOW()),
  ('dispatcher.sync:stop', 'dispatcher.sync', 'stop', 'Zaustavljanje GPS sinhronizacije', NOW(), NOW()),
  ('dispatcher.sync:configure', 'dispatcher.sync', 'configure', 'Konfiguracija parametara sinhronizacije', NOW(), NOW()),
  ('dispatcher.sync:cleanup', 'dispatcher.sync', 'cleanup', 'Čišćenje starih/nezavršenih sinhronizacija', NOW(), NOW()),
  ('dispatcher.sync:dashboard', 'dispatcher.sync', 'dashboard', 'Pristup GPS sync dashboard widget-u', NOW(), NOW());

-- Dodeli sve nove permisije rolama koje su imale staru permisiju
INSERT INTO role_permissions (roleId, permissionId)
SELECT 
  r.roleId,
  p.id
FROM temp_dispatcher_sync_roles r
CROSS JOIN permissions p
WHERE p.resource = 'dispatcher.sync';

-- Obriši privremenu tabelu
DROP TEMPORARY TABLE temp_dispatcher_sync_roles;