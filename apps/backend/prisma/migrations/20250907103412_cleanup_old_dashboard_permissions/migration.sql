-- Cleanup old Dashboard permissions with colon separator
-- These permissions were replaced with dot notation in migration 20250906204321

-- First, remove role_permissions associations for old permissions
DELETE rp FROM role_permissions rp
INNER JOIN permissions p ON rp.permissionId = p.id
WHERE p.name IN (
  'dashboard:read',
  'dashboard:update',
  'dashboard:widgets:vehicles:view'
);

-- Then, delete the old permissions themselves
DELETE FROM permissions 
WHERE name IN (
  'dashboard:read',
  'dashboard:update',
  'dashboard:widgets:vehicles:view'
);

-- Log cleanup action
SELECT CONCAT('Removed ', ROW_COUNT(), ' old dashboard permissions with colon separator') AS cleanup_result;