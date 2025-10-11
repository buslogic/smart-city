-- Add Turnusi module permissions

-- Main permissions (parent)
INSERT INTO permissions (name, resource, action, description, menu_order, category, description_sr, ui_route, created_at, updated_at)
VALUES
  ('transport.administration.turnusi:view', 'transport.administration.turnusi', 'view', 'View Turnusi', 301555000000, 'transport', 'Pregled Turnusi modula', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi:read', 'transport.administration.turnusi', 'read', 'Read Turnusi data', 301555000001, 'transport', 'Čitanje podataka Turnusi', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi:sync', 'transport.administration.turnusi', 'sync', 'Sync Turnusi data', 301555000002, 'transport', 'Sinhronizacija Turnusi podataka', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi:delete', 'transport.administration.turnusi', 'delete', 'Delete Turnusi data', 301555000003, 'transport', 'Brisanje Turnusi podataka', '/transport/administration/turnusi', NOW(), NOW());

-- Main Server tab permissions
INSERT INTO permissions (name, resource, action, description, menu_order, category, description_sr, ui_route, created_at, updated_at)
VALUES
  ('transport.administration.turnusi.main:view', 'transport.administration.turnusi.main', 'view', 'View Turnusi Main Server', 301555100000, 'transport', 'Pregled Glavni server tab', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi.main:read', 'transport.administration.turnusi.main', 'read', 'Read Turnusi Main Server data', 301555100001, 'transport', 'Čitanje podataka Glavni server', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi.main:sync', 'transport.administration.turnusi.main', 'sync', 'Sync Turnusi Main Server data', 301555100002, 'transport', 'Sinhronizacija Glavni server', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi.main:delete', 'transport.administration.turnusi.main', 'delete', 'Delete Turnusi Main Server data', 301555100003, 'transport', 'Brisanje podataka Glavni server', '/transport/administration/turnusi', NOW(), NOW());

-- Ticketing Server tab permissions
INSERT INTO permissions (name, resource, action, description, menu_order, category, description_sr, ui_route, created_at, updated_at)
VALUES
  ('transport.administration.turnusi.ticketing:view', 'transport.administration.turnusi.ticketing', 'view', 'View Turnusi Ticketing Server', 301555200000, 'transport', 'Pregled Tiketing server tab', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi.ticketing:read', 'transport.administration.turnusi.ticketing', 'read', 'Read Turnusi Ticketing Server data', 301555200001, 'transport', 'Čitanje podataka Tiketing server', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi.ticketing:sync', 'transport.administration.turnusi.ticketing', 'sync', 'Sync Turnusi Ticketing Server data', 301555200002, 'transport', 'Sinhronizacija Tiketing server', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi.ticketing:delete', 'transport.administration.turnusi.ticketing', 'delete', 'Delete Turnusi Ticketing Server data', 301555200003, 'transport', 'Brisanje podataka Tiketing server', '/transport/administration/turnusi', NOW(), NOW());

-- City Server tab permissions
INSERT INTO permissions (name, resource, action, description, menu_order, category, description_sr, ui_route, created_at, updated_at)
VALUES
  ('transport.administration.turnusi.city:view', 'transport.administration.turnusi.city', 'view', 'View Turnusi City Server', 301555300000, 'transport', 'Pregled Gradski server tab', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi.city:read', 'transport.administration.turnusi.city', 'read', 'Read Turnusi City Server data', 301555300001, 'transport', 'Čitanje podataka Gradski server', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi.city:sync', 'transport.administration.turnusi.city', 'sync', 'Sync Turnusi City Server data', 301555300002, 'transport', 'Sinhronizacija Gradski server', '/transport/administration/turnusi', NOW(), NOW()),
  ('transport.administration.turnusi.city:delete', 'transport.administration.turnusi.city', 'delete', 'Delete Turnusi City Server data', 301555300003, 'transport', 'Brisanje podataka Gradski server', '/transport/administration/turnusi', NOW(), NOW());
