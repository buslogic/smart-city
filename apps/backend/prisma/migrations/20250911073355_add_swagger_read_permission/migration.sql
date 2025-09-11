-- Swagger read permisija za API Keys sistem

-- Dodavanje swagger:read permisije
INSERT INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) 
VALUES 
  ('swagger:read', 'swagger', 'read', 'Swagger Documentation Access', 'Pristup Swagger dokumentaciji', 'Documentation', NOW(), NOW());