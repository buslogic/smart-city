-- Add menu_order values to vehicles CRUD permisije for PermissionsTree visibility
-- Ove permisije spadaju pod "Lista Vozila" (301010000000)

UPDATE permissions
SET menu_order = 301010000001
WHERE name = 'vehicles:create';

UPDATE permissions
SET menu_order = 301010000002
WHERE name = 'vehicles:update';

UPDATE permissions
SET menu_order = 301010000003
WHERE name = 'vehicles:delete';