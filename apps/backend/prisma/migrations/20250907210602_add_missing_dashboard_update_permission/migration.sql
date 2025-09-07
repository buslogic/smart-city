-- Add missing dashboard.update permission
-- This permission was lost during previous migration conflicts
-- Only adding to permissions table, administrators will assign to roles as needed

INSERT INTO permissions (
  name, 
  resource, 
  action, 
  description, 
  description_sr, 
  category, 
  created_at, 
  updated_at
) 
SELECT 
  'dashboard.update' AS name,
  'dashboard' AS resource,
  'update' AS action,
  'Update Dashboard configuration' AS description,
  'Izmena Dashboard konfiguracije' AS description_sr,
  'Dashboard' AS category,
  NOW() AS created_at,
  NOW() AS updated_at
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE name = 'dashboard.update'
);