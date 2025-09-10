-- Standardize safety permissions to follow the pattern: resource.subresource:action

-- 1. Update safety:view_aggressive_driving to safety.aggressive.driving:view
UPDATE permissions 
SET 
  name = 'safety.aggressive.driving:view',
  resource = 'safety.aggressive.driving',
  action = 'view',
  description = 'Pregled agresivne vožnje'
WHERE name = 'safety:view_aggressive_driving';

-- 2. Update safety:view_monthly_report to safety.reports:view
UPDATE permissions 
SET 
  name = 'safety.reports:view',
  resource = 'safety.reports',
  action = 'view',
  description = 'Pregled mesečnih izveštaja bezbednosti'
WHERE name = 'safety:view_monthly_report';

-- 3. Delete generic safety:manage and replace with specific permissions
-- First save roles that had safety:manage
CREATE TEMPORARY TABLE temp_safety_manage_roles AS
SELECT DISTINCT rp.roleId
FROM role_permissions rp
JOIN permissions p ON rp.permissionId = p.id
WHERE p.name = 'safety:manage';

-- Delete role_permissions for safety:manage
DELETE FROM role_permissions 
WHERE permissionId IN (
  SELECT id FROM permissions WHERE name = 'safety:manage'
);

-- Delete the old permission
DELETE FROM permissions WHERE name = 'safety:manage';

-- Add new granular permissions for aggressive driving
INSERT INTO permissions (name, resource, action, description, created_at, updated_at) VALUES
  ('safety.aggressive.driving:configure', 'safety.aggressive.driving', 'configure', 'Konfiguracija parametara agresivne vožnje', NOW(), NOW()),
  ('safety.aggressive.driving:export', 'safety.aggressive.driving', 'export', 'Eksport podataka agresivne vožnje', NOW(), NOW());

-- Give new permissions to roles that had safety:manage
INSERT INTO role_permissions (roleId, permissionId)
SELECT 
  r.roleId,
  p.id
FROM temp_safety_manage_roles r
CROSS JOIN permissions p
WHERE p.resource = 'safety.aggressive.driving' 
  AND p.action IN ('view', 'configure', 'export');

-- 4. Update safety.data-recreation:manage to safety.data.recreation:manage (add dot)
UPDATE permissions 
SET 
  name = 'safety.data.recreation:manage',
  resource = 'safety.data.recreation'
WHERE name = 'safety.data-recreation:manage';

-- Clean up
DROP TEMPORARY TABLE temp_safety_manage_roles;