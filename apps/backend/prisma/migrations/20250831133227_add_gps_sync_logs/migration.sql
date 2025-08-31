-- CreateTable
CREATE TABLE `gps_sync_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicle_id` INTEGER NULL,
    `vehicle_garage_no` VARCHAR(50) NULL,
    `sync_start_date` DATETIME(3) NOT NULL,
    `sync_end_date` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `total_points` INTEGER NOT NULL DEFAULT 0,
    `processed_points` INTEGER NOT NULL DEFAULT 0,
    `inserted_points` INTEGER NOT NULL DEFAULT 0,
    `updated_points` INTEGER NOT NULL DEFAULT 0,
    `skipped_points` INTEGER NOT NULL DEFAULT 0,
    `error_points` INTEGER NOT NULL DEFAULT 0,
    `total_distance` DOUBLE NULL,
    `batch_size` INTEGER NOT NULL DEFAULT 1000,
    `delay_ms` INTEGER NOT NULL DEFAULT 3000,
    `started_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `error` TEXT NULL,
    `user_id` INTEGER NULL,

    INDEX `gps_sync_logs_status_idx`(`status`),
    INDEX `gps_sync_logs_vehicle_garage_no_idx`(`vehicle_garage_no`),
    INDEX `gps_sync_logs_started_at_idx`(`started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `gps_sync_logs` ADD CONSTRAINT `gps_sync_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
