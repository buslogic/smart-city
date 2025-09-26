-- Add menu_order values to users CRUD permissions for PermissionsTree visibility

-- Set menu_order for users:create (Kreiranje korisnika)
UPDATE permissions
SET menu_order = 201010000000
WHERE name = 'users:create';

-- Set menu_order for users:update (Ažuriranje korisnika)
UPDATE permissions
SET menu_order = 201020000000
WHERE name = 'users:update';

-- Set menu_order for users:delete (Brisanje korisnika)
UPDATE permissions
SET menu_order = 201030000000
WHERE name = 'users:delete';