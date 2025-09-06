-- Insert Dashboard permissions
INSERT INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) VALUES
('dashboard:read', 'dashboard', 'read', 'View Dashboard page', 'Pregled Dashboard stranice', 'Dashboard', NOW(), NOW()),
('dashboard:update', 'dashboard', 'update', 'Update Dashboard configuration', 'Izmena Dashboard konfiguracije', 'Dashboard', NOW(), NOW()),
('dashboard:widgets:vehicles:view', 'dashboard:widgets:vehicles', 'view', 'View Vehicle Statistics widget', 'Pregled Vehicle Statistics widget-a', 'Dashboard', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  description = VALUES(description),
  description_sr = VALUES(description_sr),
  updated_at = NOW();

-- Assign Dashboard permissions to SUPER_ADMIN role
INSERT INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN' 
  AND p.name IN ('dashboard:read', 'dashboard:update', 'dashboard:widgets:vehicles:view')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.roleId = r.id AND rp.permissionId = p.id
  );

-- Assign Dashboard read permission to CITY_MANAGER role
INSERT INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'CITY_MANAGER' 
  AND p.name IN ('dashboard:read', 'dashboard:widgets:vehicles:view')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.roleId = r.id AND rp.permissionId = p.id
  );

-- Assign Dashboard read permission to DEPARTMENT_HEAD role
INSERT INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'DEPARTMENT_HEAD' 
  AND p.name IN ('dashboard:read', 'dashboard:widgets:vehicles:view')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.roleId = r.id AND rp.permissionId = p.id
  );

-- Assign Dashboard read permission to OPERATOR role  
INSERT INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'OPERATOR'
  AND p.name IN ('dashboard:read', 'dashboard:widgets:vehicles:view')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.roleId = r.id AND rp.permissionId = p.id
  );

-- Assign Dashboard read permission to ANALYST role
INSERT INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ANALYST'
  AND p.name IN ('dashboard:read', 'dashboard:widgets:vehicles:view')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.roleId = r.id AND rp.permissionId = p.id
  );