-- Update existing legacy permissions to match new naming convention and add menuOrder
-- This fixes the Settings > Opšta folder structure

-- 1. Update legacy_databases.read to legacy_databases:read with menuOrder
UPDATE permissions
SET
  name = 'legacy_databases:read',
  menu_order = 401020000001,
  description = 'View legacy databases',
  description_sr = 'Pregled legacy baza podataka',
  category = 'settings',
  updated_at = NOW()
WHERE name = 'legacy_databases.read' AND resource = 'legacy_databases' AND action = 'read';

-- 2. Update legacy_tables.read to legacy_tables:read with menuOrder
UPDATE permissions
SET
  name = 'legacy_tables:read',
  menu_order = 401030000001,
  description = 'View legacy table mappings',
  description_sr = 'Pregled legacy tabela mapiranja',
  category = 'settings',
  updated_at = NOW()
WHERE name = 'legacy_tables.read' AND resource = 'legacy_tables' AND action = 'read';

-- 3. Ensure SUPER_ADMIN role (roleId = 1) has these permissions
-- Use INSERT IGNORE to avoid duplicates
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT 1, id FROM permissions WHERE name IN (
  'legacy_databases:read',
  'legacy_tables:read'
);
