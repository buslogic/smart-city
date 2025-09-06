-- Proveri sve dashboard permisije
SELECT id, name, resource, action FROM permissions WHERE name LIKE 'dashboard%' ORDER BY name;