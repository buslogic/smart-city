-- Remove unused safety permissions that are not implemented in the code
-- These permissions exist in database but have no corresponding backend controllers

-- First, remove these permissions from any roles that might have them
DELETE FROM role_permissions
WHERE permissionId IN (
  SELECT id FROM permissions
  WHERE name IN (
    'safety.aggressive.driving:configure',
    'safety.aggressive.driving:export',
    'safety.reports:configure',
    'safety.reports:create',
    'safety.reports:export'
  )
);

-- Then, delete the permissions themselves
DELETE FROM permissions
WHERE name IN (
  'safety.aggressive.driving:configure',
  'safety.aggressive.driving:export',
  'safety.reports:configure',
  'safety.reports:create',
  'safety.reports:export'
);