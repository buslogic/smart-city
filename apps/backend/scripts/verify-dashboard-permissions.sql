-- Proveri dashboard permisije
SELECT id, name, resource, action FROM permissions WHERE name LIKE 'dashboard.%';

-- Proveri da li SUPER_ADMIN ima dashboard permisije
SELECT 
    r.name as role_name,
    p.name as permission_name,
    p.resource,
    p.action
FROM role_permissions rp
JOIN roles r ON r.id = rp.roleId
JOIN permissions p ON p.id = rp.permissionId
WHERE r.name = 'SUPER_ADMIN' AND p.name LIKE 'dashboard.%'
ORDER BY p.name;