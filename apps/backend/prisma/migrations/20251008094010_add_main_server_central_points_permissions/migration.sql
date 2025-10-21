-- Add Main Server specific permissions for Central Points
-- Add missing City Server sync permission

-- Obriši stare permisije ako postoje (cleanup od failed migration)
DELETE FROM permissions WHERE name IN (
  'transport.administration.central_points.main:view',
  'transport.administration.central_points.main:create',
  'transport.administration.central_points.main:update',
  'transport.administration.central_points.main:delete',
  'transport.administration.central_points.city:sync'
);

-- ====================
-- GLAVNI SERVER (MAIN) PERMISIJE
-- ====================

-- 1. Main Server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.main:view',
  'transport.administration.central_points.main',
  'view',
  'Main Server',
  'Glavni server - Pregled centralnih tačaka',
  'transport',
  301510000000,
  NOW()
);

-- 2. Main Server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.main:create',
  'transport.administration.central_points.main',
  'create',
  'Main Server - Create',
  'Glavni server - Kreiranje centralnih tačaka',
  'transport',
  301510000001,
  NOW()
);

-- 3. Main Server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.main:update',
  'transport.administration.central_points.main',
  'update',
  'Main Server - Update',
  'Glavni server - Izmena centralnih tačaka',
  'transport',
  301510000002,
  NOW()
);

-- 4. Main Server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.main:delete',
  'transport.administration.central_points.main',
  'delete',
  'Main Server - Delete',
  'Glavni server - Brisanje centralnih tačaka',
  'transport',
  301510000003,
  NOW()
);

-- ====================
-- GRADSKI SERVER (CITY) - NEDOSTAJUĆA SYNC PERMISIJA
-- ====================

-- 5. City Server - SYNC permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.city:sync',
  'transport.administration.central_points.city',
  'sync',
  'City Server - Sync',
  'Gradski server - Sinhronizacija centralnih tačaka',
  'transport',
  301510200004,
  NOW()
);
