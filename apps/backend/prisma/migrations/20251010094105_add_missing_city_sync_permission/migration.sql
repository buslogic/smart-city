-- Add missing city:sync permission (ignore if exists)
INSERT IGNORE INTO `permissions` (`name`, `resource`, `action`, `description`, `description_sr`, `menu_order`, `created_at`, `updated_at`)
VALUES
('transport.administration.stops_sync.city:sync', 'transport.administration.stops_sync.city', 'sync', 'City server - Sync stops', 'Gradski server - Sinhronizacija stajališta', 301515200004, NOW(), NOW());

-- Assign to SUPER_ADMIN role (ignore if already assigned)
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'SUPER_ADMIN'
  AND p.resource = 'transport.administration.stops_sync.city'
  AND p.action = 'sync';
