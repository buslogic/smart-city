-- Add Tiketing Server Sync permission for Central Points

INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.ticketing:sync',
  'transport.administration.central_points.ticketing',
  'sync',
  'Ticketing Server - Sync',
  'Tiketing Server - Sinhronizacija',
  'transport',
  301510100004,
  NOW()
);
