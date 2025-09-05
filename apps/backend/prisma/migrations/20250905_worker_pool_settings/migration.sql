-- Dodavanje Worker Pool podešavanja za Legacy Sync

-- Worker Pool osnovna podešavanja
INSERT INTO `system_settings` (`key`, `value`, `type`, `category`, `description`, `created_at`, `updated_at`) VALUES
('legacy_sync.worker_pool.enabled', 'false', 'boolean', 'legacy_sync', 'Enable Worker Pool for parallel vehicle sync', NOW(), NOW()),
('legacy_sync.worker_pool.max_workers', '3', 'number', 'legacy_sync', 'Maximum number of parallel workers', NOW(), NOW()),
('legacy_sync.worker_pool.worker_timeout_ms', '600000', 'number', 'legacy_sync', 'Worker timeout in milliseconds (10 min)', NOW(), NOW()),
('legacy_sync.worker_pool.retry_attempts', '2', 'number', 'legacy_sync', 'Number of retry attempts per worker', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  `updated_at` = NOW();

-- SSH i Transfer podešavanja
INSERT INTO `system_settings` (`key`, `value`, `type`, `category`, `description`, `created_at`, `updated_at`) VALUES
('legacy_sync.ssh.connection_pool_size', '5', 'number', 'legacy_sync', 'SSH connection pool size', NOW(), NOW()),
('legacy_sync.transfer.concurrent_limit', '3', 'number', 'legacy_sync', 'Maximum concurrent file transfers', NOW(), NOW()),
('legacy_sync.transfer.chunk_size_mb', '100', 'number', 'legacy_sync', 'Transfer chunk size in MB', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  `updated_at` = NOW();

-- Resource limits
INSERT INTO `system_settings` (`key`, `value`, `type`, `category`, `description`, `created_at`, `updated_at`) VALUES
('legacy_sync.resource.max_memory_mb', '512', 'number', 'legacy_sync', 'Maximum memory per worker in MB', NOW(), NOW()),
('legacy_sync.resource.max_cpu_percent', '25', 'number', 'legacy_sync', 'Maximum CPU usage per worker in percent', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  `updated_at` = NOW();

-- Monitoring i logging
INSERT INTO `system_settings` (`key`, `value`, `type`, `category`, `description`, `created_at`, `updated_at`) VALUES
('legacy_sync.monitoring.enabled', 'true', 'boolean', 'legacy_sync', 'Enable detailed monitoring', NOW(), NOW()),
('legacy_sync.monitoring.log_level', 'info', 'string', 'legacy_sync', 'Log level (debug, info, warn, error)', NOW(), NOW()),
('legacy_sync.monitoring.metrics_interval_ms', '5000', 'number', 'legacy_sync', 'Metrics collection interval in ms', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  `updated_at` = NOW();