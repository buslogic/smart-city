-- Dodaj COPY metod konfiguraciju za Worker Pool
INSERT INTO system_settings (`key`, `value`, `type`, `category`, `description`, `created_at`, `updated_at`) 
VALUES 
  ('legacy_sync.insert_method', 'batch', 'string', 'legacy_sync', 'Metoda za insert podataka (batch/copy/auto)', NOW(), NOW()),
  ('legacy_sync.copy_batch_size', '10000', 'number', 'legacy_sync', 'Veličina batch-a za COPY metodu', NOW(), NOW()),
  ('legacy_sync.fallback_to_batch', 'true', 'boolean', 'legacy_sync', 'Fallback na batch ako COPY fail-uje', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  `description` = VALUES(`description`),
  `updated_at` = NOW();