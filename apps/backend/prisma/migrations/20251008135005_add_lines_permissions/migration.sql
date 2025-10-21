-- Add Lines permissions

-- 1. Opcija u meniju - pristup Linije opciji
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines:view',
  'transport.administration.lines',
  'view',
  'Access to lines menu option',
  'Pristup opciji Linije',
  'transport',
  301530000000,
  NOW()
);

-- 2. GLAVNI SERVER - VIEW
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines.main:view',
  'transport.administration.lines.main',
  'view',
  'View lines on main server',
  'Pregled linija na glavnom serveru',
  'transport',
  301530100000,
  NOW()
);

-- 3. GLAVNI SERVER - CREATE
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines.main:create',
  'transport.administration.lines.main',
  'create',
  'Create lines on main server',
  'Kreiranje linija na glavnom serveru',
  'transport',
  301530100001,
  NOW()
);

-- 4. GLAVNI SERVER - UPDATE
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines.main:update',
  'transport.administration.lines.main',
  'update',
  'Update lines on main server',
  'Izmena linija na glavnom serveru',
  'transport',
  301530100002,
  NOW()
);

-- 5. GLAVNI SERVER - DELETE
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines.main:delete',
  'transport.administration.lines.main',
  'delete',
  'Delete lines on main server',
  'Brisanje linija na glavnom serveru',
  'transport',
  301530100003,
  NOW()
);

-- 6. TIKETING SERVER - VIEW
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines.ticketing:view',
  'transport.administration.lines.ticketing',
  'view',
  'View lines on ticketing server',
  'Pregled linija na tiketing serveru',
  'transport',
  301530200000,
  NOW()
);

-- 7. TIKETING SERVER - SYNC
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines.ticketing:sync',
  'transport.administration.lines.ticketing',
  'sync',
  'Sync lines from ticketing server',
  'Sinhronizacija linija sa tiketing servera',
  'transport',
  301530200001,
  NOW()
);

-- 8. GRADSKI SERVER - VIEW
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines.city:view',
  'transport.administration.lines.city',
  'view',
  'View lines on city server',
  'Pregled linija na gradskom serveru',
  'transport',
  301530300000,
  NOW()
);

-- 9. GRADSKI SERVER - SYNC
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines.city:sync',
  'transport.administration.lines.city',
  'sync',
  'Sync lines from city server',
  'Sinhronizacija linija sa gradskog servera',
  'transport',
  301530300001,
  NOW()
);
