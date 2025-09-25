-- AddMissingMenuPermissions
-- Dodavanje nedostajućih permisija za meni opcije

-- Nedostaju view permisije za specifične meni opcije
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) VALUES
  ('safety.aggressive.driving:view', 'safety.aggressive.driving', 'view', 'View Aggressive Driving reports', 'Pregled izveštaja agresivne vožnje', 'Safety', NOW(), NOW()),
  ('safety.reports:view', 'safety.reports', 'view', 'View Safety Reports', 'Pregled bezbednosnih izveštaja', 'Safety', NOW(), NOW()),
  ('settings.general:view', 'settings.general', 'view', 'View General Settings', 'Pregled opštih podešavanja', 'Settings', NOW(), NOW());

-- Parent access permisije za glavne meni sekcije
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) VALUES
  ('users:access', 'users', 'access', 'Access Users module', 'Pristup modulu korisnici', 'Users', NOW(), NOW()),
  ('transport:view', 'transport', 'view', 'Access Transport module', 'Pristup transportnom modulu', 'Transport', NOW(), NOW()),
  ('vehicles:access', 'vehicles', 'access', 'Access Vehicles submenu', 'Pristup podmeniju vozila', 'Transport', NOW(), NOW()),
  ('dispatcher:access', 'dispatcher', 'access', 'Access Dispatcher submenu', 'Pristup dispečerskom podmeniju', 'Transport', NOW(), NOW()),
  ('safety:access', 'safety', 'access', 'Access Safety submenu', 'Pristup podmeniju bezbednost', 'Transport', NOW(), NOW()),
  ('maintenance:access', 'maintenance', 'access', 'Access Maintenance submenu', 'Pristup podmeniju održavanje', 'Transport', NOW(), NOW()),
  ('settings:access', 'settings', 'access', 'Access Settings module', 'Pristup modulu podešavanje', 'Settings', NOW(), NOW());