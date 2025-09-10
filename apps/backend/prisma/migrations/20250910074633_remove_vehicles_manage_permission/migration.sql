-- Remove vehicles:manage permission
DELETE FROM role_permissions WHERE permissionId IN (
  SELECT id FROM permissions WHERE name = 'vehicles:manage'
);

DELETE FROM permissions WHERE name = 'vehicles:manage';