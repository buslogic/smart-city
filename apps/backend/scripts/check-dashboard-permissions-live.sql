-- Proveri sve dashboard permisije
SELECT id, name, resource, action, description, description_sr 
FROM permissions 
WHERE name LIKE 'dashboard%' 
ORDER BY name;