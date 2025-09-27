-- Add menu_order to users.groups CRUD permissions
-- Using pattern: 203XXYY000000 where XX is for operation order

UPDATE permissions
SET menu_order = 203010000000
WHERE name = 'users.groups:view';

UPDATE permissions
SET menu_order = 203020000000
WHERE name = 'users.groups:create';

UPDATE permissions
SET menu_order = 203030000000
WHERE name = 'users.groups:edit';

UPDATE permissions
SET menu_order = 203040000000
WHERE name = 'users.groups:delete';