-- Fix legacy permissions naming to match backend controllers
-- Use dot notation (.read, .create, .update, .delete) as used in @RequirePermissions decorators

-- 1. Revert legacy_databases:read back to legacy_databases.read (keep menuOrder)
UPDATE permissions
SET
  name = 'legacy_databases.read',
  updated_at = NOW()
WHERE name = 'legacy_databases:read' AND resource = 'legacy_databases' AND action = 'read';

-- 2. Revert legacy_tables:read back to legacy_tables.read (keep menuOrder)
UPDATE permissions
SET
  name = 'legacy_tables.read',
  updated_at = NOW()
WHERE name = 'legacy_tables:read' AND resource = 'legacy_tables' AND action = 'read';

-- 3. Add menuOrder to legacy_databases.create
UPDATE permissions
SET
  menu_order = 401020000002,
  category = 'settings',
  updated_at = NOW()
WHERE name = 'legacy_databases.create' AND resource = 'legacy_databases' AND action = 'create';

-- 4. Add menuOrder to legacy_databases.update
UPDATE permissions
SET
  menu_order = 401020000003,
  category = 'settings',
  updated_at = NOW()
WHERE name = 'legacy_databases.update' AND resource = 'legacy_databases' AND action = 'update';

-- 5. Add menuOrder to legacy_databases.delete
UPDATE permissions
SET
  menu_order = 401020000004,
  category = 'settings',
  updated_at = NOW()
WHERE name = 'legacy_databases.delete' AND resource = 'legacy_databases' AND action = 'delete';

-- 6. Add menuOrder to legacy_tables.create
UPDATE permissions
SET
  menu_order = 401030000002,
  category = 'settings',
  updated_at = NOW()
WHERE name = 'legacy_tables.create' AND resource = 'legacy_tables' AND action = 'create';

-- 7. Add menuOrder to legacy_tables.update
UPDATE permissions
SET
  menu_order = 401030000003,
  category = 'settings',
  updated_at = NOW()
WHERE name = 'legacy_tables.update' AND resource = 'legacy_tables' AND action = 'update';

-- 8. Add menuOrder to legacy_tables.delete
UPDATE permissions
SET
  menu_order = 401030000004,
  category = 'settings',
  updated_at = NOW()
WHERE name = 'legacy_tables.delete' AND resource = 'legacy_tables' AND action = 'delete';

-- 9. Delete unused :write permissions
DELETE FROM role_permissions
WHERE permissionId IN (
  SELECT id FROM permissions WHERE name IN ('legacy_databases:write', 'legacy_tables:write')
);

DELETE FROM permissions
WHERE name IN ('legacy_databases:write', 'legacy_tables:write');

-- 10. Ensure SUPER_ADMIN role has all legacy permissions
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT 1, id FROM permissions WHERE name IN (
  'legacy_databases.read',
  'legacy_databases.create',
  'legacy_databases.update',
  'legacy_databases.delete',
  'legacy_tables.read',
  'legacy_tables.create',
  'legacy_tables.update',
  'legacy_tables.delete'
);
