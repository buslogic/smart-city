-- Prvo ukloni vehicles:sync iz role_permissions
DELETE FROM role_permissions WHERE permissionId IN (
  SELECT id FROM permissions WHERE name = 'vehicles:sync'
);

-- Obriši staru vehicles:sync permisiju
DELETE FROM permissions WHERE name = 'vehicles:sync';

-- Dodaj nove granularne sync permisije
INSERT INTO permissions (name, resource, action, description, created_at, updated_at) VALUES
  ('vehicles.sync:view', 'vehicles.sync', 'view', 'Pregled statusa sinhronizacije vozila', NOW(), NOW()),
  ('vehicles.sync:start', 'vehicles.sync', 'start', 'Pokretanje sinhronizacije vozila', NOW(), NOW()),
  ('vehicles.sync:stop', 'vehicles.sync', 'stop', 'Zaustavljanje sinhronizacije vozila', NOW(), NOW()),
  ('vehicles.sync:configure', 'vehicles.sync', 'configure', 'Konfiguracija parametara sinhronizacije', NOW(), NOW());