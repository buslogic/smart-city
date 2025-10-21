-- Remove redundant parent-level permissions for Turnusi module
-- Keep only :view permission at parent level (consistent with other admin menu items)

DELETE FROM permissions
WHERE name IN (
  'transport.administration.turnusi:read',
  'transport.administration.turnusi:sync',
  'transport.administration.turnusi:delete'
);
