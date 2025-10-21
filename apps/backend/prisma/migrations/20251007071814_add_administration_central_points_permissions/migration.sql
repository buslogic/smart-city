-- CreateTable
-- Add administration and central points permissions

-- 1. Grupa "Administracija" - pristup podmeniju
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration:view',
  'transport.administration',
  'view',
  'Access to administration submenu',
  'Pristup podmeniju administracija',
  'transport',
  301500000000,
  NOW()
);

-- 2. Centralne tačke - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points:view',
  'transport.administration.central_points',
  'view',
  'View central points',
  'Pregled centralnih tačaka',
  'transport',
  301510000000,
  NOW()
);

-- 3. Centralne tačke - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points:create',
  'transport.administration.central_points',
  'create',
  'Create central points',
  'Kreiranje centralnih tačaka',
  'transport',
  301510000001,
  NOW()
);

-- 4. Centralne tačke - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points:update',
  'transport.administration.central_points',
  'update',
  'Update central points',
  'Izmena centralnih tačaka',
  'transport',
  301510000002,
  NOW()
);

-- 5. Centralne tačke - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points:delete',
  'transport.administration.central_points',
  'delete',
  'Delete central points',
  'Brisanje centralnih tačaka',
  'transport',
  301510000003,
  NOW()
);
