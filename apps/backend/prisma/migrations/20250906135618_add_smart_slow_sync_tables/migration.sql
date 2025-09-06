-- CreateTable Smart Slow Sync Vozila
CREATE TABLE `smart_slow_sync_vehicles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicle_id` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `last_sync_at` DATETIME(3) NULL,
    `last_successful_sync_at` DATETIME(3) NULL,
    `total_sync_count` INTEGER NOT NULL DEFAULT 0,
    `successful_sync_count` INTEGER NOT NULL DEFAULT 0,
    `failed_sync_count` INTEGER NOT NULL DEFAULT 0,
    `total_points_processed` BIGINT NOT NULL DEFAULT 0,
    `last_error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `smart_slow_sync_vehicles_vehicle_id_key`(`vehicle_id`),
    INDEX `idx_enabled_priority`(`enabled`, `priority`),
    INDEX `idx_last_sync`(`last_sync_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Smart Slow Sync History
CREATE TABLE `smart_slow_sync_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicle_id` INTEGER NOT NULL,
    `batch_number` INTEGER NOT NULL,
    `sync_start_date` DATETIME(3) NOT NULL,
    `sync_end_date` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `points_processed` INTEGER NOT NULL DEFAULT 0,
    `processing_time_ms` INTEGER NOT NULL DEFAULT 0,
    `disk_space_used_bytes` BIGINT NULL,
    `compression_ratio` DOUBLE NULL,
    `error` TEXT NULL,
    `started_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,

    INDEX `idx_vehicle_batch`(`vehicle_id`, `batch_number`),
    INDEX `idx_status`(`status`),
    INDEX `idx_started_at`(`started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Smart Slow Sync Batch
CREATE TABLE `smart_slow_sync_batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `batch_number` INTEGER NOT NULL,
    `vehicle_ids` JSON NOT NULL,
    `total_vehicles` INTEGER NOT NULL,
    `processed_vehicles` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `total_points_processed` BIGINT NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `processing_time_ms` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `smart_slow_sync_batches_batch_number_key`(`batch_number`),
    INDEX `idx_batch_status`(`status`),
    INDEX `idx_batch_number`(`batch_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `smart_slow_sync_vehicles` ADD CONSTRAINT `smart_slow_sync_vehicles_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `bus_vehicles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `smart_slow_sync_history` ADD CONSTRAINT `smart_slow_sync_history_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `smart_slow_sync_vehicles`(`vehicle_id`) ON DELETE CASCADE ON UPDATE CASCADE;