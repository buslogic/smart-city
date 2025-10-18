-- Add Planning group and Schedule permissions
-- Kreiranje meni grupe "Planiranje" i opcije "Raspored"
-- NAPOMENA: Planiranje je pod-grupa u okviru Dispečerskog Modula (menuOrder 302000000000)

-- 1. Grupa "Planiranje" - pristup podmeniju (pod Dispečerskim modulom)
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning:view',
  'transport.planning',
  'view',
  'Access to planning submenu',
  'Pristup podmeniju planiranje',
  'transport',
  302050000000,
  NOW()
);

-- 2. Raspored - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.schedule:view',
  'transport.planning.schedule',
  'view',
  'View schedule',
  'Pregled rasporeda',
  'transport',
  302050010000,
  NOW()
);

-- 3. Raspored - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.schedule:create',
  'transport.planning.schedule',
  'create',
  'Create schedule',
  'Kreiranje rasporeda',
  'transport',
  302050010001,
  NOW()
);

-- 4. Raspored - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.schedule:update',
  'transport.planning.schedule',
  'update',
  'Update schedule',
  'Izmena rasporeda',
  'transport',
  302050010002,
  NOW()
);

-- 5. Raspored - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.schedule:delete',
  'transport.planning.schedule',
  'delete',
  'Delete schedule',
  'Brisanje rasporeda',
  'transport',
  302050010003,
  NOW()
);

-- 6. Dodeli sve permisije SUPER_ADMIN roli (roleId = 1)
INSERT INTO role_permissions (roleId, permissionId)
SELECT 1, id FROM permissions WHERE name IN (
  'transport.planning:view',
  'transport.planning.schedule:view',
  'transport.planning.schedule:create',
  'transport.planning.schedule:update',
  'transport.planning.schedule:delete'
);
