-- Rename users permissions from dot to colon format
UPDATE permissions SET name = 'users:create' WHERE name = 'users.create';
UPDATE permissions SET name = 'users:read' WHERE name = 'users.read';
UPDATE permissions SET name = 'users:update' WHERE name = 'users.update';
UPDATE permissions SET name = 'users:delete' WHERE name = 'users.delete';