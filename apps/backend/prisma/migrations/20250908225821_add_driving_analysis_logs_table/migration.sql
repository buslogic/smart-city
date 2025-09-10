-- CreateTable
CREATE TABLE `driving_analysis_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `vehicle_ids` JSON NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `total_vehicles` INTEGER NOT NULL,
    `processed_vehicles` INTEGER NOT NULL DEFAULT 0,
    `total_events_detected` INTEGER NOT NULL DEFAULT 0,
    `total_events_before` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `strategy` VARCHAR(20) NOT NULL DEFAULT 'daily',
    `clear_existing` BOOLEAN NOT NULL DEFAULT false,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `error_message` TEXT NULL,
    `vehicle_progress` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `driving_analysis_logs_status_idx`(`status`),
    INDEX `driving_analysis_logs_user_id_idx`(`user_id`),
    INDEX `driving_analysis_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `driving_analysis_logs` ADD CONSTRAINT `driving_analysis_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

