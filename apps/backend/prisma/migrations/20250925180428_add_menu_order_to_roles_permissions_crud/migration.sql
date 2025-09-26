-- Add menu_order values to roles and permissions CRUD permisije for PermissionsTree visibility

-- Roles CRUD permisije (Role i Permisije → Upravljanje Rolama)
UPDATE permissions
SET menu_order = 202010000000
WHERE name = 'roles:create';

UPDATE permissions
SET menu_order = 202020000000
WHERE name = 'roles:update';

UPDATE permissions
SET menu_order = 202030000000
WHERE name = 'roles:delete';

-- Permissions CRUD permisije (Role i Permisije → Upravljanje Permisijama)
UPDATE permissions
SET menu_order = 202040000000
WHERE name = 'permissions:view';

UPDATE permissions
SET menu_order = 202050000000
WHERE name = 'permissions:update';