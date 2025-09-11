-- Add API Keys permissions with correct column names

-- Insert API Keys permissions
INSERT INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) 
VALUES 
  ('api_keys:view', 'api_keys', 'view', 'View API Keys', 'Pregled API ključeva', 'API Keys', NOW(), NOW()),
  ('api_keys:create', 'api_keys', 'create', 'Create API Keys', 'Kreiranje API ključeva', 'API Keys', NOW(), NOW()),
  ('api_keys:update', 'api_keys', 'update', 'Update API Keys', 'Izmena API ključeva', 'API Keys', NOW(), NOW()),
  ('api_keys:revoke', 'api_keys', 'revoke', 'Revoke API Keys', 'Opoziv API ključeva', 'API Keys', NOW(), NOW()),
  ('api_keys:audit', 'api_keys', 'audit', 'View API Keys Audit Log', 'Pregled audit log-a API ključeva', 'API Keys', NOW(), NOW());