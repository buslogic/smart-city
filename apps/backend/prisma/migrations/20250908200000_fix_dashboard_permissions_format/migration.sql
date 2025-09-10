-- Promeni dashboard permisije sa tačke na dvotačku pre akcije

-- dashboard.view -> dashboard:view (ali akcija je 'read', ne 'view')
UPDATE permissions 
SET name = 'dashboard:read'
WHERE name = 'dashboard.view';

-- dashboard.update -> dashboard:update
UPDATE permissions 
SET name = 'dashboard:update'
WHERE name = 'dashboard.update';

-- Dashboard widget permisije
UPDATE permissions 
SET name = 'dashboard.widgets.vehicles:view'
WHERE name = 'dashboard.widgets.vehicles.view';

UPDATE permissions 
SET name = 'dashboard.widgets.gps:view'
WHERE name = 'dashboard.widgets.gps.view';

UPDATE permissions 
SET name = 'dashboard.widgets.users:view'
WHERE name = 'dashboard.widgets.users.view';

UPDATE permissions 
SET name = 'dashboard.widgets.system:view'
WHERE name = 'dashboard.widgets.system.view';