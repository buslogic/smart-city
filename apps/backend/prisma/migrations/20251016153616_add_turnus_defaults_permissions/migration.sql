-- Add Turnus Defaults permissions under Planning submenu
-- Kreiranje opcije "Default Turnusa" u okviru Planiranje podmenija
-- NAPOMENA: Planiranje je pod-grupa u okviru Dispečerskog Modula (menuOrder 302000000000)
-- Parent: transport.planning:view (302050000000)
-- Schedule: 302050010xxx
-- Turnus Defaults: 302050020xxx

-- 1. Default Turnusa - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.turnus_defaults:view',
  'transport.planning.turnus_defaults',
  'view',
  'View default turnus assignments',
  'Pregled default turnusa po vozačima',
  'transport',
  302050020000,
  NOW()
);

-- 2. Default Turnusa - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.turnus_defaults:create',
  'transport.planning.turnus_defaults',
  'create',
  'Create default turnus assignments',
  'Kreiranje default turnusa',
  'transport',
  302050020001,
  NOW()
);

-- 3. Default Turnusa - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.turnus_defaults:update',
  'transport.planning.turnus_defaults',
  'update',
  'Update default turnus assignments',
  'Izmena default turnusa',
  'transport',
  302050020002,
  NOW()
);

-- 4. Default Turnusa - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.turnus_defaults:delete',
  'transport.planning.turnus_defaults',
  'delete',
  'Delete default turnus assignments',
  'Brisanje default turnusa',
  'transport',
  302050020003,
  NOW()
);

-- 5. Default Turnusa - ANALYZE permisija (analiza istorije)
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.turnus_defaults:analyze',
  'transport.planning.turnus_defaults',
  'analyze',
  'Analyze history to recommend defaults',
  'Analiza istorije za preporuke defaults',
  'transport',
  302050020004,
  NOW()
);

-- 6. Default Turnusa - GENERATE permisija (auto-generisanje)
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.turnus_defaults:generate',
  'transport.planning.turnus_defaults',
  'generate',
  'Auto-generate defaults from history',
  'Auto-generisanje defaults iz istorije',
  'transport',
  302050020005,
  NOW()
);

-- 7. Dodeli sve permisije SUPER_ADMIN roli (roleId = 1)
INSERT INTO role_permissions (roleId, permissionId)
SELECT 1, id FROM permissions WHERE name IN (
  'transport.planning.turnus_defaults:view',
  'transport.planning.turnus_defaults:create',
  'transport.planning.turnus_defaults:update',
  'transport.planning.turnus_defaults:delete',
  'transport.planning.turnus_defaults:analyze',
  'transport.planning.turnus_defaults:generate'
);
