-- Replace safety.data.recreation:manage with granular permissions following our standard

-- Save roles that currently have safety.data.recreation:manage permission
CREATE TEMPORARY TABLE temp_data_recreation_roles (
  roleId INT PRIMARY KEY
);

INSERT INTO temp_data_recreation_roles
SELECT DISTINCT rp.roleId
FROM role_permissions rp
JOIN permissions p ON rp.permissionId = p.id
WHERE p.name = 'safety.data.recreation:manage';

-- Delete role_permissions for the old manage permission
DELETE FROM role_permissions 
WHERE permissionId IN (
  SELECT id FROM permissions WHERE name = 'safety.data.recreation:manage'
);

-- Delete the old permission
DELETE FROM permissions WHERE name = 'safety.data.recreation:manage';

-- Add new granular permissions for safety.data.recreation
INSERT INTO permissions (name, resource, action, description, created_at, updated_at) VALUES
  ('safety.data.recreation:view', 'safety.data.recreation', 'view', 'Pregled statistika i istorije rekreacije podataka', NOW(), NOW()),
  ('safety.data.recreation:start', 'safety.data.recreation', 'start', 'Pokretanje rekreacije podataka', NOW(), NOW()),
  ('safety.data.recreation:stop', 'safety.data.recreation', 'stop', 'Zaustavljanje rekreacije podataka', NOW(), NOW()),
  ('safety.data.recreation:configure', 'safety.data.recreation', 'configure', 'Konfiguracija i preview parametara rekreacije', NOW(), NOW());

-- Give new permissions to roles that had the old manage permission
INSERT INTO role_permissions (roleId, permissionId)
SELECT 
  r.roleId,
  p.id
FROM temp_data_recreation_roles r
CROSS JOIN permissions p
WHERE p.resource = 'safety.data.recreation' 
  AND p.action IN ('view', 'start', 'stop', 'configure');

-- Clean up
DROP TEMPORARY TABLE temp_data_recreation_roles;