-- Prvo obriši postojeće pogrešne permisije sa dvotačkom
DELETE FROM role_permissions WHERE permissionId IN (
  SELECT id FROM permissions WHERE name LIKE 'dashboard:%'
);
DELETE FROM permissions WHERE name LIKE 'dashboard:%';

-- Dodaj ispravne permisije sa tačkom
INSERT INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) VALUES
('dashboard.read', 'dashboard', 'read', 'View Dashboard page', 'Pregled Dashboard stranice', 'Dashboard', NOW(), NOW()),
('dashboard.update', 'dashboard', 'update', 'Update Dashboard configuration', 'Izmena Dashboard konfiguracije', 'Dashboard', NOW(), NOW()),
('dashboard.widgets.vehicles.view', 'dashboard.widgets.vehicles', 'view', 'View Vehicle Statistics widget', 'Pregled Vehicle Statistics widget-a', 'Dashboard', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  description = VALUES(description),
  description_sr = VALUES(description_sr),
  updated_at = NOW();

-- Dodeli permisije SUPER_ADMIN roli
INSERT INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN' 
  AND p.name IN ('dashboard.read', 'dashboard.update', 'dashboard.widgets.vehicles.view')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.roleId = r.id AND rp.permissionId = p.id
  );

-- Dodeli read i widget permisije ostalim ulogama
INSERT INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('CITY_MANAGER', 'DEPARTMENT_HEAD', 'OPERATOR', 'ANALYST')
  AND p.name IN ('dashboard.read', 'dashboard.widgets.vehicles.view')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.roleId = r.id AND rp.permissionId = p.id
  );