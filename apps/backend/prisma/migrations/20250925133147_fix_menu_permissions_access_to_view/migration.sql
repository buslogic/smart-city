-- FixMenuPermissionsAccessToView
-- Ispravka: Zamena :access sa :view permisijama za meni opcije

-- 1. Obriši pogrešne :access permisije
DELETE FROM permissions WHERE name IN (
  'users:access',
  'dispatcher:access',
  'safety:access',
  'maintenance:access',
  'settings:access',
  'vehicles:access'
);

-- 2. Dodaj ispravne :view permisije
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) VALUES
  ('users:view', 'users', 'view', 'Access Users module', 'Pristup modulu korisnici', 'Users', NOW(), NOW()),
  ('dispatcher:view', 'dispatcher', 'view', 'Access Dispatcher submenu', 'Pristup dispečerskom podmeniju', 'Transport', NOW(), NOW()),
  ('safety:view', 'safety', 'view', 'Access Safety submenu', 'Pristup podmeniju bezbednost', 'Transport', NOW(), NOW()),
  ('maintenance:view', 'maintenance', 'view', 'Access Maintenance submenu', 'Pristup podmeniju održavanje', 'Transport', NOW(), NOW()),
  ('settings:view', 'settings', 'view', 'Access Settings module', 'Pristup modulu podešavanje', 'Settings', NOW(), NOW()),
  ('vehicles:view', 'vehicles', 'view', 'Access Vehicles submenu', 'Pristup podmeniju vozila', 'Transport', NOW(), NOW());

-- NAPOMENA: transport:view već postoji iz prethodne migracije i ispravno je