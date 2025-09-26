-- Remove unused dispatcher permissions that are not implemented in the code
-- These permissions exist in the database but have no corresponding backend controllers or frontend usage

-- First, remove these permissions from any roles that might have them
DELETE FROM role_permissions
WHERE permissionId IN (
  SELECT id FROM permissions
  WHERE name IN (
    'dispatcher:emergency_actions',
    'dispatcher:manage',
    'dispatcher:manage_routes',
    'dispatcher:send_commands',
    'dispatcher:track_vehicles'
  )
);

-- Then, delete the permissions themselves
DELETE FROM permissions
WHERE name IN (
  'dispatcher:emergency_actions',
  'dispatcher:manage',
  'dispatcher:manage_routes',
  'dispatcher:send_commands',
  'dispatcher:track_vehicles'
);