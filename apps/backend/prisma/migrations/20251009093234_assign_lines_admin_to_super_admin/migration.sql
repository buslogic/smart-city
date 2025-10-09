-- Assign Lines Administration permissions to SUPER_ADMIN role

INSERT INTO role_permissions (roleId, permissionId)
SELECT 1, id FROM permissions
WHERE resource = 'transport.administration.lines_admin'
ORDER BY menu_order;
