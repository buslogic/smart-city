-- Proveri da li dashboard permisije postoje
SELECT id, name, resource, action FROM permissions WHERE name LIKE 'dashboard:%';

-- Proveri koje role imaju dashboard permisije
SELECT 
    r.name as role_name,
    p.name as permission_name
FROM role_permissions rp
JOIN roles r ON r.id = rp.roleId
JOIN permissions p ON p.id = rp.permissionId
WHERE p.name LIKE 'dashboard:%'
ORDER BY r.name, p.name;