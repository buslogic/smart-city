-- Fix missing legacy sync permissions
-- Ova migracija dodaje permisije koje nisu bile dodate zbog INSERT IGNORE

-- Dodaj permisije sa novim formatom (legacy.sync:action)
-- Koristimo INSERT IGNORE da izbegnemo duplikate ako već postoje
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) 
VALUES 
  ('legacy.sync:view', 'legacy.sync', 'view', 'View Legacy GPS Sync', 'Pregled Legacy GPS sinhronizacije', 'dispatcher', NOW(), NOW()),
  ('legacy.sync:configure', 'legacy.sync', 'configure', 'Configure Legacy GPS Sync', 'Konfiguracija Legacy GPS sinhronizacije', 'dispatcher', NOW(), NOW()),
  ('legacy.sync:start', 'legacy.sync', 'start', 'Start Legacy GPS Sync', 'Pokretanje Legacy GPS sinhronizacije', 'dispatcher', NOW(), NOW()),
  ('legacy.sync:stop', 'legacy.sync', 'stop', 'Stop Legacy GPS Sync', 'Zaustavljanje Legacy GPS sinhronizacije', 'dispatcher', NOW(), NOW());

-- Dodeli permisije SUPER_ADMIN roli
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT 
  r.id as roleId,
  p.id as permissionId
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN' 
  AND p.resource = 'legacy.sync';