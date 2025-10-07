-- Add Tiketing and City server permissions for Central Points

-- ====================
-- GLAVNI SERVER - AŽURIRANJE POSTOJEĆIH PERMISIJA
-- ====================

-- Ažuriraj description i description_sr za postojeće Glavni server permisije
UPDATE permissions SET description = 'Main Server', description_sr = 'Glavni server - Pregled centralnih tačaka' WHERE name = 'transport.administration.central_points:view';
UPDATE permissions SET description = 'Main Server - Create', description_sr = 'Glavni server - Kreiranje centralnih tačaka' WHERE name = 'transport.administration.central_points:create';
UPDATE permissions SET description = 'Main Server - Update', description_sr = 'Glavni server - Izmena centralnih tačaka' WHERE name = 'transport.administration.central_points:update';
UPDATE permissions SET description = 'Main Server - Delete', description_sr = 'Glavni server - Brisanje centralnih tačaka' WHERE name = 'transport.administration.central_points:delete';

-- ====================
-- TIKETING SERVER PERMISIJE
-- ====================

-- 1. Tiketing Server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.ticketing:view',
  'transport.administration.central_points.ticketing',
  'view',
  'Ticketing Server',
  'Tiketing Server - Pregled centralnih tačaka',
  'transport',
  301510100000,
  NOW()
);

-- 2. Tiketing Server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.ticketing:create',
  'transport.administration.central_points.ticketing',
  'create',
  'Ticketing Server - Create',
  'Tiketing Server - Kreiranje centralnih tačaka',
  'transport',
  301510100001,
  NOW()
);

-- 3. Tiketing Server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.ticketing:update',
  'transport.administration.central_points.ticketing',
  'update',
  'Ticketing Server - Update',
  'Tiketing Server - Izmena centralnih tačaka',
  'transport',
  301510100002,
  NOW()
);

-- 4. Tiketing Server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.ticketing:delete',
  'transport.administration.central_points.ticketing',
  'delete',
  'Ticketing Server - Delete',
  'Tiketing Server - Brisanje centralnih tačaka',
  'transport',
  301510100003,
  NOW()
);

-- ====================
-- GRADSKI SERVER PERMISIJE
-- ====================

-- 5. Gradski server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.city:view',
  'transport.administration.central_points.city',
  'view',
  'City Server',
  'Gradski server - Pregled centralnih tačaka',
  'transport',
  301510200000,
  NOW()
);

-- 6. Gradski server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.city:create',
  'transport.administration.central_points.city',
  'create',
  'City Server - Create',
  'Gradski server - Kreiranje centralnih tačaka',
  'transport',
  301510200001,
  NOW()
);

-- 7. Gradski server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.city:update',
  'transport.administration.central_points.city',
  'update',
  'City Server - Update',
  'Gradski server - Izmena centralnih tačaka',
  'transport',
  301510200002,
  NOW()
);

-- 8. Gradski server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points.city:delete',
  'transport.administration.central_points.city',
  'delete',
  'City Server - Delete',
  'Gradski server - Brisanje centralnih tačaka',
  'transport',
  301510200003,
  NOW()
);
