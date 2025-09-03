-- CreateTable
CREATE TABLE IF NOT EXISTS `system_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'string',
    `description` TEXT,
    `category` VARCHAR(50) NOT NULL DEFAULT 'general',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_settings_key_key`(`key`),
    INDEX `idx_category`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Insert default GPS processor settings
INSERT INTO `system_settings` (`key`, `value`, `type`, `description`, `category`, `created_at`, `updated_at`) VALUES
('gps.processor.batch_size', '4000', 'number', 'Broj GPS tačaka po batch-u za procesiranje', 'gps', NOW(), NOW()),
('gps.processor.interval_seconds', '30', 'number', 'Interval u sekundama između procesiranja', 'gps', NOW(), NOW()),
('gps.cleanup.processed_minutes', '5', 'number', 'Nakon koliko minuta se brišu processed zapisi iz buffer-a', 'gps', NOW(), NOW()),
('gps.cleanup.failed_hours', '2', 'number', 'Nakon koliko sati se brišu failed zapisi', 'gps', NOW(), NOW()),
('gps.cleanup.stats_days', '10', 'number', 'Nakon koliko dana se brišu stare statistike', 'gps', NOW(), NOW());