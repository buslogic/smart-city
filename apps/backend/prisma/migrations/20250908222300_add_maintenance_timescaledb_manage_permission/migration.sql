-- Add maintenance.timescaledb:manage permission
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at)
VALUES (
  'maintenance.timescaledb:manage',
  'maintenance.timescaledb',
  'manage',
  'Manage TimescaleDB maintenance operations',
  'Upravljanje TimescaleDB operacijama održavanja',
  'maintenance',
  NOW(),
  NOW()
);