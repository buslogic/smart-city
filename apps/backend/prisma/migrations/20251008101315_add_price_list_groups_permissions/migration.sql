-- Add price list groups permissions (15 total)

-- 1. Kontejner permisija - pristup podmeniju
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups:view',
  'transport.administration.price_list_groups',
  'view',
  'Access to price list groups submenu',
  'Pristup podmeniju grupe cenovnika',
  'transport',
  301520000000,
  NOW()
);

-- 2. Glavni server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.main:view',
  'transport.administration.price_list_groups.main',
  'view',
  'Main server - View price list groups',
  'Glavni server - Pregled grupa cenovnika',
  'transport',
  301520010000,
  NOW()
);

-- 3. Glavni server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.main:create',
  'transport.administration.price_list_groups.main',
  'create',
  'Main server - Create price list groups',
  'Glavni server - Kreiranje grupa cenovnika',
  'transport',
  301520010001,
  NOW()
);

-- 4. Glavni server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.main:update',
  'transport.administration.price_list_groups.main',
  'update',
  'Main server - Update price list groups',
  'Glavni server - Izmena grupa cenovnika',
  'transport',
  301520010002,
  NOW()
);

-- 5. Glavni server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.main:delete',
  'transport.administration.price_list_groups.main',
  'delete',
  'Main server - Delete price list groups',
  'Glavni server - Brisanje grupa cenovnika',
  'transport',
  301520010003,
  NOW()
);

-- 6. Ticketing server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.ticketing:view',
  'transport.administration.price_list_groups.ticketing',
  'view',
  'Ticketing Server - View price list groups',
  'Tiketing Server - Pregled grupa cenovnika',
  'transport',
  301520100000,
  NOW()
);

-- 7. Ticketing server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.ticketing:create',
  'transport.administration.price_list_groups.ticketing',
  'create',
  'Ticketing Server - Create price list groups',
  'Tiketing Server - Kreiranje grupa cenovnika',
  'transport',
  301520100001,
  NOW()
);

-- 8. Ticketing server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.ticketing:update',
  'transport.administration.price_list_groups.ticketing',
  'update',
  'Ticketing Server - Update price list groups',
  'Tiketing Server - Izmena grupa cenovnika',
  'transport',
  301520100002,
  NOW()
);

-- 9. Ticketing server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.ticketing:delete',
  'transport.administration.price_list_groups.ticketing',
  'delete',
  'Ticketing Server - Delete price list groups',
  'Tiketing Server - Brisanje grupa cenovnika',
  'transport',
  301520100003,
  NOW()
);

-- 10. Ticketing server - SYNC permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.ticketing:sync',
  'transport.administration.price_list_groups.ticketing',
  'sync',
  'Ticketing Server - Synchronization',
  'Tiketing Server - Sinhronizacija',
  'transport',
  301520100004,
  NOW()
);

-- 11. Gradski server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.city:view',
  'transport.administration.price_list_groups.city',
  'view',
  'City Server - View price list groups',
  'Gradski server - Pregled grupa cenovnika',
  'transport',
  301520200000,
  NOW()
);

-- 12. Gradski server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.city:create',
  'transport.administration.price_list_groups.city',
  'create',
  'City Server - Create price list groups',
  'Gradski server - Kreiranje grupa cenovnika',
  'transport',
  301520200001,
  NOW()
);

-- 13. Gradski server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.city:update',
  'transport.administration.price_list_groups.city',
  'update',
  'City Server - Update price list groups',
  'Gradski server - Izmena grupa cenovnika',
  'transport',
  301520200002,
  NOW()
);

-- 14. Gradski server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.city:delete',
  'transport.administration.price_list_groups.city',
  'delete',
  'City Server - Delete price list groups',
  'Gradski server - Brisanje grupa cenovnika',
  'transport',
  301520200003,
  NOW()
);

-- 15. Gradski server - SYNC permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.price_list_groups.city:sync',
  'transport.administration.price_list_groups.city',
  'sync',
  'City Server - Synchronization',
  'Gradski server - Sinhronizacija grupa cenovnika',
  'transport',
  301520200004,
  NOW()
);
