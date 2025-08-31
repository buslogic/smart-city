-- Proveri da li postoji dispatcher:view_analytics permisija
SELECT * FROM Permission WHERE name = 'dispatcher:view_analytics';

-- Proveri koje permisije ima SUPER_ADMIN rola
SELECT r.name as role_name, p.name as permission_name
FROM Role r
JOIN RolePermission rp ON r.id = rp.roleId
JOIN Permission p ON rp.permissionId = p.id
WHERE r.name = 'SUPER_ADMIN' AND p.name LIKE 'dispatcher%'
ORDER BY p.name;

-- Proveri sve dispatcher permisije
SELECT * FROM Permission WHERE name LIKE 'dispatcher%';
