-- CreateTable
CREATE TABLE `vehicle_sync_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sync_type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `started_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `total_records` INTEGER NOT NULL,
    `processed_records` INTEGER NOT NULL DEFAULT 0,
    `created_records` INTEGER NOT NULL DEFAULT 0,
    `updated_records` INTEGER NOT NULL DEFAULT 0,
    `skipped_records` INTEGER NOT NULL DEFAULT 0,
    `error_records` INTEGER NOT NULL DEFAULT 0,
    `error_details` JSON NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicle_sync_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sync_log_id` INTEGER NOT NULL,
    `legacy_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `changes` JSON NULL,
    `conflict_fields` JSON NULL,
    `resolution` VARCHAR(191) NULL,
    `error_message` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vehicle_sync_details_sync_log_id_idx`(`sync_log_id`),
    INDEX `vehicle_sync_details_legacy_id_idx`(`legacy_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vehicle_sync_logs` ADD CONSTRAINT `vehicle_sync_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicle_sync_details` ADD CONSTRAINT `vehicle_sync_details_sync_log_id_fkey` FOREIGN KEY (`sync_log_id`) REFERENCES `vehicle_sync_logs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
