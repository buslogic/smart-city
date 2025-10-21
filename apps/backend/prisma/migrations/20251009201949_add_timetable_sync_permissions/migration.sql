-- Add RedVoznje Sync. permissions

-- 1. Kontejner - pristup opciji
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_sync:view',
  'transport.administration.timetable_sync',
  'view',
  'Access to RedVoznje Sync. menu option',
  'Pristup opciji RedVoznje Sync.',
  'transport',
  301545000000,
  NOW()
);

-- 2. Glavni server - VIEW
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_sync.main:view',
  'transport.administration.timetable_sync.main',
  'view',
  'Main server - View timetable sync',
  'Glavni server - Pregled RedVoznje sinhronizacije',
  'transport',
  301545100000,
  NOW()
);

-- 3. Glavni server - CREATE
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_sync.main:create',
  'transport.administration.timetable_sync.main',
  'create',
  'Main server - Create timetable sync',
  'Glavni server - Kreiranje RedVoznje sinhronizacije',
  'transport',
  301545100001,
  NOW()
);

-- 4. Glavni server - UPDATE
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_sync.main:update',
  'transport.administration.timetable_sync.main',
  'update',
  'Main server - Update timetable sync',
  'Glavni server - Izmena RedVoznje sinhronizacije',
  'transport',
  301545100002,
  NOW()
);

-- 5. Glavni server - DELETE
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_sync.main:delete',
  'transport.administration.timetable_sync.main',
  'delete',
  'Main server - Delete timetable sync',
  'Glavni server - Brisanje RedVoznje sinhronizacije',
  'transport',
  301545100003,
  NOW()
);

-- 6. Ticketing Server - VIEW
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_sync.ticketing:view',
  'transport.administration.timetable_sync.ticketing',
  'view',
  'Ticketing server - View timetable sync',
  'Ticketing server - Pregled RedVoznje sinhronizacije',
  'transport',
  301545200000,
  NOW()
);

-- 7. Ticketing Server - SYNC
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_sync.ticketing:sync',
  'transport.administration.timetable_sync.ticketing',
  'sync',
  'Ticketing server - Sync timetable',
  'Ticketing server - Sinhronizacija RedVoznje',
  'transport',
  301545200001,
  NOW()
);

-- 8. Gradski Server - VIEW
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_sync.city:view',
  'transport.administration.timetable_sync.city',
  'view',
  'City server - View timetable sync',
  'Gradski server - Pregled RedVoznje sinhronizacije',
  'transport',
  301545300000,
  NOW()
);

-- 9. Gradski Server - SYNC
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_sync.city:sync',
  'transport.administration.timetable_sync.city',
  'sync',
  'City server - Sync timetable',
  'Gradski server - Sinhronizacija RedVoznje',
  'transport',
  301545300001,
  NOW()
);
