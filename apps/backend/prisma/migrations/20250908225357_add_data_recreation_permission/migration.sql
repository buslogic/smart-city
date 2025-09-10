-- Add safety.data-recreation:manage permission
INSERT INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at)
VALUES (
  'safety.data-recreation:manage',
  'safety.data-recreation',
  'manage',
  'Manage driving events data recreation',
  'Upravljanje rekreacijom podataka o vožnji',
  'safety',
  NOW(),
  NOW()
);