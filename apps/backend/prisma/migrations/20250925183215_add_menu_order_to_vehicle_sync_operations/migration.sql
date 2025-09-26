-- Add menu_order values to vehicle sync operacije for PermissionsTree visibility
-- Ove permisije spadaju pod "Sinhronizacija" (301020000000)

UPDATE permissions
SET menu_order = 301020000001
WHERE name = 'vehicles.sync:start';

UPDATE permissions
SET menu_order = 301020000002
WHERE name = 'vehicles.sync:stop';

UPDATE permissions
SET menu_order = 301020000003
WHERE name = 'vehicles.sync:configure';