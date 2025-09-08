-- Add GPS sync widget permission
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) 
VALUES 
  ('dashboard.widgets.gps.view', 'dashboard', 'widgets.gps.view', 'View GPS sync widget on dashboard', 'Pregled GPS sync widget-a na dashboard-u', 'Dashboard', NOW(), NOW());