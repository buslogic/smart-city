-- AddAdministrationMenuPermissionFixed: Add missing permission for Administration submenu

-- Insert permission for Administration submenu with proper menuOrder
INSERT IGNORE INTO permissions (name, resource, action, description, menu_order, created_at, updated_at)
VALUES
  ('users.administration:view', 'users.administration', 'view', 'Access User Administration submenu', 201000000000, NOW(), NOW());

-- Grant this permission to SUPER_ADMIN role (ID: 1)
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT 1, id FROM permissions WHERE name = 'users.administration:view';