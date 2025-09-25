-- CleanupUnnecessaryPermissions: Delete reports and duplicate permissions

-- Delete role permission assignments first
DELETE FROM role_permissions WHERE permissionId IN (
  SELECT id FROM permissions WHERE name IN (
    'reports.create',
    'reports.read',
    'reports.export',
    'dispatcher:read',
    'dispatcher:view_sync_dashboard',
    'dispatcher.view_dashboard',
    'dispatcher.sync:dashboard',
    'settings.general.manage'
  )
);

-- Delete the unnecessary permissions
DELETE FROM permissions WHERE name IN (
  'reports.create',
  'reports.read',
  'reports.export',
  'dispatcher:read',
  'dispatcher:view_sync_dashboard',
  'dispatcher.view_dashboard',
  'dispatcher.sync:dashboard',
  'settings.general.manage'
);