-- Add Linked Turnusi permissions (between Turnus Defaults and next option)
-- MenuOrder: 302050025000 (between 302050020000 and future options)

-- 1. Povezani turnusi - VIEW permisija (pristup stranici)
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.linked_turnusi:view',
  'transport.planning.linked_turnusi',
  'view',
  'View linked turnusi',
  'Pregled povezanih turnusa',
  'transport',
  302050025000,
  NOW()
);

-- 2. Povezani turnusi - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.linked_turnusi:create',
  'transport.planning.linked_turnusi',
  'create',
  'Create linked turnusi',
  'Kreiranje povezanih turnusa',
  'transport',
  302050025001,
  NOW()
);

-- 3. Povezani turnusi - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.linked_turnusi:update',
  'transport.planning.linked_turnusi',
  'update',
  'Update linked turnusi',
  'Izmena povezanih turnusa',
  'transport',
  302050025002,
  NOW()
);

-- 4. Povezani turnusi - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.linked_turnusi:delete',
  'transport.planning.linked_turnusi',
  'delete',
  'Delete linked turnusi',
  'Brisanje povezanih turnusa',
  'transport',
  302050025003,
  NOW()
);
