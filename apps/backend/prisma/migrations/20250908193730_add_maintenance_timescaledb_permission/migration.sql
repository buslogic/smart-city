-- Add maintenance.timescaledb.view permission
INSERT INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at)
VALUES (
  'maintenance.timescaledb.view',
  'maintenance.timescaledb',
  'view',
  'View TimescaleDB maintenance page',
  'Pregled TimescaleDB stranice za održavanje',
  'maintenance',
  NOW(),
  NOW()
);