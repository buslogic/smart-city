-- Proveri da li vehicles:sync permisija postoji
SELECT * FROM Permission WHERE resource = 'vehicles' AND action = 'sync';

-- Lista sve vehicles permisije
SELECT * FROM Permission WHERE resource = 'vehicles';

-- Proveri koje role imaju bilo kakve vehicles permisije
SELECT r.name as role_name, p.resource, p.action, p.description
FROM Role r
JOIN RolePermission rp ON r.id = rp.roleId
JOIN Permission p ON p.id = rp.permissionId
WHERE p.resource = 'vehicles'
ORDER BY r.name, p.action;