-- Dodavanje nove permisije za GPS Sync Dashboard
INSERT INTO permissions (name, resource, action, description, created_at, updated_at)
VALUES (
  'dispatcher:view_sync_dashboard', 
  'dispatcher', 
  'view_sync_dashboard', 
  'Pregled GPS sinhronizacija dashboard-a',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE 
  description = VALUES(description),
  updated_at = NOW();

-- Dohvati ID nove permisije
SET @permission_id = (SELECT id FROM permissions WHERE name = 'dispatcher:view_sync_dashboard' LIMIT 1);

-- Dodeli permisiju SUPER_ADMIN roli
SET @super_admin_role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1);
INSERT IGNORE INTO role_permissions (roleId, permissionId, granted_at)
SELECT @super_admin_role_id, @permission_id, NOW()
WHERE @super_admin_role_id IS NOT NULL AND @permission_id IS NOT NULL;

-- Dodeli permisiju CITY_MANAGER roli
SET @city_manager_role_id = (SELECT id FROM roles WHERE name = 'CITY_MANAGER' LIMIT 1);
INSERT IGNORE INTO role_permissions (roleId, permissionId, granted_at)
SELECT @city_manager_role_id, @permission_id, NOW()
WHERE @city_manager_role_id IS NOT NULL AND @permission_id IS NOT NULL;

-- Dodeli permisiju DEPARTMENT_HEAD roli
SET @department_head_role_id = (SELECT id FROM roles WHERE name = 'DEPARTMENT_HEAD' LIMIT 1);
INSERT IGNORE INTO role_permissions (roleId, permissionId, granted_at)
SELECT @department_head_role_id, @permission_id, NOW()
WHERE @department_head_role_id IS NOT NULL AND @permission_id IS NOT NULL;

-- Dodeli permisiju OPERATOR roli
SET @operator_role_id = (SELECT id FROM roles WHERE name = 'OPERATOR' LIMIT 1);
INSERT IGNORE INTO role_permissions (roleId, permissionId, granted_at)
SELECT @operator_role_id, @permission_id, NOW()
WHERE @operator_role_id IS NOT NULL AND @permission_id IS NOT NULL;