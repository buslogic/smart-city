-- Dodaj permisije za Povezani turnusi modul

-- Create permisija
INSERT INTO `permissions` (`name`, `resource`, `action`, `description`, `description_sr`, `category`, `menu_order`, `created_at`, `updated_at`)
SELECT
  'transport.planning.linked_turnusi:create',
  'transport.planning.linked_turnusi',
  'create',
  'Create linked shifts (turnusi)',
  'Kreiranje povezanih turnusa',
  'Planning',
  302050040001,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `permissions` WHERE `name` = 'transport.planning.linked_turnusi:create'
);

-- Update permisija
INSERT INTO `permissions` (`name`, `resource`, `action`, `description`, `description_sr`, `category`, `menu_order`, `created_at`, `updated_at`)
SELECT
  'transport.planning.linked_turnusi:update',
  'transport.planning.linked_turnusi',
  'update',
  'Update linked shifts (turnusi)',
  'Ažuriranje povezanih turnusa',
  'Planning',
  302050040002,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `permissions` WHERE `name` = 'transport.planning.linked_turnusi:update'
);

-- Delete permisija
INSERT INTO `permissions` (`name`, `resource`, `action`, `description`, `description_sr`, `category`, `menu_order`, `created_at`, `updated_at`)
SELECT
  'transport.planning.linked_turnusi:delete',
  'transport.planning.linked_turnusi',
  'delete',
  'Delete linked shifts (turnusi)',
  'Brisanje povezanih turnusa',
  'Planning',
  302050040003,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `permissions` WHERE `name` = 'transport.planning.linked_turnusi:delete'
);

-- Dodaj sve permisije SUPER_ADMIN roli (camelCase kolone!)
INSERT INTO `role_permissions` (`roleId`, `permissionId`, `granted_at`)
SELECT
  (SELECT `id` FROM `roles` WHERE `name` = 'SUPER_ADMIN' LIMIT 1),
  p.`id`,
  NOW()
FROM `permissions` p
WHERE p.`name` LIKE 'transport.planning.linked_turnusi:%'
AND NOT EXISTS (
  SELECT 1 FROM `role_permissions` rp
  WHERE rp.`roleId` = (SELECT `id` FROM `roles` WHERE `name` = 'SUPER_ADMIN' LIMIT 1)
  AND rp.`permissionId` = p.`id`
);
