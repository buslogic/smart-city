-- Reorganize Settings > General permissions structure
-- Add missing permissions for Legacy Databases and Legacy Tables tabs

-- 1. Legacy Databases - VIEW permisija (folder/group access)
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'legacy_databases:read',
  'legacy_databases',
  'read',
  'View legacy databases',
  'Pregled legacy baza podataka',
  'settings',
  401020000000,
  NOW()
);

-- 2. Legacy Databases - WRITE permisija (CRUD operations)
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'legacy_databases:write',
  'legacy_databases',
  'write',
  'Manage legacy databases',
  'Upravljanje legacy bazama podataka',
  'settings',
  401020000001,
  NOW()
);

-- 3. Legacy Tables - READ permisija (folder/group access)
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'legacy_tables:read',
  'legacy_tables',
  'read',
  'View legacy table mappings',
  'Pregled legacy tabela mapiranja',
  'settings',
  401030000000,
  NOW()
);

-- 4. Legacy Tables - WRITE permisija (CRUD operations)
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'legacy_tables:write',
  'legacy_tables',
  'write',
  'Manage legacy table mappings',
  'Upravljanje legacy tabelama mapiranja',
  'settings',
  401030000001,
  NOW()
);

-- 5. Dodeli nove permisije SUPER_ADMIN roli (roleId = 1) - koristi INSERT IGNORE
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT 1, id FROM permissions WHERE name IN (
  'legacy_databases:read',
  'legacy_databases:write',
  'legacy_tables:read',
  'legacy_tables:write'
);
