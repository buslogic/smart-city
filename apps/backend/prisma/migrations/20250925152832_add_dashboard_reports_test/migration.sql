-- AddDashboardReportsTest: Add test Reports permission under Dashboard to verify automatic hierarchy

-- Insert Reports permission under Dashboard with menuOrder 101000000000
INSERT IGNORE INTO permissions (name, resource, action, description, menu_order, created_at, updated_at)
VALUES
  ('dashboard.reports:view', 'dashboard.reports', 'view', 'Access Dashboard Reports submenu', 101000000000, NOW(), NOW());

-- Grant this permission to SUPER_ADMIN role (ID: 1)
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT 1, id FROM permissions WHERE name = 'dashboard.reports:view';