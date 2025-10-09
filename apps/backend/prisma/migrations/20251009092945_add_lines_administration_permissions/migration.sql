-- Add Lines Administration permissions

-- 1. Linije Administracija - VIEW permisija (kontejner)
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines_admin:view',
  'transport.administration.lines_admin',
  'view',
  'Access to Lines Administration',
  'Pristup opciji Linije Administracija',
  'transport',
  301525000000,
  NOW()
);

-- 2. Linije Administracija - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines_admin:create',
  'transport.administration.lines_admin',
  'create',
  'Create lines in administration',
  'Kreiranje linija u administraciji',
  'transport',
  301525000001,
  NOW()
);

-- 3. Linije Administracija - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines_admin:update',
  'transport.administration.lines_admin',
  'update',
  'Update lines in administration',
  'Izmena linija u administraciji',
  'transport',
  301525000002,
  NOW()
);

-- 4. Linije Administracija - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.lines_admin:delete',
  'transport.administration.lines_admin',
  'delete',
  'Delete lines in administration',
  'Brisanje linija u administraciji',
  'transport',
  301525000003,
  NOW()
);
