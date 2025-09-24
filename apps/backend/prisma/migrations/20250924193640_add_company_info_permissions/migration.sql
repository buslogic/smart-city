-- Add company info permissions
INSERT INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at)
VALUES
  ('settings.company_info:read', 'settings.company_info', 'read', 'View company information', 'Pregled informacija o kompaniji', 'Settings', NOW(), NOW()),
  ('settings.company_info:write', 'settings.company_info', 'write', 'Edit company information', 'Izmena informacija o kompaniji', 'Settings', NOW(), NOW());