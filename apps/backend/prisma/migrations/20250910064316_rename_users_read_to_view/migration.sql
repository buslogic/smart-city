-- Rename users:read permission to users:view for standardization
UPDATE permissions 
SET 
    name = 'users:view',
    action = 'view',
    description = 'Pregled korisnika'
WHERE name = 'users:read';