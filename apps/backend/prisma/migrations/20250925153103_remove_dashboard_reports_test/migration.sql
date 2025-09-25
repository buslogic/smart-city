-- RemoveDashboardReportsTest: Clean up test Reports permission

-- Remove role permission assignment first
DELETE FROM role_permissions WHERE permissionId = (SELECT id FROM permissions WHERE name = 'dashboard.reports:view');

-- Remove the test permission
DELETE FROM permissions WHERE name = 'dashboard.reports:view';