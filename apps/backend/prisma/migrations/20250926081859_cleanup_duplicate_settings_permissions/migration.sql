-- Clean up duplicate and incorrect settings permissions
-- Live server has old permissions with colon (:) format and missing menu_order
-- Local has correct permissions with dot (.) format and proper menu_order

-- Remove old duplicate settings permissions from any roles first
DELETE FROM role_permissions
WHERE permissionId IN (
  SELECT id FROM permissions
  WHERE name IN (
    -- Old API settings permissions (wrong format with colon)
    'settings.api:update',
    'settings.api:view',

    -- Old general settings permissions (wrong format)
    'settings.general:update',

    -- Old legacy databases permissions (wrong format)
    'settings.legacy.databases:create',
    'settings.legacy.databases:delete',
    'settings.legacy.databases:update',
    'settings.legacy.databases:view',

    -- Old system settings permissions (wrong format)
    'settings.system:update',
    'settings.system:view'
  )
);

-- Delete the old duplicate settings permissions
DELETE FROM permissions
WHERE name IN (
  -- Old API settings permissions (wrong format with colon)
  'settings.api:update',
  'settings.api:view',

  -- Old general settings permissions (wrong format)
  'settings.general:update',

  -- Old legacy databases permissions (wrong format)
  'settings.legacy.databases:create',
  'settings.legacy.databases:delete',
  'settings.legacy.databases:update',
  'settings.legacy.databases:view',

  -- Old system settings permissions (wrong format)
  'settings.system:update',
  'settings.system:view'
);

-- Note: The correct permissions with proper naming and menu_order already exist:
-- settings.api.read, settings.api.update (with menu_order 401050000001, 401050000002)
-- settings.general.read, settings.general.update (with menu_order 401000000001, 401000000002)
-- settings.system.read, settings.system.update (with menu_order 401060000001, 401060000002)
-- settings.legacy.databases:configure (with menu_order 401020000006)