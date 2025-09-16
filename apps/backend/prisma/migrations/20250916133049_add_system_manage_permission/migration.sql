-- Add system:manage permission for managing system operations (including migrations)
INSERT INTO permissions (name, resource, action, description, created_at, updated_at)
VALUES (
  'system:manage',
  'system',
  'manage',
  'Upravljanje sistemskim operacijama (uključujući migracije)',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  updated_at = NOW();