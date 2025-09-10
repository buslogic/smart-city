-- Update dashboard:read permission to dashboard:view
UPDATE permissions 
SET 
    name = 'dashboard:view',
    action = 'view',
    description = 'View dashboard',
    description_sr = 'Pregled dashboard-a'
WHERE name = 'dashboard:read';