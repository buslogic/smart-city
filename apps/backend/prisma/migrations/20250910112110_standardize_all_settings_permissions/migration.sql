-- Comprehensive standardization of all settings permissions to follow our pattern: resource.subresource:action

-- 1. Update settings.api permissions
UPDATE permissions 
SET 
  name = 'settings.api:view',
  resource = 'settings.api',
  action = 'view',
  description = 'Pregled API podešavanja'
WHERE name = 'settings.api.read';

UPDATE permissions 
SET 
  name = 'settings.api:update',
  resource = 'settings.api',
  action = 'update'
WHERE name = 'settings.api.update';

-- 2. Update settings.general permissions
UPDATE permissions 
SET 
  name = 'settings.general:view',
  resource = 'settings.general',
  action = 'view',
  description = 'Pregled opštih podešavanja'
WHERE name = 'settings.general.read';

UPDATE permissions 
SET 
  name = 'settings.general:update',
  resource = 'settings.general',
  action = 'update'
WHERE name = 'settings.general.update';

-- 3. Replace settings.general.manage with granular permissions
-- First save roles that have settings.general.manage
CREATE TEMPORARY TABLE temp_settings_manage_roles AS
SELECT DISTINCT rp.roleId
FROM role_permissions rp
JOIN permissions p ON rp.permissionId = p.id
WHERE p.name = 'settings.general.manage';

-- Delete role_permissions for the old manage permission
DELETE FROM role_permissions 
WHERE permissionId IN (
  SELECT id FROM permissions WHERE name = 'settings.general.manage'
);

-- Delete the old manage permission
DELETE FROM permissions WHERE name = 'settings.general.manage';

-- Add configure permission for settings.general
INSERT INTO permissions (name, resource, action, description, created_at, updated_at) VALUES
  ('settings.general:configure', 'settings.general', 'configure', 'Konfiguracija opštih podešavanja', NOW(), NOW());

-- Give all general permissions to roles that had manage (skip existing)
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT 
  r.roleId,
  p.id
FROM temp_settings_manage_roles r
CROSS JOIN permissions p
WHERE p.resource = 'settings.general';

-- 4. Update settings.system permissions
UPDATE permissions 
SET 
  name = 'settings.system:view',
  resource = 'settings.system',
  action = 'view',
  description = 'Pregled sistemskih podešavanja'
WHERE name = 'settings.system.read';

UPDATE permissions 
SET 
  name = 'settings.system:update',
  resource = 'settings.system',
  action = 'update'
WHERE name = 'settings.system.update';

-- 5. Update settings.legacy_databases permissions
UPDATE permissions 
SET 
  name = 'settings.legacy.databases:view',
  resource = 'settings.legacy.databases',
  action = 'view'
WHERE name = 'settings.legacy_databases.read';

UPDATE permissions 
SET 
  name = 'settings.legacy.databases:create',
  resource = 'settings.legacy.databases',
  action = 'create'
WHERE name = 'settings.legacy_databases.create';

UPDATE permissions 
SET 
  name = 'settings.legacy.databases:update',
  resource = 'settings.legacy.databases',
  action = 'update'
WHERE name = 'settings.legacy_databases.update';

UPDATE permissions 
SET 
  name = 'settings.legacy.databases:delete',
  resource = 'settings.legacy.databases',
  action = 'delete'
WHERE name = 'settings.legacy_databases.delete';

-- Replace settings.legacy_databases.manage with configure permission
-- Save roles that have manage permission
CREATE TEMPORARY TABLE temp_legacy_db_manage_roles AS
SELECT DISTINCT rp.roleId
FROM role_permissions rp
JOIN permissions p ON rp.permissionId = p.id
WHERE p.name = 'settings.legacy_databases.manage';

-- Delete role_permissions for the old manage permission
DELETE FROM role_permissions 
WHERE permissionId IN (
  SELECT id FROM permissions WHERE name = 'settings.legacy_databases.manage'
);

-- Delete the old manage permission
DELETE FROM permissions WHERE name = 'settings.legacy_databases.manage';

-- Add configure permission
INSERT INTO permissions (name, resource, action, description, created_at, updated_at) VALUES
  ('settings.legacy.databases:configure', 'settings.legacy.databases', 'configure', 'Konfiguracija legacy baza podataka', NOW(), NOW());

-- Give all permissions to roles that had manage (skip existing)
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT 
  r.roleId,
  p.id
FROM temp_legacy_db_manage_roles r
CROSS JOIN permissions p
WHERE p.resource = 'settings.legacy.databases';

-- Clean up temporary tables
DROP TEMPORARY TABLE temp_settings_manage_roles;
DROP TEMPORARY TABLE temp_legacy_db_manage_roles;