-- Add missing safety.reports permissions for complete functionality

-- Save roles that currently have safety.reports:view permission
CREATE TEMPORARY TABLE temp_safety_reports_roles AS
SELECT DISTINCT rp.roleId
FROM role_permissions rp
JOIN permissions p ON rp.permissionId = p.id
WHERE p.name = 'safety.reports:view';

-- Add missing permissions for safety.reports
INSERT INTO permissions (name, resource, action, description, created_at, updated_at) VALUES
  ('safety.reports:create', 'safety.reports', 'create', 'Kreiranje bezbednosnih izveštaja', NOW(), NOW()),
  ('safety.reports:export', 'safety.reports', 'export', 'Eksport bezbednosnih izveštaja u PDF', NOW(), NOW()),
  ('safety.reports:configure', 'safety.reports', 'configure', 'Konfiguracija parametara izveštaja', NOW(), NOW());

-- Give new permissions to roles that already have view permission
-- (assuming they should have full access to reports functionality)
INSERT INTO role_permissions (roleId, permissionId)
SELECT 
  r.roleId,
  p.id
FROM temp_safety_reports_roles r
CROSS JOIN permissions p
WHERE p.resource = 'safety.reports' 
  AND p.action IN ('create', 'export', 'configure');

-- Clean up
DROP TEMPORARY TABLE temp_safety_reports_roles;