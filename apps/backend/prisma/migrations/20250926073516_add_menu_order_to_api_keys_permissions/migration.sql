-- Add menu_order to API Keys CRUD permissions
-- This moves them from "Ostale Permisije" to proper hierarchy under Settings > API Keys

-- API Keys CRUD permissions - under Settings > API Keys (402000000000)
UPDATE permissions SET menu_order = 402010000001 WHERE name = 'api_keys:create';
UPDATE permissions SET menu_order = 402010000002 WHERE name = 'api_keys:update';
UPDATE permissions SET menu_order = 402010000003 WHERE name = 'api_keys:revoke';
UPDATE permissions SET menu_order = 402010000004 WHERE name = 'api_keys:audit';