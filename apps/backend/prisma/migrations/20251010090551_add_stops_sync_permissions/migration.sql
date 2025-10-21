-- Add Stajališta Sync. permissions

-- 1. Kontejner "Stajališta Sync." - pristup podmeniju
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync:view',
  'transport.administration.stops_sync',
  'view',
  'Access to stops sync submenu',
  'Pristup podmeniju stajališta sync',
  'transport',
  301515000000,
  NOW()
);

-- 2. Glavni Server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.main:view',
  'transport.administration.stops_sync.main',
  'view',
  'Main server - View stops',
  'Glavni server - Pregled stajališta',
  'transport',
  301515010000,
  NOW()
);

-- 3. Glavni Server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.main:create',
  'transport.administration.stops_sync.main',
  'create',
  'Main server - Create stops',
  'Glavni server - Kreiranje stajališta',
  'transport',
  301515010001,
  NOW()
);

-- 4. Glavni Server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.main:update',
  'transport.administration.stops_sync.main',
  'update',
  'Main server - Update stops',
  'Glavni server - Izmena stajališta',
  'transport',
  301515010002,
  NOW()
);

-- 5. Glavni Server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.main:delete',
  'transport.administration.stops_sync.main',
  'delete',
  'Main server - Delete stops',
  'Glavni server - Brisanje stajališta',
  'transport',
  301515010003,
  NOW()
);

-- 6. Tiketing Server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.ticketing:view',
  'transport.administration.stops_sync.ticketing',
  'view',
  'Ticketing server - View stops',
  'Tiketing Server - Pregled stajališta',
  'transport',
  301515100000,
  NOW()
);

-- 7. Tiketing Server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.ticketing:create',
  'transport.administration.stops_sync.ticketing',
  'create',
  'Ticketing server - Create stops',
  'Tiketing Server - Kreiranje stajališta',
  'transport',
  301515100001,
  NOW()
);

-- 8. Tiketing Server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.ticketing:update',
  'transport.administration.stops_sync.ticketing',
  'update',
  'Ticketing server - Update stops',
  'Tiketing Server - Izmena stajališta',
  'transport',
  301515100002,
  NOW()
);

-- 9. Tiketing Server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.ticketing:delete',
  'transport.administration.stops_sync.ticketing',
  'delete',
  'Ticketing server - Delete stops',
  'Tiketing Server - Brisanje stajališta',
  'transport',
  301515100003,
  NOW()
);

-- 10. Tiketing Server - SYNC permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.ticketing:sync',
  'transport.administration.stops_sync.ticketing',
  'sync',
  'Ticketing server - Sync stops',
  'Tiketing Server - Sinhronizacija stajališta',
  'transport',
  301515100004,
  NOW()
);

-- 11. Gradski Server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.city:view',
  'transport.administration.stops_sync.city',
  'view',
  'City server - View stops',
  'Gradski server - Pregled stajališta',
  'transport',
  301515200000,
  NOW()
);

-- 12. Gradski Server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.city:create',
  'transport.administration.stops_sync.city',
  'create',
  'City server - Create stops',
  'Gradski server - Kreiranje stajališta',
  'transport',
  301515200001,
  NOW()
);

-- 13. Gradski Server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.city:update',
  'transport.administration.stops_sync.city',
  'update',
  'City server - Update stops',
  'Gradski server - Izmena stajališta',
  'transport',
  301515200002,
  NOW()
);

-- 14. Gradski Server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.stops_sync.city:delete',
  'transport.administration.stops_sync.city',
  'delete',
  'City server - Delete stops',
  'Gradski server - Brisanje stajališta',
  'transport',
  301515200003,
  NOW()
);
