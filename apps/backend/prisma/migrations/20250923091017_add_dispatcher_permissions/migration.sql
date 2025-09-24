-- Dodavanje nedostajućih dispečerskih permisija

-- Dispatcher view_map permission
INSERT INTO `permissions` (`name`, `resource`, `action`, `description`, `description_sr`, `category`, `created_at`, `updated_at`)
VALUES ('dispatcher:view_map', 'dispatcher_map', 'read', 'View dispatcher map with vehicles', 'Pregled mape sa vozilima', 'Dispečerski modul', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- Dispatcher view_analytics permission
INSERT INTO `permissions` (`name`, `resource`, `action`, `description`, `description_sr`, `category`, `created_at`, `updated_at`)
VALUES ('dispatcher:view_analytics', 'dispatcher_analytics', 'read', 'View vehicle analytics', 'Pregled analitike vozila', 'Dispečerski modul', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();