-- Add dispatcher:sync_gps permission
INSERT INTO `permissions` (`name`, `resource`, `action`, `description`, `created_at`, `updated_at`)
VALUES ('dispatcher:sync_gps', 'dispatcher', 'sync_gps', 'Pokretanje i upravljanje GPS sinhronizacijom', NOW(), NOW());