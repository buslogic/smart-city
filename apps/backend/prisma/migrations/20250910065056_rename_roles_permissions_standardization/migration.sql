-- Rename roles permissions from dot to colon format and read to view
UPDATE permissions SET name = 'roles:create' WHERE name = 'roles.create';
UPDATE permissions SET name = 'roles:view', action = 'view' WHERE name = 'roles.read';
UPDATE permissions SET name = 'roles:update' WHERE name = 'roles.update';
UPDATE permissions SET name = 'roles:delete' WHERE name = 'roles.delete';
UPDATE permissions SET name = 'roles:manage' WHERE name = 'roles.manage';