-- AddUserGroupsPermission: Add User Groups submenu under Users

-- Insert main permission for User Groups
-- MenuOrder: 203000000000 (200 = Users module, 03 = third submenu after Administration and Roles)
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, menu_order, ui_route, category, created_at, updated_at)
VALUES
  (
    'users.groups:view',
    'users.groups',
    'view',
    'View User Groups',
    'Pregled Grupa Korisnika',
    203000000000,
    '/users/groups',
    'users',
    NOW(),
    NOW()
  );