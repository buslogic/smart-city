-- Add Worker Pool settings to system_settings table
INSERT INTO `system_settings` (`key`, `value`, `type`, `category`, `description`, `created_at`, `updated_at`) VALUES 
('gps.processor.use_worker_pool', 'true', 'boolean', 'gps', 'Omogućava Worker Pool Pattern za paralelno procesiranje GPS podataka', NOW(), NOW()),
('gps.processor.worker_count', '4', 'number', 'gps', 'Broj paralelnih worker-a koji procesiraju GPS podatke (1-8)', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  `value` = VALUES(`value`),
  `description` = VALUES(`description`),
  `updated_at` = NOW();