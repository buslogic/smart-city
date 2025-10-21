-- Add Turnusi Sync permissions

-- 1. Kontejner permisija - pristup opciji "Turnusi Sync"
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, created_at, updated_at)
VALUES (
  'transport.administration.turnusi_sync:view',
  'transport.administration.turnusi_sync',
  'view',
  'Access to Turnusi Sync submenu',
  'Pristup opciji Turnusi Sync',
  'transport',
  301550000000,
  NOW(),
  NOW()
);

-- ========== GLAVNI SERVER PERMISIJE ==========

-- 2. Main Server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, created_at, updated_at)
VALUES (
  'transport.administration.turnusi_sync.main:view',
  'transport.administration.turnusi_sync.main',
  'view',
  'Main server - View Turnusi Sync',
  'Glavni server - Pregled turnusa sinhronizacije',
  'transport',
  301550100000,
  NOW(),
  NOW()
);

-- 3. Main Server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, created_at, updated_at)
VALUES (
  'transport.administration.turnusi_sync.main:create',
  'transport.administration.turnusi_sync.main',
  'create',
  'Main server - Create Turnusi Sync',
  'Glavni server - Kreiranje turnusa sinhronizacije',
  'transport',
  301550100001,
  NOW(),
  NOW()
);

-- 4. Main Server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, created_at, updated_at)
VALUES (
  'transport.administration.turnusi_sync.main:update',
  'transport.administration.turnusi_sync.main',
  'update',
  'Main server - Update Turnusi Sync',
  'Glavni server - Izmena turnusa sinhronizacije',
  'transport',
  301550100002,
  NOW(),
  NOW()
);

-- 5. Main Server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, created_at, updated_at)
VALUES (
  'transport.administration.turnusi_sync.main:delete',
  'transport.administration.turnusi_sync.main',
  'delete',
  'Main server - Delete Turnusi Sync',
  'Glavni server - Brisanje turnusa sinhronizacije',
  'transport',
  301550100003,
  NOW(),
  NOW()
);

-- ========== TIKETING SERVER PERMISIJE ==========

-- 6. Ticketing Server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, created_at, updated_at)
VALUES (
  'transport.administration.turnusi_sync.ticketing:view',
  'transport.administration.turnusi_sync.ticketing',
  'view',
  'Ticketing server - View Turnusi Sync',
  'Ticketing server - Pregled turnusa sinhronizacije',
  'transport',
  301550200000,
  NOW(),
  NOW()
);

-- 7. Ticketing Server - SYNC permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, created_at, updated_at)
VALUES (
  'transport.administration.turnusi_sync.ticketing:sync',
  'transport.administration.turnusi_sync.ticketing',
  'sync',
  'Ticketing server - Sync Turnusi',
  'Ticketing server - Sinhronizacija turnusa',
  'transport',
  301550200001,
  NOW(),
  NOW()
);

-- ========== GRADSKI SERVER PERMISIJE ==========

-- 8. City Server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, created_at, updated_at)
VALUES (
  'transport.administration.turnusi_sync.city:view',
  'transport.administration.turnusi_sync.city',
  'view',
  'City server - View Turnusi Sync',
  'Gradski server - Pregled turnusa sinhronizacije',
  'transport',
  301550300000,
  NOW(),
  NOW()
);

-- 9. City Server - SYNC permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, created_at, updated_at)
VALUES (
  'transport.administration.turnusi_sync.city:sync',
  'transport.administration.turnusi_sync.city',
  'sync',
  'City server - Sync Turnusi',
  'Gradski server - Sinhronizacija turnusa',
  'transport',
  301550300001,
  NOW(),
  NOW()
);
