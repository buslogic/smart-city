-- Add permissions CRUD permissions
INSERT INTO permissions (name, resource, action, description, created_at, updated_at) VALUES
  ('permissions:create', 'permissions', 'create', 'Kreiranje permisija', NOW(), NOW()),
  ('permissions:view', 'permissions', 'view', 'Pregled permisija', NOW(), NOW()),
  ('permissions:update', 'permissions', 'update', 'Ažuriranje permisija', NOW(), NOW()),
  ('permissions:delete', 'permissions', 'delete', 'Brisanje permisija', NOW(), NOW());