-- Add administration variations permissions (identično strukturi Linije)

-- 1. Pristup opciji Varijacije
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.variations:view',
  'transport.administration.variations',
  'view',
  'Access to Variations option',
  'Pristup opciji Varijacije',
  'transport',
  301535000000,
  NOW()
);

-- 2. Glavni server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.variations.main:view',
  'transport.administration.variations.main',
  'view',
  'View variations on main server',
  'Pregled varijacija na glavnom serveru',
  'transport',
  301535100000,
  NOW()
);

-- 3. Glavni server - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.variations.main:create',
  'transport.administration.variations.main',
  'create',
  'Create variations on main server',
  'Kreiranje varijacija na glavnom serveru',
  'transport',
  301535100001,
  NOW()
);

-- 4. Glavni server - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.variations.main:update',
  'transport.administration.variations.main',
  'update',
  'Update variations on main server',
  'Izmena varijacija na glavnom serveru',
  'transport',
  301535100002,
  NOW()
);

-- 5. Glavni server - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.variations.main:delete',
  'transport.administration.variations.main',
  'delete',
  'Delete variations on main server',
  'Brisanje varijacija na glavnom serveru',
  'transport',
  301535100003,
  NOW()
);

-- 6. Tiketing server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.variations.ticketing:view',
  'transport.administration.variations.ticketing',
  'view',
  'View variations on ticketing server',
  'Pregled varijacija na tiketing serveru',
  'transport',
  301535200000,
  NOW()
);

-- 7. Tiketing server - SYNC permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.variations.ticketing:sync',
  'transport.administration.variations.ticketing',
  'sync',
  'Sync variations from ticketing server',
  'Sinhronizacija varijacija sa tiketing servera',
  'transport',
  301535200001,
  NOW()
);

-- 8. Gradski server - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.variations.city:view',
  'transport.administration.variations.city',
  'view',
  'View variations on city server',
  'Pregled varijacija na gradskom serveru',
  'transport',
  301535300000,
  NOW()
);

-- 9. Gradski server - SYNC permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.variations.city:sync',
  'transport.administration.variations.city',
  'sync',
  'Sync variations from city server',
  'Sinhronizacija varijacija sa gradskog servera',
  'transport',
  301535300001,
  NOW()
);
