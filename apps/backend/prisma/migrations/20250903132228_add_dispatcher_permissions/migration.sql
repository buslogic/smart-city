-- Add dispatcher permissions
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) 
VALUES 
  ('dispatcher.manage_cron', 'dispatcher', 'manage_cron', 'Manage cron processes', 'Upravljanje cron procesima', 'dispatcher', NOW(), NOW()),
  ('dispatcher.view_dashboard', 'dispatcher', 'view_dashboard', 'View dispatcher dashboard', 'Pregled dispečerskog dashboard-a', 'dispatcher', NOW(), NOW()),
  ('dispatcher.manage_gps', 'dispatcher', 'manage_gps', 'Manage GPS system', 'Upravljanje GPS sistemom', 'dispatcher', NOW(), NOW());