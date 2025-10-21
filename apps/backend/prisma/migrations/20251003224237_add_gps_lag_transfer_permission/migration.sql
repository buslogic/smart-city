-- Add vehicles.gps.lag:view permission for GPS LAG Transfer dashboard
INSERT INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at)
VALUES (
  'vehicles.gps.lag:view',
  'vehicles.gps.lag',
  'view',
  'View GPS LAG Transfer dashboard and monitoring',
  'Pregled GPS LAG Transfer dashboard-a i monitoringa',
  'vehicles',
  NOW(),
  NOW()
);
