-- CreateTable
CREATE TABLE `turnus_sync_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sync_id` VARCHAR(191) NOT NULL,
    `group_id` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `total_records` INTEGER NOT NULL DEFAULT 0,
    `processed_records` INTEGER NOT NULL DEFAULT 0,
    `upserted_records` INTEGER NOT NULL DEFAULT 0,
    `error_records` INTEGER NOT NULL DEFAULT 0,
    `last_processed_turnus_id` INTEGER NULL,
    `last_processed_batch` INTEGER NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `error_message` TEXT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `turnus_sync_logs_sync_id_key`(`sync_id`),
    INDEX `turnus_sync_logs_sync_id_idx`(`sync_id`),
    INDEX `turnus_sync_logs_group_id_idx`(`group_id`),
    INDEX `turnus_sync_logs_status_idx`(`status`),
    INDEX `turnus_sync_logs_user_id_idx`(`user_id`),
    INDEX `turnus_sync_logs_started_at_idx`(`started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `turnus_sync_logs` ADD CONSTRAINT `turnus_sync_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

