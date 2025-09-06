-- Dashboard Permissions Migration for Production
-- This migration adds all Dashboard-related permissions and assigns them to roles

-- Insert Dashboard permissions
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) VALUES
-- Basic dashboard permissions
('dashboard.view', 'dashboard', 'view', 'View Dashboard page', 'Pregled Dashboard stranice', 'Dashboard', NOW(), NOW()),
('dashboard.update', 'dashboard', 'update', 'Update Dashboard configuration', 'Izmena Dashboard konfiguracije', 'Dashboard', NOW(), NOW()),

-- Dashboard widget permissions
('dashboard.widgets.vehicles.view', 'dashboard.widgets.vehicles', 'view', 'View Vehicle Statistics widget', 'Pregled Vehicle Statistics widget-a', 'Dashboard', NOW(), NOW()),
('dashboard.widgets.gps.view', 'dashboard.widgets.gps', 'view', 'View GPS Sync Status widget', 'Pregled GPS Sync Status widget-a', 'Dashboard', NOW(), NOW()),
('dashboard.widgets.users.view', 'dashboard.widgets.users', 'view', 'View User Statistics widget', 'Pregled User Statistics widget-a', 'Dashboard', NOW(), NOW()),
('dashboard.widgets.system.view', 'dashboard.widgets.system', 'view', 'View System Health widget', 'Pregled System Health widget-a', 'Dashboard', NOW(), NOW());

-- Assign all Dashboard permissions to SUPER_ADMIN role
INSERT IGNORE INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN' 
  AND p.name IN (
    'dashboard.view', 
    'dashboard.update', 
    'dashboard.widgets.vehicles.view',
    'dashboard.widgets.gps.view',
    'dashboard.widgets.users.view',
    'dashboard.widgets.system.view'
  );

-- Assign Dashboard view and vehicle widget to CITY_MANAGER role
INSERT IGNORE INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'CITY_MANAGER' 
  AND p.name IN (
    'dashboard.view', 
    'dashboard.widgets.vehicles.view',
    'dashboard.widgets.gps.view'
  );

-- Assign Dashboard view and relevant widgets to DEPARTMENT_HEAD role
INSERT IGNORE INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'DEPARTMENT_HEAD' 
  AND p.name IN (
    'dashboard.view', 
    'dashboard.widgets.vehicles.view'
  );

-- Assign Dashboard view to OPERATOR role
INSERT IGNORE INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'OPERATOR'
  AND p.name IN (
    'dashboard.view', 
    'dashboard.widgets.vehicles.view'
  );

-- Assign Dashboard view to ANALYST role
INSERT IGNORE INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ANALYST'
  AND p.name IN (
    'dashboard.view', 
    'dashboard.widgets.vehicles.view',
    'dashboard.widgets.system.view'
  );