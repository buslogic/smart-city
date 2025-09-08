-- CreateTable
CREATE TABLE `gps_worker_logs` (
    `id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NOT NULL,
    `worker_id` INTEGER NOT NULL,
    `started_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `duration_ms` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL,
    `records_assigned` INTEGER NOT NULL,
    `records_processed` INTEGER NOT NULL DEFAULT 0,
    `records_failed` INTEGER NOT NULL DEFAULT 0,
    `records_per_second` DOUBLE NULL,
    `chunk_size` INTEGER NULL,
    `offset` INTEGER NULL,
    `processing_steps` JSON NULL,
    `error_message` TEXT NULL,
    `error_stack` TEXT NULL,
    `failed_ids` JSON NULL,
    `processed_by` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `gps_worker_logs_batch_id_idx`(`batch_id`),
    INDEX `gps_worker_logs_worker_id_idx`(`worker_id`),
    INDEX `gps_worker_logs_started_at_idx`(`started_at`),
    INDEX `gps_worker_logs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `gps_worker_logs` ADD CONSTRAINT `gps_worker_logs_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `gps_batch_history`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

