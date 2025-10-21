-- Add timetable dates permissions (15 total)

-- 1. Kontejner permisija - pristup podmeniju
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates:view',
  'transport.administration.timetable_dates',
  'view',
  'Access to timetable dates submenu',
  'Pristup podmeniju grupe za RedVoznje',
  'transport',
  301540000000,
  NOW()
);

-- 2. Glavni server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.main:view',
  'transport.administration.timetable_dates.main',
  'view',
  'Main server - View timetable dates',
  'Glavni server - Pregled grupa za RedVoznje',
  'transport',
  301540010000,
  NOW()
);

-- 3. Glavni server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.main:create',
  'transport.administration.timetable_dates.main',
  'create',
  'Main server - Create timetable dates',
  'Glavni server - Kreiranje grupa za RedVoznje',
  'transport',
  301540010001,
  NOW()
);

-- 4. Glavni server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.main:update',
  'transport.administration.timetable_dates.main',
  'update',
  'Main server - Update timetable dates',
  'Glavni server - Izmena grupa za RedVoznje',
  'transport',
  301540010002,
  NOW()
);

-- 5. Glavni server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.main:delete',
  'transport.administration.timetable_dates.main',
  'delete',
  'Main server - Delete timetable dates',
  'Glavni server - Brisanje grupa za RedVoznje',
  'transport',
  301540010003,
  NOW()
);

-- 6. Ticketing server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.ticketing:view',
  'transport.administration.timetable_dates.ticketing',
  'view',
  'Ticketing Server - View timetable dates',
  'Tiketing Server - Pregled grupa za RedVoznje',
  'transport',
  301540100000,
  NOW()
);

-- 7. Ticketing server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.ticketing:create',
  'transport.administration.timetable_dates.ticketing',
  'create',
  'Ticketing Server - Create timetable dates',
  'Tiketing Server - Kreiranje grupa za RedVoznje',
  'transport',
  301540100001,
  NOW()
);

-- 8. Ticketing server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.ticketing:update',
  'transport.administration.timetable_dates.ticketing',
  'update',
  'Ticketing Server - Update timetable dates',
  'Tiketing Server - Izmena grupa za RedVoznje',
  'transport',
  301540100002,
  NOW()
);

-- 9. Ticketing server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.ticketing:delete',
  'transport.administration.timetable_dates.ticketing',
  'delete',
  'Ticketing Server - Delete timetable dates',
  'Tiketing Server - Brisanje grupa za RedVoznje',
  'transport',
  301540100003,
  NOW()
);

-- 10. Ticketing server - SYNC permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.ticketing:sync',
  'transport.administration.timetable_dates.ticketing',
  'sync',
  'Ticketing Server - Synchronization',
  'Tiketing Server - Sinhronizacija',
  'transport',
  301540100004,
  NOW()
);

-- 11. Gradski server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.city:view',
  'transport.administration.timetable_dates.city',
  'view',
  'City Server - View timetable dates',
  'Gradski server - Pregled grupa za RedVoznje',
  'transport',
  301540200000,
  NOW()
);

-- 12. Gradski server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.city:create',
  'transport.administration.timetable_dates.city',
  'create',
  'City Server - Create timetable dates',
  'Gradski server - Kreiranje grupa za RedVoznje',
  'transport',
  301540200001,
  NOW()
);

-- 13. Gradski server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.city:update',
  'transport.administration.timetable_dates.city',
  'update',
  'City Server - Update timetable dates',
  'Gradski server - Izmena grupa za RedVoznje',
  'transport',
  301540200002,
  NOW()
);

-- 14. Gradski server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.city:delete',
  'transport.administration.timetable_dates.city',
  'delete',
  'City Server - Delete timetable dates',
  'Gradski server - Brisanje grupa za RedVoznje',
  'transport',
  301540200003,
  NOW()
);

-- 15. Gradski server - SYNC permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.timetable_dates.city:sync',
  'transport.administration.timetable_dates.city',
  'sync',
  'City Server - Synchronization',
  'Gradski server - Sinhronizacija grupa za RedVoznje',
  'transport',
  301540200004,
  NOW()
);
