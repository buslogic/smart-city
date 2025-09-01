-- Obriši sve postojeće legacy_databases permisije (oba formata)
DELETE FROM role_permissions 
WHERE permissionId IN (
  SELECT id FROM permissions 
  WHERE name LIKE '%legacy_databases%' 
     OR name LIKE '%legacy_database%'
);

DELETE FROM permissions 
WHERE name LIKE '%legacy_databases%' 
   OR name LIKE '%legacy_database%';

-- Dodaj ispravne permisije sa settings. prefiksom
INSERT INTO permissions (name, resource, action, description, created_at, updated_at) VALUES
('settings.legacy_databases.create', 'settings.legacy_databases', 'create', 'Kreiranje konfiguracije legacy baza', NOW(), NOW()),
('settings.legacy_databases.read', 'settings.legacy_databases', 'read', 'Pregled konfiguracija legacy baza', NOW(), NOW()),
('settings.legacy_databases.update', 'settings.legacy_databases', 'update', 'Ažuriranje konfiguracija legacy baza', NOW(), NOW()),
('settings.legacy_databases.delete', 'settings.legacy_databases', 'delete', 'Brisanje konfiguracija legacy baza', NOW(), NOW()),
('settings.legacy_databases.manage', 'settings.legacy_databases', 'manage', 'Upravljanje legacy bazama', NOW(), NOW());

-- Dodeli sve legacy_databases permisije SUPER_ADMIN roli
INSERT INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN'
  AND p.name LIKE 'settings.legacy_databases%'
ON DUPLICATE KEY UPDATE granted_at = NOW();

-- Dodeli read permisiju CITY_MANAGER roli
INSERT INTO role_permissions (roleId, permissionId, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'CITY_MANAGER'
  AND p.name = 'settings.legacy_databases.read'
ON DUPLICATE KEY UPDATE granted_at = NOW();