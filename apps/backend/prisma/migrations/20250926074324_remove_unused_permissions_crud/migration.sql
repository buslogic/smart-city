-- Remove unused permissions CRUD operations
-- These permissions are defined but have no backend controller implementations

-- First, remove these permissions from any roles that might have them
DELETE FROM role_permissions
WHERE permissionId IN (
  SELECT id FROM permissions
  WHERE name IN ('permissions:create', 'permissions:delete')
);

-- Then, delete the permissions themselves
DELETE FROM permissions
WHERE name IN ('permissions:create', 'permissions:delete');